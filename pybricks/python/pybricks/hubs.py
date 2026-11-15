"""pybricks.hubs — the programmable hub. The simulated robot uses a SPIKE Prime hub."""
import json as _json

from ._sim import S, TASK, Op
from .parameters import Color, Side, Button, Axis
from .tools import Matrix, vector, wait


def _emit(kind, **data):
    S.emit(kind, _json.dumps(data))


def _color_json(c):
    if c is None:
        return None
    return [c.h, c.s, c.v]


# 5x5 font, each row is 5 bits (leftmost pixel = 16)
_FONT = {
    '0': (14, 19, 21, 25, 14), '1': (4, 12, 4, 4, 14), '2': (14, 1, 14, 16, 31), '3': (30, 1, 14, 1, 30),
    '4': (18, 18, 31, 2, 2), '5': (31, 16, 30, 1, 30), '6': (14, 16, 30, 17, 14), '7': (31, 1, 2, 4, 4),
    '8': (14, 17, 14, 17, 14), '9': (14, 17, 15, 1, 14),
    'A': (14, 17, 31, 17, 17), 'B': (30, 17, 30, 17, 30), 'C': (15, 16, 16, 16, 15), 'D': (30, 17, 17, 17, 30),
    'E': (31, 16, 30, 16, 31), 'F': (31, 16, 30, 16, 16), 'G': (15, 16, 19, 17, 15), 'H': (17, 17, 31, 17, 17),
    'I': (14, 4, 4, 4, 14), 'J': (7, 2, 2, 18, 12), 'K': (18, 20, 24, 20, 18), 'L': (16, 16, 16, 16, 31),
    'M': (17, 27, 21, 17, 17), 'N': (17, 25, 21, 19, 17), 'O': (14, 17, 17, 17, 14), 'P': (30, 17, 30, 16, 16),
    'Q': (14, 17, 21, 18, 13), 'R': (30, 17, 30, 18, 17), 'S': (15, 16, 14, 1, 30), 'T': (31, 4, 4, 4, 4),
    'U': (17, 17, 17, 17, 14), 'V': (17, 17, 17, 10, 4), 'W': (17, 17, 21, 27, 17), 'X': (17, 10, 4, 10, 17),
    'Y': (17, 10, 4, 4, 4), 'Z': (31, 2, 4, 8, 31), ' ': (0, 0, 0, 0, 0), '!': (4, 4, 4, 0, 4),
    '?': (14, 1, 6, 0, 4), '.': (0, 0, 0, 0, 4), ',': (0, 0, 0, 4, 8), '-': (0, 0, 14, 0, 0), '+': (0, 4, 14, 4, 0),
    ':': (0, 4, 0, 4, 0), '=': (0, 14, 0, 14, 0), '/': (1, 2, 4, 8, 16), '*': (0, 10, 4, 10, 0),
    '(': (2, 4, 4, 4, 2), ')': (8, 4, 4, 4, 8), "'": (4, 4, 0, 0, 0), '<': (2, 4, 8, 4, 2), '>': (8, 4, 2, 4, 8),
}


def _glyph(ch):
    rows = _FONT.get(ch.upper(), _FONT['?'])
    return [[100 if (r >> (4 - c)) & 1 else 0 for c in range(5)] for r in rows]


class _Light:
    def on(self, color):
        if not isinstance(color, Color):
            raise TypeError('color must be a Color, like Color.RED')
        _emit('light', mode='on', color=_color_json(color))

    def off(self):
        _emit('light', mode='on', color=None)

    def blink(self, color, durations):
        _emit('light', mode='blink', color=_color_json(color), durations=list(durations))

    def animate(self, colors, interval):
        _emit('light', mode='animate', colors=[_color_json(c) for c in colors], interval=interval)


class _Display:
    def __init__(self):
        self._px = [[0] * 5 for _ in range(5)]
        self._up = Side.TOP

    def _show(self, label=None):
        _emit('display', pixels=self._px, label=label)

    def orientation(self, up):
        self._up = up

    def off(self):
        self._px = [[0] * 5 for _ in range(5)]
        self._show()

    def pixel(self, row, column, brightness=100):
        if not (0 <= row < 5 and 0 <= column < 5):
            raise ValueError('row and column must be 0 to 4')
        self._px[row][column] = max(0, min(100, brightness))
        self._show()

    def icon(self, icon):
        self._px = [[max(0, min(100, int(icon[r, c]))) for c in range(5)] for r in range(5)]
        self._show()

    def animate(self, matrices, interval):
        frames = [[[max(0, min(100, int(m[r, c]))) for c in range(5)] for r in range(5)] for m in matrices]
        _emit('display', frames=frames, interval=interval)

    def char(self, char):
        if not isinstance(char, str) or len(char) != 1:
            raise ValueError('char() needs a single character')
        self._px = _glyph(char)
        self._show()

    def number(self, number):
        n = int(round(number))
        if not -99 <= n <= 99:
            raise ValueError('number must be -99 to 99')
        if 0 <= n <= 9:
            self._px = _glyph(str(n))
            self._show()
        else:
            self._px = [[0] * 5 for _ in range(5)]
            self._show(label=str(n))

    def text(self, text, on=500, off=50):
        """Show text one character at a time. This waits until the text is done."""
        if TASK[0]:
            async def _scroll():
                for ch in str(text):
                    self._px = _glyph(ch)
                    self._show()
                    await wait(on)
                    self.off()
                    await wait(off)
            return _scroll()
        for ch in str(text):
            self._px = _glyph(ch)
            self._show()
            wait(on)
            self.off()
            wait(off)

    def textsync(self, text, on=500, off=50):
        self.text(text, on, off)


