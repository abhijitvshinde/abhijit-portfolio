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


def _ports():
    import json
    return json.loads(S.portInfo())


def no_device(port, wanted):
    name = getattr(port, 'name', str(port))
    info = _ports().get(name)
    have = info['label'].split(' (')[0].lower() if info else 'nothing'
    if info and not have.startswith(('a ', 'the ')):
        have = ('the ' if info['kind'] == 'motor' else 'an ' if have[0] in 'aeiou' else 'a ') + have
    raise OSError(19, 'ENODEV: no {} found on Port.{} (this robot has {} there - check the Robot setup)'.format(wanted, name, have))


def port_name(port, wanted, kind):
    from pybricks.parameters import Port
    if not isinstance(port, Port._Member):
        raise TypeError('port must be a Port, like Port.A')
    info = _ports().get(port.name)
    if not info or info['kind'] != kind:
        no_device(port, wanted)
    return port.name
