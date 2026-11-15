"""pybricks.robotics — drive bases and cars."""
import math as _math

from ._sim import S, TASK, Op, then_name
from .parameters import Stop


class _Ctl:
    def limits(self, *a, **k):
        return None

    def pid(self, *a, **k):
        return None

    def target_tolerances(self, *a, **k):
        return None

    def stall_tolerances(self, *a, **k):
        return None


class DriveBase:
    """A robot with two powered wheels and one free pivot wheel or ball caster."""

    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        from .pupdevices import Motor
        if not isinstance(left_motor, Motor) or not isinstance(right_motor, Motor):
            raise TypeError('DriveBase needs two Motor objects')
        if wheel_diameter <= 0 or axle_track <= 0:
            raise ValueError('wheel_diameter and axle_track must be positive')
        self._l = left_motor
        self._r = right_motor
        S.dbNew(left_motor._port, left_motor._sign, right_motor._port, right_motor._sign,
                float(wheel_diameter), float(axle_track))
        self.distance_control = _Ctl()
        self.heading_control = _Ctl()

    def _await(self, wait):
        if TASK[0]:
            return Op(lambda: S.dbDone(), lambda: S.dbBrake())
        if wait:
            S.waitDB()

    # driving by a given distance or angle
    def straight(self, distance, then=Stop.HOLD, wait=True):
        S.dbStraight(float(distance), then_name(then))
        return self._await(wait)

    def turn(self, angle, then=Stop.HOLD, wait=True):
        S.dbTurn(float(angle), then_name(then))
        return self._await(wait)

    def curve(self, radius, angle, then=Stop.HOLD, wait=True):
        sd = (1 if radius >= 0 else -1) * abs(radius) * abs(angle) * _math.pi / 180
        S.dbCurve(float(sd), float(angle), then_name(then))
        return self._await(wait)

    def arc(self, radius, angle=None, distance=None, then=Stop.HOLD, wait=True):
        if (angle is None) == (distance is None):
            raise ValueError('give either angle or distance')
        if radius == 0:
            raise ValueError('radius must not be 0 (use turn() instead)')
        sign = 1 if radius > 0 else -1
        if angle is not None:
            sd = abs(radius) * angle * _math.pi / 180
            hd = sign * angle
        else:
            sd = distance
            hd = sign * distance / abs(radius) * 180 / _math.pi
        S.dbCurve(float(sd), float(hd), then_name(then))
        return self._await(wait)

    # driving forever
    def drive(self, speed, turn_rate):
        S.dbDrive(float(speed), float(turn_rate))

    def stop(self):
        S.dbStop()

    def brake(self):
        S.dbBrake()

    # measuring
    def distance(self):
        return int(round(S.dbDistance()))

    def angle(self):
        return int(round(S.dbAngle()))

    def state(self):
        return (self.distance(), int(round(S.dbSpeed())), self.angle(), int(round(S.dbRate())))

    def reset(self, distance=0, angle=0):
        S.dbReset(float(distance), float(angle))

    def done(self):
        return bool(S.dbDone())

    def stalled(self):
        return bool(S.dbStalled())

    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None):
        def first(x):
            if isinstance(x, (list, tuple)):
                return x[0]
            return x
        vals = [straight_speed, first(straight_acceleration), turn_rate, first(turn_acceleration)]
        res = S.dbSettings(*[(v if v is not None else -1) for v in vals]).to_py()
        if all(v is None for v in vals):
            return tuple(int(x) for x in res)

    def use_gyro(self, use_gyro):
        S.dbUseGyro(bool(use_gyro))


class GyroDriveBase(DriveBase):
    """A DriveBase that uses the hub's gyro to measure its heading."""

    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        super().__init__(left_motor, right_motor, wheel_diameter, axle_track)
        self.use_gyro(True)


class Car:
    """A vehicle with a steering motor and one or more drive motors."""

    def __init__(self, steer_motor, drive_motors, torque_limit=100):
        self._steer = steer_motor
        self._drive = list(drive_motors) if isinstance(drive_motors, (list, tuple)) else [drive_motors]
        left = steer_motor.run_until_stalled(-300, Stop.COAST)
        right = steer_motor.run_until_stalled(300, Stop.COAST)
        self._mid = (left + right) / 2
        self._range = abs(right - left) / 2
        steer_motor.run_target(300, self._mid)

    def steer(self, percentage):
        p = max(-100, min(100, percentage))
        self._steer.run_target(500, self._mid + p / 100 * self._range, wait=False)

    def drive_power(self, power):
        for m in self._drive:
            m.dc(power)

    def drive_speed(self, speed):
        for m in self._drive:
            m.run(speed)
