"""Bridge between the Pybricks API and the JavaScript robot simulator (internal)."""
import js

S = js.SIM

# True while run_task() is driving coroutines: methods then return awaitables
TASK = [False]

THEN = {}


def then_name(then):
    n = getattr(then, 'name', None)
    if n is None:
        return 'hold'
    return {'COAST': 'coast', 'COAST_SMART': 'coast', 'BRAKE': 'brake',
            'HOLD': 'hold', 'NONE': 'none'}.get(n, 'hold')


class Op:
    """Awaitable returned by motor, drive base and wait() calls inside run_task()."""

    __slots__ = ('_cond', '_cancel', '_result')

    def __init__(self, cond, cancel=None, result=None):
        self._cond = cond
        self._cancel = cancel
        self._result = result

    def __await__(self):
        finished = False
        try:
            while not self._cond():
                yield None
            finished = True
        finally:
            if not finished and self._cancel is not None:
                self._cancel()
        return self._result() if self._result else None

    __iter__ = __await__

    def __repr__(self):
        return '<awaitable>'


def tick():
    S.tick()


def no_device(port, wanted):
    from pybricks.parameters import Port
    labels = {
        'A': 'the left drive motor', 'B': 'the right drive motor', 'C': 'the arm motor',
        'D': 'a ColorSensor', 'E': 'an UltrasonicSensor', 'F': 'a ForceSensor',
    }
    name = getattr(port, 'name', str(port))
    have = labels.get(name, 'nothing')
    raise OSError(19, 'ENODEV: no {} found on Port.{} (this robot has {} there)'.format(wanted, name, have))


KINDS = {'A': 'motor', 'B': 'motor', 'C': 'motor', 'D': 'color', 'E': 'ultrasonic', 'F': 'force'}


def port_name(port, wanted, kind):
    from pybricks.parameters import Port
    if not isinstance(port, Port._Member):
        raise TypeError('port must be a Port, like Port.A')
    if KINDS.get(port.name) != kind:
        no_device(port, wanted)
    return port.name
