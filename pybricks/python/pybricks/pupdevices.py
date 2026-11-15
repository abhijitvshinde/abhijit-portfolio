"""pybricks.pupdevices — motors and sensors for Powered Up hubs (SPIKE, Technic, ...)."""
from ._sim import S, TASK, Op, then_name, port_name, no_device
from .parameters import Direction, Stop, Color, Port


def _ratio(gears):
    if not gears:
        return 1.0
    trains = gears if isinstance(gears[0], (list, tuple)) else [gears]
    r = 1.0
    for t in trains:
        if len(t) < 2:
            raise ValueError('a gear train needs at least two gears')
        r *= t[-1] / t[0]
    return r


class _Lights:
    def __init__(self, n=1):
        self._n = n

    def on(self, brightness=100):
        pass

    def off(self):
        pass


class Control:
    """Motor controller settings (motor.control)."""

    def __init__(self, motor):
        self._m = motor
        self._tol = (50, 3)
        self._stall = (20, 200)
        self._pid = (12000, 0, 0, 0, 0, 0, 0)
        self._torque = 560
        self.scale = 1

    def limits(self, speed=None, acceleration=None, torque=None):
        r = self._m._ratio
        if torque is not None:
            self._torque = torque
        if isinstance(acceleration, (list, tuple)):
            acceleration = acceleration[0]
        res = S.mLimits(self._m._port, (speed or 0) * r, (acceleration or 0) * r).to_py()
        if speed is None and acceleration is None and torque is None:
            return (int(res[0] / r), int(res[1] / r), self._torque)

    def pid(self, kp=None, ki=None, kd=None, integral_deadzone=None, integral_rate=None):
        if kp is None and ki is None and kd is None:
            return self._pid

    def target_tolerances(self, speed=None, position=None):
        if speed is None and position is None:
            return self._tol
        self._tol = (speed if speed is not None else self._tol[0], position if position is not None else self._tol[1])

    def stall_tolerances(self, speed=None, time=None):
        if speed is None and time is None:
            return self._stall
        self._stall = (speed if speed is not None else self._stall[0], time if time is not None else self._stall[1])


class _Model:
    def state(self):
        m = self._m
        return (m.angle(), m.speed(), 0, m.stalled())

    def settings(self, *args):
        return ()

    def __init__(self, motor):
        self._m = motor


class DCMotor:
    """A motor without rotation sensors (on this robot: any of Port.A, B, C)."""

    def __init__(self, port, positive_direction=Direction.CLOCKWISE):
        self._port = port_name(port, 'DCMotor', 'motor')
        self._sign = -1 if positive_direction == Direction.COUNTERCLOCKWISE else 1
        S.mAttach(self._port)

    def dc(self, duty):
        S.mDc(self._port, max(-100, min(100, duty)) * self._sign)

    def stop(self):
        S.mStop(self._port)

    def brake(self):
        S.mBrake(self._port)

    def settings(self, max_voltage=None):
        if max_voltage is None:
            return (9000,)

    def close(self):
        pass