_NOTE = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def _note_freq(note):
    # e.g. 'C4/4', 'F#5/8.', 'R/4' (rest)
    name, _, dur = note.partition('/')
    frac = 4
    dotted = dur.endswith('.')
    try:
        frac = int(dur.rstrip('._')) if dur else 4
    except ValueError:
        raise ValueError('bad note: ' + note)
    beats = 4 / frac * (1.5 if dotted else 1)
    if name.upper().startswith('R'):
        return 0, beats
    letter = name[0].upper()
    if letter not in _NOTE:
        raise ValueError('bad note: ' + note)
    rest = name[1:]
    semis = _NOTE[letter]
    if rest.startswith('#'):
        semis += 1
        rest = rest[1:]
    elif rest.startswith('b'):
        semis -= 1
        rest = rest[1:]
    octave = int(rest) if rest else 4
    return 440 * 2 ** ((semis + (octave - 4) * 12) / 12), beats


class _Speaker:
    def __init__(self):
        self._vol = 100

    def volume(self, volume=None):
        if volume is None:
            return self._vol
        self._vol = max(0, min(100, volume))

    def beep(self, frequency=500, duration=100):
        _emit('beep', f=frequency, d=max(0, duration), v=self._vol)
        if duration > 0:
            if TASK[0]:
                return wait(duration)
            wait(duration)

    def play_notes(self, notes, tempo=120):
        beat_ms = 60000 / tempo
        seq = [_note_freq(n) for n in notes]
        if TASK[0]:
            async def _play():
                for f, beats in seq:
                    if f:
                        _emit('beep', f=f, d=beats * beat_ms * 0.9, v=self._vol)
                    await wait(beats * beat_ms)
            return _play()
        for f, beats in seq:
            if f:
                _emit('beep', f=f, d=beats * beat_ms * 0.9, v=self._vol)
            wait(beats * beat_ms)


class _Buttons:
    def pressed(self):
        S.q()
        return set()


class _IMU:
    def __init__(self):
        self._settings = (1.5, 250, 360, 360)

    def ready(self):
        return True

    def stationary(self):
        return abs(S.yawRateDeg()) < 1

    def up(self, calibrated=True):
        return Side.TOP

    def tilt(self, calibrated=True):
        S.q()
        return (0, 0)

    def acceleration(self, axis=None, calibrated=True):
        S.q()
        v = vector(0, 0, 9810)
        return v if axis is None else sum(a * b for a, b in zip(v, axis))

    def angular_velocity(self, axis=None, calibrated=True):
        w = vector(0, 0, -S.yawRateDeg())
        return w if axis is None else sum(a * b for a, b in zip(w, axis))

    def heading(self):
        return S.heading()

    def reset_heading(self, angle):
        S.resetHeading(float(angle))

    def rotation(self, axis, calibrated=True):
        z = sum(a * b for a, b in zip(vector(0, 0, 1), axis))
        return -S.heading() * z

    def orientation(self):
        import math
        h = -S.heading() * math.pi / 180
        c, s = math.cos(h), math.sin(h)
        return Matrix([[c, -s, 0], [s, c, 0], [0, 0, 1]])

    def settings(self, *args, **kwargs):
        if not args and not kwargs:
            return self._settings


class _Battery:
    def voltage(self):
        return 8200

    def current(self):
        return 180


class _Charger:
    def connected(self):
        return False

    def status(self):
        return 0

    def current(self):
        return 0


class _System:
    def __init__(self):
        self._store = bytearray(512)

    def name(self):
        return 'Pybricks Sim'

    def set_stop_button(self, button):
        pass

    def shutdown(self):
        raise SystemExit('shutdown')

    def reset_reason(self):
        return 0

    def info(self):
        return {'name': 'Pybricks Sim', 'reset_reason': 0, 'host_connected_ble': True, 'program_start_type': 1}

    def storage(self, offset, read=None, write=None):
        if write is not None:
            self._store[offset:offset + len(write)] = write
            return None
        return bytes(self._store[offset:offset + (read or 0)])


class _BLE:
    def broadcast(self, data):
        pass

    def observe(self, channel):
        return None

    def signal_strength(self, channel):
        return -128

    def version(self):
        return 'sim'


class PrimeHub:
    """LEGO SPIKE Prime hub: 5x5 light matrix, speaker, buttons, gyro."""

    def __init__(self, top_side=Side.TOP, front_side=Side.FRONT, broadcast_channel=None, observe_channels=None):
        self.light = _Light()
        self.display = _Display()
        self.speaker = _Speaker()
        self.buttons = _Buttons()
        self.imu = _IMU()
        self.battery = _Battery()
        self.charger = _Charger()
        self.system = _System()
        self.ble = _BLE()


InventorHub = PrimeHub


class EssentialHub(PrimeHub):
    """SPIKE Essential hub (no light matrix or speaker)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        del self.display
        del self.speaker


class TechnicHub(EssentialHub):
    pass


class CityHub(EssentialHub):
    pass


class MoveHub(EssentialHub):
    pass


ThisHub = PrimeHub
