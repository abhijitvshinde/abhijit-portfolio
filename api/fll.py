"""
FLL Attachment Lab API (Vercel Python serverless function).

One endpoint, routed by ?action=...
  Public : status, login, logout, me
  Kid    : progress (GET/POST), sketch (GET/POST)
           robot (GET/POST), robot_score (POST)   <- Pybricks Robot Lab (/pybricks/), same accounts
  Coach  : users, create_user, reset_password, delete_user, user_progress, sketch?username=
  Team page (/fll-team.html, kid logins used by parents):
           team (GET), team_avail, team_away, team_volunteer, team_parent (POST, kid)
           team_avail, team_away also work for the coach with {username} (answer stamped "Coach")
           team_meeting, team_mentor (POST, coach)
           team_public (GET, no login: calendar with counts only, no names)

Required environment variables (set in Vercel -> Project -> Settings -> Environment Variables):
  ADMIN_USERNAME      coach login name
  ADMIN_PASSWORD      coach password
  SESSION_SECRET      optional; long random string used to sign login cookies. If unset,
                      a key is derived from the Redis token (which is already secret).
  KV_REST_API_URL / KV_REST_API_TOKEN   (added automatically by the Upstash Redis integration;
  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are accepted too)

Local development only:
  FLL_DEV_STORE=path/to/file.json  stores data in a JSON file instead of Redis
  FLL_DEV_INSECURE_COOKIE=1        drops the Secure cookie flag for http://localhost
"""

from http.server import BaseHTTPRequestHandler
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request

PREFIX = "fll:"
SESSION_DAYS = 30
COOKIE = "fll_session"
PBKDF2_ROUNDS = 210_000
MAX_PROGRESS_BYTES = 60_000
MAX_SKETCH_BYTES = 250_000
MISSION_RE = re.compile(r"^M(0[1-9]|1[0-5])$")
MAP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
MAX_ROBOT_CODE = 40_000      # characters per map program
MAX_ROBOT_BYTES = 200_000    # whole Robot Lab save (all maps)
ROBOT_SETUP_KEYS = {
    "left": "port", "right": "port", "arm": "port",
    "color": "sensor", "ultrasonic": "sensor", "force": "sensor",
}
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9_.-]{2,23}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
ID_RE = re.compile(r"^[a-f0-9]{8}$")
AVAIL = {"yes", "maybe", "no"}
PARENTS = {"mother": "Mother", "father": "Father"}
VOLUNTEER_KINDS = {"snacks", "present"}
EVENT_TYPES = {"meeting", "zoo", "fundraiser", "team_visit", "outreach", "competition", "other"}
MAX_MEETINGS = 120
MAX_AWAY = 40
MAX_MENTORS = 20


# ---------------------------------------------------------------- storage

class StoreError(Exception):
    pass


class RedisStore:
    """Minimal Upstash Redis REST client (no third-party packages)."""

    def __init__(self, url, token):
        self.url = url.rstrip("/")
        self.token = token

    def _post(self, path, body):
        req = urllib.request.Request(
            self.url + path,
            data=json.dumps(body).encode(),
            headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # network / auth problems
            raise StoreError(str(e))

    def cmd(self, *args):
        out = self._post("", [str(a) for a in args])
        if "error" in out:
            raise StoreError(out["error"])
        return out.get("result")

    def pipeline(self, commands):
        if not commands:
            return []
        out = self._post("/pipeline", [[str(a) for a in c] for c in commands])
        return [o.get("result") for o in out]


class FileStore:
    """JSON-file stand-in for Redis, for local testing only."""

    _lock = threading.Lock()

    def __init__(self, path):
        self.path = path

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"kv": {}, "sets": {}, "exp": {}}

    def _save(self, db):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(db, f)

    def _expire(self, db, key):
        exp = db["exp"].get(key)
        if exp and exp < time.time():
            db["kv"].pop(key, None)
            db["exp"].pop(key, None)

    def cmd(self, op, *args):
        with self._lock:
            db = self._load()
            op = op.upper()
            if args:
                self._expire(db, args[0])
            res = None
            if op == "GET":
                res = db["kv"].get(args[0])
            elif op == "MGET":
                for k in args:
                    self._expire(db, k)
                res = [db["kv"].get(k) for k in args]
            elif op == "SET":
                db["kv"][args[0]] = args[1]
                res = "OK"
            elif op == "DEL":
                res = 0
                for k in args:
                    res += int(db["kv"].pop(k, None) is not None or db["sets"].pop(k, None) is not None)
            elif op == "INCR":
                v = int(db["kv"].get(args[0], 0)) + 1
                db["kv"][args[0]] = str(v)
                res = v
            elif op == "EXPIRE":
                db["exp"][args[0]] = time.time() + int(args[1])
                res = 1
            elif op == "SADD":
                s = set(db["sets"].get(args[0], []))
                before = len(s)
                s.update(args[1:])
                db["sets"][args[0]] = sorted(s)
                res = len(s) - before
            elif op == "SREM":
                s = set(db["sets"].get(args[0], []))
                before = len(s)
                s.difference_update(args[1:])
                db["sets"][args[0]] = sorted(s)
                res = before - len(s)
            elif op == "SMEMBERS":
                res = list(db["sets"].get(args[0], []))
            else:
                raise StoreError("unsupported op " + op)
            self._save(db)
            return res

    def pipeline(self, commands):
        return [self.cmd(*c) for c in commands]