class Motor(DCMotor):
    """A motor with rotation sensors: SPIKE / Technic motors on Port.A, B or C."""

    def __init__(self, port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None):
        self._port = port_name(port, 'Motor', 'motor')
        self._sign = -1 if positive_direction == Direction.COUNTERCLOCKWISE else 1
        self._ratio = _ratio(gears)
        S.mAttach(self._port)
        self._offset = 0.0
        if reset_angle:
            self.reset_angle()
        else:
            self._offset = 0.0
        self.control = Control(self)
        self.model = _Model(self)

    # unit conversion: user degrees <-> motor shaft degrees
    def _user(self, raw):
        return self._sign * raw / self._ratio + self._offset

    def _raw(self, user):
        return (user - self._offset) * self._ratio * self._sign

    def _rs(self, speed):
        return speed * self._ratio * self._sign

    # measurements
    def angle(self):
        return int(round(self._user(S.mAngle(self._port))))

    def speed(self, window=100):
        return int(round(self._sign * S.mSpeed(self._port) / self._ratio))

    def load(self):
        return int(S.mLoad(self._port))

    def stalled(self):
        return bool(S.mStalled(self._port))

    def done(self):
        return bool(S.mDone(self._port))

    def reset_angle(self, angle=None):
        raw = S.mAngle(self._port)
        if angle is None:
            # absolute position, -180..179, like a real SPIKE motor
            a = self._sign * raw / self._ratio
            angle = ((a + 180) % 360) - 180
            self._offset = angle - self._sign * raw / self._ratio
        else:
            self._offset = angle - self._sign * raw / self._ratio

    # stopping
    def hold(self):
        S.mHold(self._port)

    # running
    def run(self, speed):
        S.mRun(self._port, self._rs(speed))

    def _await(self, wait):
        p = self._port
        if TASK[0]:
            return Op(lambda: S.mDone(p), lambda: S.mHold(p))
        if wait:
            S.waitMotor(p, 0)

    def run_time(self, speed, time, then=Stop.HOLD, wait=True):
        S.mRunTime(self._port, self._rs(speed), max(0, time), then_name(then))
        return self._await(wait)

    def run_angle(self, speed, rotation_angle, then=Stop.HOLD, wait=True):
        direction = -1 if speed < 0 else 1
        target = S.mBase(self._port) + direction * rotation_angle * self._ratio * self._sign
        S.mRunTarget(self._port, abs(speed) * self._ratio, target, then_name(then))
        return self._await(wait)

    def run_target(self, speed, target_angle, then=Stop.HOLD, wait=True):
        S.mRunTarget(self._port, abs(speed) * self._ratio, self._raw(target_angle), then_name(then))
        return self._await(wait)

    def run_until_stalled(self, speed, then=Stop.COAST, duty_limit=None):
        p = self._port
        S.mRunUntilStalled(p, self._rs(speed), then_name(then))
        if TASK[0]:
            return Op(lambda: S.mDone(p), lambda: S.mHold(p), self.angle)
        S.waitMotor(p, 1)
        return self.angle()

    def track_target(self, target_angle):
        S.mTrack(self._port, self._raw(target_angle))


class ColorSensor:
    """SPIKE Color Sensor. On this robot: Port.D, pointing down at the mat."""

    def __init__(self, port):
        self._port = port_name(port, 'ColorSensor', 'color')
        self._detectable = [Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE, Color.WHITE, Color.BLACK, Color.NONE]
        self.lights = _Lights(3)

    def _read(self):
        return S.color().to_py()

    def hsv(self, surface=True):
        h, s, v, refl, amb, name = self._read()
        return Color(h, s, v)

    def color(self, surface=True):
        m = self.hsv(surface)
        best, cost = Color.NONE, 1e9
        for c in self._detectable:
            if c.s < 20 or c.v == 0:
                k = abs(m.v - c.v) + m.s * 0.8
            else:
                dh = abs(m.h - c.h)
                dh = min(dh, 360 - dh)
                k = dh * 1.2 + abs(m.s - c.s) * 0.3 + abs(m.v - c.v) * 0.3 + (60 if m.s < 25 else 0)
            if k < cost:
                best, cost = c, k
        return best

    def reflection(self):
        return int(self._read()[3])

    def ambient(self):
        return int(self._read()[4])

    def detectable_colors(self, colors=None):
        if colors is None:
            return tuple(self._detectable)
        self._detectable = list(colors)


class UltrasonicSensor:
    """SPIKE Distance Sensor. On this robot: Port.E, facing forward, 55 mm above the floor."""

    def __init__(self, port):
        self._port = port_name(port, 'UltrasonicSensor', 'ultrasonic')
        self.lights = _Lights(4)

    def distance(self):
        return int(S.ultra())

    def presence(self):
        S.q()
        return False


class ForceSensor:
    """SPIKE Force Sensor. On this robot: Port.F, the button is the tip of the arm."""

    def __init__(self, port):
        self._port = port_name(port, 'ForceSensor', 'force')

    def force(self):
        return round(float(S.force().to_py()[0]), 2)

    def distance(self):
        return round(float(S.force().to_py()[1]), 2)

    def pressed(self, force=3):
        return self.force() >= force

    def touched(self):
        return bool(S.force().to_py()[2])


def _absent(name):
    class _Absent:
        def __init__(self, port=None, *args, **kwargs):
            no_device(port if port is not None else Port.A, name)
    _Absent.__name__ = name
    _Absent.__qualname__ = name
    return _Absent


ColorDistanceSensor = _absent('ColorDistanceSensor')
InfraredSensor = _absent('InfraredSensor')
TiltSensor = _absent('TiltSensor')
Light = _absent('Light')
ColorLightMatrix = _absent('ColorLightMatrix')
PFMotor = _absent('PFMotor')


class Remote:
    def __init__(self, name=None, timeout=10000):
        raise OSError(110, 'ETIMEDOUT: no Powered Up remote found (the simulator has none)')
