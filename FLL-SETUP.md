# FLL Attachment Lab: setup

The **Kids Game** page (`game.html`) has two tabs:

- **What I Do Next?**: the original underwater-robot game.
- **FLL Attachment Lab**: kids pick a BIOGLOW mission and go through five steps: Explore, Detective, Pick a tool, Design (with a sketch pad) and Build & test.

Student logins and saved progress are handled by a small Python function (`api/fll.py`) and stored in an Upstash Redis database. Until the steps below are done, the lab still works in "guest" mode, but nothing is saved.

## One-time setup in Vercel

1. **Add a database.** In the Vercel dashboard, open the project, then go to **Storage** (or **Marketplace**). Choose **Upstash for Redis**, select the free plan, and connect it to this project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project automatically.
2. **Add the coach login.** Go to **Settings → Environment Variables** and add these two variables for Production and Preview:

   | Name | Value |
   |---|---|
   | `ADMIN_USERNAME` | your coach username, e.g. `coach` |
   | `ADMIN_PASSWORD` | a strong password that only you know (mark it **Sensitive**) |

   Optional: `SESSION_SECRET` (a long random string) signs login cookies. If you leave it out, a key is derived from the Redis token instead.

3. **Redeploy** the site (pushing to `main` does this).

## Using it

1. Open `https://www.abhijitvshinde.com/fll-coach.html` and log in with your `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
2. Add each student with their first name, team, username and password. A password is generated for you.
   Copy or print the login card right away: passwords are stored hashed, so they can't be shown again. You can always **Reset** a password.
3. Students go to **Kids Game → FLL Attachment Lab** and log in.
4. On the dashboard, the **Team progress** grid shows every student × mission. Click a name to see their answers, design notes, sketches and test logs.

Notes:

- Only the coach can see all students. Each student sees only their own work.
- Changing `ADMIN_PASSWORD` logs the coach out everywhere. Resetting a student's password logs that student out everywhere.
- After 8 wrong passwords for a username, that username is locked for 15 minutes.
- Use first names only. No other personal information is collected.

## Local testing

```bash
python tools/dev_server.py
```

Then open http://localhost:8000/game.html#fll. The local server stores data in `tools/.dev-store.json` (git-ignored) and uses the test coach login `coach` / `coach-test-pass`. Neither `tools/` nor this file is deployed (see `.vercelignore`).

## Updating mission content

All mission text, hints, the "right" moves and the recommended tools are in `fll-missions.js`. If FIRST publishes a Challenge Update, edit the matching mission there. Mission summaries are written in our own words. The official Robot Game Rulebook and Challenge Updates are always the authority.
