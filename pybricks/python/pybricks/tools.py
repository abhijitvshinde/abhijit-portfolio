"""pybricks.tools — timing, multitasking and linear algebra tools."""
import math as _math

from ._sim import S, TASK, Op


# ---------------- timing ----------------

def wait(time):
    """Pause the program for `time` milliseconds."""
    time = max(0, time)
    if TASK[0]:
        end = S.time() + time
        return Op(lambda: S.time() >= end - 1e-9)
    S.waitTime(time)


class StopWatch:
    """A stopwatch that measures time in milliseconds."""

    def __init__(self):
        self._start = S.time()
        self._paused_at = None

    def time(self):
        S.q()
        now = self._paused_at if self._paused_at is not None else S.time()
        return int(now - self._start)

    def pause(self):
        if self._paused_at is None:
            self._paused_at = S.time()

    def resume(self):
        if self._paused_at is not None:
            self._start += S.time() - self._paused_at
            self._paused_at = None

    def reset(self):
        self._start = S.time()
        if self._paused_at is not None:
            self._paused_at = self._start


# ---------------- multitasking ----------------

class multitask:
    """Run several awaitables at the same time. Use with ``await`` inside run_task()."""

    def __init__(self, *coroutines, race=False):
        self._coros = list(coroutines)
        self._race = race

    def __await__(self):
        coros = [c.__await__() if hasattr(c, '__await__') and not hasattr(c, 'send') else c for c in self._coros]
        n = len(coros)
        results = [None] * n
        done = [False] * n
        try:
            while True:
                for i, c in enumerate(coros):
                    if done[i]:
                        continue
                    try:
                        c.send(None)
                    except StopIteration as e:
                        done[i] = True
                        results[i] = e.value
                if all(done) or (self._race and any(done)):
                    break
                yield None
        finally:
            for i, c in enumerate(coros):
                if not done[i]:
                    try:
                        c.close()
                    except Exception:
                        pass
        return results

    __iter__ = __await__


def run_task(task):
    """Run a coroutine (an ``async def`` function call) until it finishes."""
    if TASK[0]:
        raise RuntimeError('run_task() is already running')
    TASK[0] = True
    it = task.__await__() if not hasattr(task, 'send') else task
    try:
        while True:
            try:
                it.send(None)
            except StopIteration as e:
                return e.value
            S.tick()
    finally:
        TASK[0] = False


def read_input_byte(last=False, chr=False):
    """No keyboard input in the simulator: always returns None."""
    S.q()
    return None


def hub_menu(*symbols):
    """The simulator has no buttons to press, so the first option is chosen."""
    if not symbols:
        raise ValueError('hub_menu needs at least one option')
    return symbols[0]


# ---------------- linear algebra ----------------

class Matrix:
    """Small matrix type, compatible with pybricks.tools.Matrix."""

    def __init__(self, rows):
        r = [list(map(float, row)) if isinstance(row, (list, tuple)) else [float(row)] for row in rows]
        if not r or any(len(x) != len(r[0]) for x in r):
            raise ValueError('rows must be lists of the same length')
        self._r = r

    @property
    def shape(self):
        return (len(self._r), len(self._r[0]))

    @property
    def T(self):
        m, n = self.shape
        return Matrix([[self._r[i][j] for i in range(m)] for j in range(n)])

    def __len__(self):
        m, n = self.shape
        return m * n if (m == 1 or n == 1) else m

    def __getitem__(self, key):
        if isinstance(key, tuple):
            return self._r[key[0]][key[1]]
        m, n = self.shape
        if n == 1:
            return self._r[key][0]
        if m == 1:
            return self._r[0][key]
        raise IndexError('use [row, column] for matrices')

    def __iter__(self):
        m, n = self.shape
        if n == 1:
            return iter([row[0] for row in self._r])
        if m == 1:
            return iter(self._r[0])
        return iter([Matrix([row]) for row in self._r])

    def _ew(self, other, f):
        if isinstance(other, Matrix):
            if other.shape != self.shape:
                raise ValueError('shapes do not match')
            return Matrix([[f(a, b) for a, b in zip(r1, r2)] for r1, r2 in zip(self._r, other._r)])
        return Matrix([[f(a, other) for a in r] for r in self._r])

    def __add__(self, o):
        return self._ew(o, lambda a, b: a + b)

    __radd__ = __add__

    def __sub__(self, o):
        return self._ew(o, lambda a, b: a - b)

    def __rsub__(self, o):
        return self._ew(o, lambda a, b: b - a)

    def __neg__(self):
        return self * -1

    def __mul__(self, o):
        if isinstance(o, Matrix):
            m, n = self.shape
            n2, p = o.shape
            if n != n2:
                raise ValueError('shapes do not match')
            return Matrix([[sum(self._r[i][k] * o._r[k][j] for k in range(n)) for j in range(p)] for i in range(m)])
        return self._ew(o, lambda a, b: a * b)

    def __rmul__(self, o):
        return self._ew(o, lambda a, b: a * b)

    __matmul__ = __mul__

    def __truediv__(self, o):
        return self._ew(o, lambda a, b: a / b)

    def __abs__(self):
        return _math.sqrt(sum(a * a for row in self._r for a in row))

    def __eq__(self, o):
        return isinstance(o, Matrix) and o._r == self._r

    def __repr__(self):
        return 'Matrix([\n' + ''.join('    [' + ', '.join('{:.3g}'.format(a) for a in row) + '],\n' for row in self._r) + '])'


def vector(x, y, z=None):
    """Make a column vector with 2 or 3 elements."""
    return Matrix([[x], [y]] if z is None else [[x], [y], [z]])


def cross(a, b):
    """Cross product of two 3D vectors."""
    return vector(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