def redis_env():
    """Find the Upstash REST URL/token whatever prefix the Vercel integration used."""
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    token = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    if not (url and token):
        for key, value in os.environ.items():
            if key.endswith("_REST_API_URL") and value:
                other = os.environ.get(key[: -len("URL")] + "TOKEN")
                if other:
                    return value, other
    return url, token


def get_store():
    url, token = redis_env()
    if url and token:
        return RedisStore(url, token)
    dev = os.environ.get("FLL_DEV_STORE")
    if dev:
        return FileStore(dev)
    return None


# ---------------------------------------------------------------- auth helpers

def b64e(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password, salt_hex=None):
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return salt.hex(), digest.hex()


def admin_version():
    # Changing ADMIN_PASSWORD logs the coach out everywhere.
    return hashlib.sha256(os.environ.get("ADMIN_PASSWORD", "").encode()).hexdigest()[:10]


def session_key():
    explicit = os.environ.get("SESSION_SECRET")
    if explicit:
        return explicit.encode()
    token = redis_env()[1] or ""
    return hashlib.sha256(("fll-session:" + token).encode()).digest()


def sign(payload):
    secret = session_key()
    body = b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = b64e(hmac.new(secret, body.encode(), hashlib.sha256).digest())
    return body + "." + sig


def verify(token):
    try:
        body, sig = token.split(".", 1)
        secret = session_key()
        good = b64e(hmac.new(secret, body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(good, sig):
            return None
        data = json.loads(b64d(body))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None


def clean_text(value, limit):
    if not isinstance(value, str):
        return ""
    value = re.sub(r"[\x00-\x1f\x7f]", " ", value).strip()
    return value[:limit]


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------------------------------------------------------------- handler

class handler(BaseHTTPRequestHandler):

    # --- plumbing

    def log_message(self, *args):  # keep Vercel logs quiet
        pass

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def _send(self, status, data, cookie=None):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cookie(self, value, max_age):
        secure = "" if os.environ.get("FLL_DEV_INSECURE_COOKIE") else "; Secure"
        return f"{COOKIE}={value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}"

    def _json_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_SKETCH_BYTES + 10_000:
            raise ApiError(413, "That is too big to save.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            raise ApiError(400, "Bad request.")
        if not isinstance(data, dict):
            raise ApiError(400, "Bad request.")
        return data

    def _session(self):
        raw = self.headers.get("Cookie") or ""
        for part in raw.split(";"):
            name, _, value = part.strip().partition("=")
            if name == COOKIE and value:
                return verify(value)
        return None

    def _client_ip(self):
        fwd = self.headers.get("X-Forwarded-For") or ""
        return fwd.split(",")[0].strip() or (self.client_address[0] if self.client_address else "?")

    def _dispatch(self, method):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        action = (query.get("action") or [""])[0]
        self.query = {k: v[0] for k, v in query.items()}
        self.body = {}
        try:
            if action == "status":
                return self._send(200, {"ready": self._configured()})
            if not self._configured():
                raise ApiError(503, "The game server is not set up yet. Ask your coach.")
            self.store = get_store()
            if method == "POST":
                # Simple CSRF guard: browsers cannot send this header cross-site without CORS approval.
                if self.headers.get("X-FLL-Request") != "1":
                    raise ApiError(403, "Forbidden.")
                self.body = self._json_body()
            routes = {
                ("POST", "login"): self.login,
                ("POST", "logout"): self.logout,
                ("GET", "me"): self.me,
                ("GET", "progress"): self.get_progress,
                ("POST", "progress"): self.save_progress,
                ("GET", "sketch"): self.get_sketch,
                ("POST", "sketch"): self.save_sketch,
                ("GET", "users"): self.list_users,
                ("POST", "create_user"): self.create_user,
                ("POST", "reset_password"): self.reset_password,
                ("POST", "delete_user"): self.delete_user,
                ("GET", "user_progress"): self.user_progress,
                ("GET", "robot"): self.get_robot,
                ("POST", "robot"): self.save_robot,
                ("POST", "robot_score"): self.save_robot_score,
                ("GET", "team"): self.get_team,
                ("GET", "team_public"): self.team_public,
                ("POST", "team_avail"): self.team_avail,
                ("POST", "team_away"): self.team_away,
                ("POST", "team_volunteer"): self.team_volunteer,
                ("POST", "team_parent"): self.team_parent,
                ("POST", "team_meeting"): self.team_meeting,
                ("POST", "team_mentor"): self.team_mentor,
            }
            fn = routes.get((method, action))
            if not fn:
                raise ApiError(404, "Unknown action.")
            fn()
        except ApiError as e:
            self._send(e.status, {"error": e.message})
        except StoreError:
            self._send(502, {"error": "Could not reach the save server. Try again in a minute."})
        except Exception:
            import traceback
            traceback.print_exc()  # shows up in Vercel function logs
            self._send(500, {"error": "Something went wrong on the server."})

    def _configured(self):
        # With Redis the signing key falls back to the (secret) Redis token; the local
        # dev store has no token, so it needs SESSION_SECRET (tools/dev_server.py sets one).
        has_key = os.environ.get("SESSION_SECRET") or redis_env()[1]
        return bool(
            has_key
            and os.environ.get("ADMIN_USERNAME")
            and os.environ.get("ADMIN_PASSWORD")
            and get_store()
        )

    # --- data helpers

    def _get_json(self, key):
        raw = self.store.cmd("GET", PREFIX + key)
        return json.loads(raw) if raw else None

    def _set_json(self, key, value):
        self.store.cmd("SET", PREFIX + key, json.dumps(value, separators=(",", ":")))

    def _require(self, role):
        sess = self._session()
        if not sess:
            raise ApiError(401, "Please log in.")
        if sess.get("r") == "coach":
            if sess.get("v") != admin_version():
                raise ApiError(401, "Please log in again.")
            if role != "coach" and role != "any":
                raise ApiError(403, "Coach accounts don't play — log in as a student.")
            return sess, None
        user = self._get_json("user:" + sess.get("u", ""))
        if not user or user.get("ver") != sess.get("v"):
            raise ApiError(401, "Please log in again.")
        if role == "coach":
            raise ApiError(403, "Coach only.")
        return sess, user

    def _public_user(self, user):
        return {"username": user["username"], "name": user["name"], "team": user.get("team", ""), "role": "kid"}

    # --- public

    def login(self):
        username = clean_text(self.body.get("username"), 40).lower()
        password = self.body.get("password") or ""
        if not username or not isinstance(password, str) or not password:
            raise ApiError(400, "Type your username and password.")

        ip_key = PREFIX + "fail:ip:" + self._client_ip()
        user_key = PREFIX + "fail:user:" + username
        fails = self.store.pipeline([["GET", ip_key], ["GET", user_key]])
        if int(fails[0] or 0) >= 30 or int(fails[1] or 0) >= 8:
            raise ApiError(429, "Too many tries. Wait 15 minutes, or ask your coach.")

        admin_user = os.environ["ADMIN_USERNAME"].strip().lower()
        payload = None
        reply = None
        if hmac.compare_digest(username, admin_user):
            if hmac.compare_digest(password.encode(), os.environ["ADMIN_PASSWORD"].encode()):
                payload = {"u": admin_user, "r": "coach", "v": admin_version()}
                reply = {"user": {"username": admin_user, "name": "Coach", "role": "coach"}}
        else:
            user = self._get_json("user:" + username)
            if user:
                _, digest = hash_password(password, user["salt"])
                if hmac.compare_digest(digest, user["hash"]):
                    payload = {"u": username, "r": "kid", "v": user["ver"]}
                    reply = {"user": self._public_user(user)}
            else:
                hash_password(password)  # same timing whether or not the user exists

        if not payload:
            self.store.pipeline([
                ["INCR", ip_key], ["EXPIRE", ip_key, 900],
                ["INCR", user_key], ["EXPIRE", user_key, 900],
            ])
            raise ApiError(401, "That username and password don't match. Check with your coach.")

        self.store.cmd("DEL", user_key)
        payload["exp"] = int(time.time()) + SESSION_DAYS * 86400
        self._send(200, reply, cookie=self._cookie(sign(payload), SESSION_DAYS * 86400))

    def logout(self):
        self._send(200, {"ok": True}, cookie=self._cookie("", 0))

    def me(self):
        sess, user = self._require("any")
        if user is None:
            return self._send(200, {"user": {"username": sess["u"], "name": "Coach", "role": "coach"}})
        self._send(200, {"user": self._public_user(user)})

    # --- kid

    def get_progress(self):
        sess, _ = self._require("kid")
        self._send(200, {"progress": self._get_json("progress:" + sess["u"]) or {}})

    def save_progress(self):
        sess, _ = self._require("kid")
        progress = self.body.get("progress")
        if not isinstance(progress, dict):
            raise ApiError(400, "Bad progress data.")
        progress["savedAt"] = int(time.time())
        if len(json.dumps(progress)) > MAX_PROGRESS_BYTES:
            raise ApiError(413, "Your notes are too long to save. Make some shorter.")
        self._set_json("progress:" + sess["u"], progress)
        self.store.cmd("SET", PREFIX + "seen:" + sess["u"], str(int(time.time())))
        self._send(200, {"ok": True, "savedAt": progress["savedAt"]})

    def _mission_param(self, value):
        if not isinstance(value, str) or not MISSION_RE.match(value):
            raise ApiError(400, "Unknown mission.")
        return value

    def get_sketch(self):
        sess, user = self._require("any")
        mission = self._mission_param(self.query.get("mission"))
        username = sess["u"] if user is not None else clean_text(self.query.get("username"), 40).lower()
        image = self.store.cmd("GET", PREFIX + f"sketch:{username}:{mission}")
        self._send(200, {"image": image})

    def save_sketch(self):
        sess, _ = self._require("kid")
        mission = self._mission_param(self.body.get("mission"))
        image = self.body.get("image")
        if image in (None, ""):
            self.store.cmd("DEL", PREFIX + f"sketch:{sess['u']}:{mission}")
            return self._send(200, {"ok": True})
        if not isinstance(image, str) or not re.match(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$", image):
            raise ApiError(400, "Bad picture.")
        if len(image) > MAX_SKETCH_BYTES:
            raise ApiError(413, "That drawing is too big to save. Try clearing some of it.")
        self.store.cmd("SET", PREFIX + f"sketch:{sess['u']}:{mission}", image)
        self._send(200, {"ok": True})

    # --- Pybricks Robot Lab (kid)

    def _map_id(self, value):
        if not isinstance(value, str) or not MAP_ID_RE.match(value):
            raise ApiError(400, "Unknown map.")
        return value

    def _clean_setup(self, raw):
        if not isinstance(raw, dict):
            raise ApiError(400, "Bad robot setup.")
        out = {}
        for key, kind in ROBOT_SETUP_KEYS.items():
            v = raw.get(key)
            ok = isinstance(v, str) and (v in "ABCDEF" and len(v) == 1 or (kind == "sensor" and v == "none"))
            if not ok:
                raise ApiError(400, "Bad robot setup.")
            out[key] = v
        out["mirrored"] = "right" if raw.get("mirrored") == "right" else "left"
        out["armUp"] = -1 if raw.get("armUp") == -1 else 1
        try:
            out["wheel"] = float(raw.get("wheel"))
            out["track"] = float(raw.get("track"))
        except (TypeError, ValueError):
            raise ApiError(400, "Bad robot setup.")
        if not (20 <= out["wheel"] <= 150 and 60 <= out["track"] <= 250):
            raise ApiError(400, "Bad robot setup.")
        return out

    def get_robot(self):
        sess, _ = self._require("kid")
        self._send(200, {
            "robot": self._get_json("robot:" + sess["u"]) or {},
            "scores": self._get_json("robotscore:" + sess["u"]) or {},
        })

    def save_robot(self):
        """Save the robot setup and/or one map's program: {setup?, mapId?, code?}."""
        sess, _ = self._require("kid")
        doc = self._get_json("robot:" + sess["u"]) or {}
        if "setup" in self.body:
            doc["setup"] = self._clean_setup(self.body.get("setup"))
        if "mapId" in self.body:
            map_id = self._map_id(self.body.get("mapId"))
            code = self.body.get("code")
            if not isinstance(code, str):
                raise ApiError(400, "Bad program.")
            if len(code) > MAX_ROBOT_CODE:
                raise ApiError(413, "That program is too long to save.")
            doc.setdefault("code", {})[map_id] = code
        doc["savedAt"] = int(time.time())
        if len(json.dumps(doc)) > MAX_ROBOT_BYTES:
            raise ApiError(413, "Your programs are too long to save. Make some shorter.")
        self._set_json("robot:" + sess["u"], doc)
        self.store.cmd("SET", PREFIX + "seen:" + sess["u"], str(int(time.time())))
        self._send(200, {"ok": True, "savedAt": doc["savedAt"]})

    def save_robot_score(self):
        """Record one finished run: {mapId, mapName, score, total, missions: [ids]}. Keeps the best."""
        sess, _ = self._require("kid")
        map_id = self._map_id(self.body.get("mapId"))
        try:
            score = int(self.body.get("score"))
            total = int(self.body.get("total"))
        except (TypeError, ValueError):
            raise ApiError(400, "Bad score.")
        if not (0 <= score <= total <= 1000):
            raise ApiError(400, "Bad score.")
        missions = self.body.get("missions") or []
        if not isinstance(missions, list):
            raise ApiError(400, "Bad score.")
        missions = [clean_text(m, 24) for m in missions[:20] if isinstance(m, str)]
        scores = self._get_json("robotscore:" + sess["u"]) or {}
        rec = scores.get(map_id) or {"best": 0, "runs": 0}
        now = int(time.time())
        rec["runs"] = int(rec.get("runs", 0)) + 1
        rec["last"] = score
        rec["lastAt"] = now
        rec["total"] = total
        rec["name"] = clean_text(self.body.get("mapName"), 40) or map_id
        if score >= int(rec.get("best", 0)):
            if score > int(rec.get("best", 0)) or not rec.get("bestAt"):
                rec["bestAt"] = now
            rec["best"] = score
            rec["missions"] = missions
        scores[map_id] = rec
        self._set_json("robotscore:" + sess["u"], scores)
        self.store.cmd("SET", PREFIX + "seen:" + sess["u"], str(now))
        self._send(200, {"ok": True, "best": rec["best"]})

    # --- coach

    def list_users(self):
        self._require("coach")
        names = sorted(self.store.cmd("SMEMBERS", PREFIX + "users") or [])
        users = []
        if names:
            keys = []
            for n in names:
                keys += [PREFIX + "user:" + n, PREFIX + "progress:" + n, PREFIX + "seen:" + n,
                         PREFIX + "robotscore:" + n]
            raw = self.store.cmd("MGET", *keys)
            for i, n in enumerate(names):
                user_raw, prog_raw, seen, robot_raw = raw[4 * i: 4 * i + 4]
                if not user_raw:
                    continue
                user = json.loads(user_raw)
                prog = json.loads(prog_raw) if prog_raw else {}
                users.append({
                    "username": n,
                    "name": user["name"],
                    "team": user.get("team", ""),
                    "created": user.get("created"),
                    "lastActive": int(seen) if seen else None,
                    "missions": {
                        mid: {"status": m.get("status", "new"), "updated": m.get("updated")}
                        for mid, m in (prog.get("missions") or {}).items()
                        if isinstance(m, dict)
                    },
                    "robot": json.loads(robot_raw) if robot_raw else {},
                })
        self._send(200, {"users": users})

    def _new_password(self):
        password = self.body.get("password") or ""
        if not isinstance(password, str) or not (6 <= len(password) <= 64):
            raise ApiError(400, "Passwords must be 6 to 64 characters.")
        return password

    def create_user(self):
        self._require("coach")
        name = clean_text(self.body.get("name"), 40)
        team = clean_text(self.body.get("team"), 40)
        username = clean_text(self.body.get("username"), 24).lower()
        password = self._new_password()
        if not name:
            raise ApiError(400, "Type the student's name.")
        if not USERNAME_RE.match(username):
            raise ApiError(400, "Usernames are 3-24 letters/numbers (dots, dashes and underscores are OK).")
        if username == os.environ["ADMIN_USERNAME"].strip().lower():
            raise ApiError(400, "That username is taken.")
        if self._get_json("user:" + username):
            raise ApiError(409, "That username is taken. Try another.")
        salt, digest = hash_password(password)
        user = {
            "username": username, "name": name, "team": team,
            "salt": salt, "hash": digest, "ver": secrets.token_hex(4),
            "created": int(time.time()),
        }
        self._set_json("user:" + username, user)
        self.store.cmd("SADD", PREFIX + "users", username)
        self._send(200, {"user": self._public_user(user)})

    def _target_user(self):
        username = clean_text(self.body.get("username") or self.query.get("username") or "", 40).lower()
        user = self._get_json("user:" + username)
        if not user:
            raise ApiError(404, "No student with that username.")
        return user

    def reset_password(self):
        self._require("coach")
        user = self._target_user()
        user["salt"], user["hash"] = hash_password(self._new_password())
        user["ver"] = secrets.token_hex(4)  # logs the student out on other devices
        self._set_json("user:" + user["username"], user)
        self._send(200, {"ok": True})

    def delete_user(self):
        self._require("coach")
        user = self._target_user()
        u = user["username"]
        keys = [PREFIX + k for k in (f"user:{u}", f"progress:{u}", f"seen:{u}", f"robot:{u}", f"robotscore:{u}",
                                     f"team:avail:{u}", f"team:away:{u}", f"team:parents:{u}")]
        keys += [PREFIX + f"sketch:{u}:M{i:02d}" for i in range(1, 16)]
        self.store.pipeline([["DEL", *keys], ["SREM", PREFIX + "users", u]])
        self._send(200, {"ok": True})

    def user_progress(self):
        self._require("coach")
        user = self._target_user()
        progress = self._get_json("progress:" + user["username"]) or {}
        self._send(200, {
            "user": self._public_user(user), "progress": progress,
            "robot": self._get_json("robot:" + user["username"]) or {},
            "robotScores": self._get_json("robotscore:" + user["username"]) or {},
        })

    # --- Team page: meeting availability + parent volunteer sign-up

    def _parent(self):
        parent = self.body.get("parent")
        if parent not in PARENTS:
            raise ApiError(400, "Tell us if you are the mother or father first.")
        return PARENTS[parent]

    def _signer(self, username):
        """(role label, parent's saved name) for stamping an answer: ("Mother", "Priya")."""
        by = self._parent()
        names = self._get_json("team:parents:" + username) or {}
        return by, names.get(self.body.get("parent"), "")

    def _date(self, value, what="date"):
        if not isinstance(value, str) or not DATE_RE.match(value):
            raise ApiError(400, f"Pick a {what}.")
        return value

    def _time(self, value):
        if value in (None, ""):
            return ""
        if not isinstance(value, str) or not TIME_RE.match(value):
            raise ApiError(400, "Bad time.")
        return value

    def _id(self, value, what="item"):
        if not isinstance(value, str) or not ID_RE.match(value):
            raise ApiError(400, f"Unknown {what}.")
        return value

    def _meetings(self):
        return self._get_json("team:meetings") or []

    def _meeting(self, meeting_id):
        meeting_id = self._id(meeting_id, "meeting")
        for m in self._meetings():
            if m["id"] == meeting_id:
                return m
        raise ApiError(404, "That meeting no longer exists.")

    def _away_entry(self, by, name=""):
        start = self._date(self.body.get("from"), "start date")
        end = self._date(self.body.get("to"), "end date")
        if end < start:
            raise ApiError(400, "The end date is before the start date.")
        return {"id": secrets.token_hex(4), "from": start, "to": end,
                "note": clean_text(self.body.get("note"), 80), "by": by, "name": name}

    def get_team(self):
        sess, user = self._require("any")
        meetings = self._meetings()
        vol_raw = self.store.cmd("MGET", *[PREFIX + "team:vol:" + m["id"] for m in meetings]) if meetings else []
        volunteers = {m["id"]: json.loads(v) for m, v in zip(meetings, vol_raw) if v}
        out = {"meetings": meetings, "volunteers": volunteers}
        if user is not None:
            out["mine"] = {
                "avail": self._get_json("team:avail:" + sess["u"]) or {},
                "away": self._get_json("team:away:" + sess["u"]) or [],
                "parents": self._get_json("team:parents:" + sess["u"]) or {},
            }
            return self._send(200, out)
        # coach: everyone's availability and time away
        names = sorted(self.store.cmd("SMEMBERS", PREFIX + "users") or [])
        kids = []
        if names:
            keys = []
            for n in names:
                keys += [PREFIX + "user:" + n, PREFIX + "team:avail:" + n, PREFIX + "team:away:" + n,
                         PREFIX + "team:parents:" + n]
            raw = self.store.cmd("MGET", *keys)
            for i, n in enumerate(names):
                u_raw, a_raw, w_raw, p_raw = raw[4 * i: 4 * i + 4]
                if not u_raw:
                    continue
                kids.append({
                    "username": n, "name": json.loads(u_raw)["name"],
                    "avail": json.loads(a_raw) if a_raw else {},
                    "away": json.loads(w_raw) if w_raw else [],
                    "parents": json.loads(p_raw) if p_raw else {},
                })
        out["kids"] = kids
        out["mentors"] = self._get_json("team:mentors") or []
        self._send(200, out)

    def team_public(self):
        """No login needed: the calendar shown on the Team Corner login screen.
        Counts only — no kid, parent or volunteer names, and no place or notes."""
        meetings = self._meetings()
        names = sorted(self.store.cmd("SMEMBERS", PREFIX + "users") or [])
        keys = [PREFIX + "team:avail:" + n for n in names] + [PREFIX + "team:vol:" + m["id"] for m in meetings]
        raw = self.store.cmd("MGET", *keys) if keys else []
        avails = [json.loads(a) if a else {} for a in raw[:len(names)]]
        vols = [json.loads(v) if v else {} for v in raw[len(names):]]
        out = []
        for m, vol in zip(meetings, vols):
            answers = [(a.get(m["id"]) or {}).get("s") for a in avails]
            item = {
                "id": m["id"], "type": m.get("type", "meeting"), "title": m.get("title", ""),
                "date": m["date"], "start": m.get("start", ""), "end": m.get("end", ""),
                "status": m.get("status", "proposed"),
                "kids": {"yes": answers.count("yes"), "maybe": answers.count("maybe"), "total": len(names)},
            }
            if item["status"] == "scheduled":
                slots = m.get("slots") or {}
                item["volunteers"] = {k: {"filled": len(vol.get(k) or []), "slots": int(slots.get(k, 1))}
                                      for k in sorted(VOLUNTEER_KINDS)}
            out.append(item)
        self._send(200, {"meetings": out})

    def _team_target(self):
        """Whose answers to change, and who is signing: a parent (kid login) for their own
        child, or the coach for any kid ({username} in the body; stamped "Coach")."""
        sess, user = self._require("any")
        if user is not None:
            return (sess["u"],) + self._signer(sess["u"])
        return self._target_user()["username"], "Coach", ""

    def team_avail(self):
        """Kid login (used by a parent): {meetingId, status: yes|maybe|no|'', parent}.
        Coach: same plus {username}."""
        u, by, name = self._team_target()
        meeting = self._meeting(self.body.get("meetingId"))
        status = self.body.get("status") or ""
        if status and status not in AVAIL:
            raise ApiError(400, "Bad answer.")
        avail = self._get_json("team:avail:" + u) or {}
        if status:
            avail[meeting["id"]] = {"s": status, "by": by, "name": name, "at": int(time.time())}
        else:
            avail.pop(meeting["id"], None)
        self._set_json("team:avail:" + u, avail)
        self._send(200, {"ok": True, "avail": avail})

    def team_away(self):
        """Kid login: {op: add, from, to, note, parent} or {op: remove, id}. Coach: same plus {username}."""
        u, by, name = self._team_target()
        away = self._get_json("team:away:" + u) or []
        op = self.body.get("op")
        if op == "add":
            if len(away) >= MAX_AWAY:
                raise ApiError(400, "That is a lot of trips! Remove an old one first.")
            away.append(self._away_entry(by, name))
            away.sort(key=lambda a: a["from"])
        elif op == "remove":
            away_id = self._id(self.body.get("id"), "trip")
            away = [a for a in away if a["id"] != away_id]
        else:
            raise ApiError(400, "Bad request.")
        self._set_json("team:away:" + u, away)
        self._send(200, {"ok": True, "away": away})

    def team_volunteer(self):
        """Kid login: {meetingId, kind: snacks|present, join: bool, parent}."""
        sess, user = self._require("kid")
        by, name = self._signer(sess["u"])
        meeting = self._meeting(self.body.get("meetingId"))
        kind = self.body.get("kind")
        if kind not in VOLUNTEER_KINDS:
            raise ApiError(400, "Bad request.")
        key = "team:vol:" + meeting["id"]
        vol = self._get_json(key) or {}
        people = [p for p in vol.get(kind, []) if not (p["u"] == sess["u"] and p["by"] == by)]
        if self.body.get("join"):
            if meeting.get("status") != "scheduled":
                raise ApiError(400, "Sign-up opens once the coach confirms this meeting.")
            slots = int(meeting.get("slots", {}).get(kind, 1))
            if len(people) >= slots:
                raise ApiError(409, "Sorry, that spot was just taken.")
            people.append({"u": sess["u"], "kid": user["name"], "by": by, "name": name, "at": int(time.time())})
        vol[kind] = people
        self._set_json(key, vol)
        self._send(200, {"ok": True, "volunteers": vol})

    def team_parent(self):
        """Kid login: remember the parents' names for this child: {parent: mother|father, name}."""
        sess, _ = self._require("kid")
        self._parent()
        name = clean_text(self.body.get("name"), 40)
        if not name:
            raise ApiError(400, "Type your name.")
        names = self._get_json("team:parents:" + sess["u"]) or {}
        names[self.body["parent"]] = name
        self._set_json("team:parents:" + sess["u"], names)
        self._send(200, {"ok": True, "parents": names})

    def team_meeting(self):
        """Coach: {op: add|update|remove, id?, type, title, date, start, end, place, note, status, slots}.
        type: meeting (default) or an activity such as zoo, fundraiser, team_visit."""
        self._require("coach")
        meetings = self._meetings()
        op = self.body.get("op")
        if op == "remove":
            meeting_id = self._id(self.body.get("id"), "meeting")
            meetings = [m for m in meetings if m["id"] != meeting_id]
            self.store.cmd("DEL", PREFIX + "team:vol:" + meeting_id)
        elif op in ("add", "update"):
            if op == "add":
                if len(meetings) >= MAX_MEETINGS:
                    raise ApiError(400, "Too many meetings. Remove some old ones first.")
                kind = self.body.get("type") or "meeting"
                meeting = {"id": secrets.token_hex(4), "status": "proposed", "type": "meeting",
                           "slots": {"snacks": 1, "present": 1 if kind == "meeting" else 0}}
                meetings.append(meeting)
            else:
                meeting_id = self._id(self.body.get("id"), "meeting")
                meeting = next((m for m in meetings if m["id"] == meeting_id), None)
                if not meeting:
                    raise ApiError(404, "That meeting no longer exists.")
            if op == "add" or "date" in self.body:
                meeting["date"] = self._date(self.body.get("date"))
            for field in ("start", "end"):
                if op == "add" or field in self.body:
                    meeting[field] = self._time(self.body.get(field))
            if op == "add" or "type" in self.body:
                kind = self.body.get("type") or "meeting"
                if kind not in EVENT_TYPES:
                    raise ApiError(400, "Unknown activity type.")
                meeting["type"] = kind
            for field, limit in (("title", 60), ("place", 60), ("note", 120)):
                if op == "add" or field in self.body:
                    meeting[field] = clean_text(self.body.get(field), limit)
            if "status" in self.body:
                if self.body["status"] not in ("proposed", "scheduled", "cancelled"):
                    raise ApiError(400, "Bad status.")
                meeting["status"] = self.body["status"]
            if "slots" in self.body:
                slots = self.body.get("slots")
                if not isinstance(slots, dict):
                    raise ApiError(400, "Bad slots.")
                for kind in VOLUNTEER_KINDS:
                    try:
                        n = int(slots.get(kind, meeting["slots"].get(kind, 1)))
                    except (TypeError, ValueError):
                        raise ApiError(400, "Bad slots.")
                    meeting["slots"][kind] = max(0, min(n, 10))
        else:
            raise ApiError(400, "Bad request.")
        meetings.sort(key=lambda m: (m["date"], m.get("start", "")))
        self._set_json("team:meetings", meetings)
        self._send(200, {"ok": True, "meetings": meetings})

    def team_mentor(self):
        """Coach manages mentors (they have no logins):
        {op: add, name} | {op: remove, id} | {op: avail, id, meetingId, status}
        | {op: away_add, id, from, to, note} | {op: away_remove, id, awayId}"""
        self._require("coach")
        mentors = self._get_json("team:mentors") or []
        op = self.body.get("op")
        if op == "add":
            name = clean_text(self.body.get("name"), 40)
            if not name:
                raise ApiError(400, "Type the mentor's name.")
            if len(mentors) >= MAX_MENTORS:
                raise ApiError(400, "Too many mentors.")
            mentors.append({"id": secrets.token_hex(4), "name": name, "avail": {}, "away": []})
        else:
            mentor_id = self._id(self.body.get("id"), "mentor")
            mentor = next((m for m in mentors if m["id"] == mentor_id), None)
            if not mentor:
                raise ApiError(404, "That mentor no longer exists.")
            if op == "remove":
                mentors.remove(mentor)
            elif op == "avail":
                meeting = self._meeting(self.body.get("meetingId"))
                status = self.body.get("status") or ""
                if status and status not in AVAIL:
                    raise ApiError(400, "Bad answer.")
                if status:
                    mentor["avail"][meeting["id"]] = {"s": status, "by": "Coach", "at": int(time.time())}
                else:
                    mentor["avail"].pop(meeting["id"], None)
            elif op == "away_add":
                if len(mentor["away"]) >= MAX_AWAY:
                    raise ApiError(400, "Remove an old trip first.")
                mentor["away"].append(self._away_entry("Coach"))
                mentor["away"].sort(key=lambda a: a["from"])
            elif op == "away_remove":
                away_id = self._id(self.body.get("awayId"), "trip")
                mentor["away"] = [a for a in mentor["away"] if a["id"] != away_id]
            else:
                raise ApiError(400, "Bad request.")
        self._set_json("team:mentors", mentors)
        self._send(200, {"ok": True, "mentors": mentors})
