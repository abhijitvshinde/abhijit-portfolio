"""pybricks.parameters — constant parameters and values."""
from .tools import Matrix, vector


class _EnumMeta(type):
    def __iter__(cls):
        return iter(cls._members)

    def __repr__(cls):
        return "<class '{}'>".format(cls.__name__)


class _Member:
    __slots__ = ('_cls', 'name', 'value')

    def __init__(self, cls, name, value):
        self._cls = cls
        self.name = name
        self.value = value

    def __repr__(self):
        return '{}.{}'.format(self._cls, self.name)

    __str__ = __repr__

    def __hash__(self):
        return hash((self._cls, self.name))

    def __eq__(self, other):
        return isinstance(other, _Member) and other._cls == self._cls and other.name == self.name


def _make(name, members, base=_Member):
    sub = type(name + 'Member', (base,), {'__slots__': ()})
    cls = _EnumMeta(name, (), {'_Member': sub, '_members': []})
    for i, m in enumerate(members):
        mem = sub(name, m, i)
        setattr(cls, m, mem)
        cls._members.append(mem)
    return cls


Port = _make('Port', ['A', 'B', 'C', 'D', 'E', 'F', 'S1', 'S2', 'S3', 'S4'])
Direction = _make('Direction', ['CLOCKWISE', 'COUNTERCLOCKWISE'])
Stop = _make('Stop', ['COAST', 'COAST_SMART', 'BRAKE', 'HOLD', 'NONE'])
Button = _make('Button', ['CENTER', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'BLUETOOTH', 'BEACON',
                          'LEFT_PLUS', 'LEFT_MINUS', 'RIGHT_PLUS', 'RIGHT_MINUS',
                          'LEFT_UP', 'LEFT_DOWN', 'RIGHT_UP', 'RIGHT_DOWN',
                          'A', 'B', 'X', 'Y', 'LB', 'RB', 'VIEW', 'MENU', 'GUIDE', 'UPLOAD'])
Side = _make('Side', ['TOP', 'BOTTOM', 'FRONT', 'BACK', 'LEFT', 'RIGHT'])


class Axis:
    X = vector(1, 0, 0)
    Y = vector(0, 1, 0)
    Z = vector(0, 0, 1)


class Color:
    """A color, given by hue (0-359), saturation (0-100) and brightness value (0-100)."""

    def __init__(self, h, s=100, v=100):
        self.h = int(h) % 360
        self.s = max(0, min(100, int(s)))
        self.v = max(0, min(100, int(v)))
        self._name = None

    def __repr__(self):
        if self._name:
            return 'Color.' + self._name
        return 'Color(h={}, s={}, v={})'.format(self.h, self.s, self.v)

    __str__ = __repr__

    def __eq__(self, other):
        return isinstance(other, Color) and (self.h, self.s, self.v) == (other.h, other.s, other.v)

    def __hash__(self):
        return hash((self.h, self.s, self.v))

    def __mul__(self, k):
        return Color(self.h, self.s, self.v * k)

    __rmul__ = __mul__

    def __truediv__(self, k):
        return Color(self.h, self.s, self.v / k)

    __floordiv__ = __truediv__

    def __rshift__(self, n):
        return Color(self.h + n, self.s, self.v)

    def __lshift__(self, n):
        return Color(self.h - n, self.s, self.v)

    def __iter__(self):
        return iter((self.h, self.s, self.v))


for _n, _hsv in [('NONE', (0, 0, 0)), ('BLACK', (0, 0, 10)), ('GRAY', (0, 0, 50)), ('WHITE', (0, 0, 100)),
                 ('RED', (0, 100, 100)), ('ORANGE', (30, 100, 100)), ('BROWN', (30, 100, 50)),
                 ('YELLOW', (60, 100, 100)), ('GREEN', (120, 100, 100)), ('CYAN', (180, 100, 100)),
                 ('BLUE', (240, 100, 100)), ('VIOLET', (270, 100, 100)), ('MAGENTA', (300, 100, 100))]:
    _c = Color(*_hsv)
    _c._name = _n
    setattr(Color, _n, _c)


def _icon(*rows):
    return Matrix([[100 if (r >> (4 - c)) & 1 else 0 for c in range(5)] for r in rows])


class Icon:
    UP = _icon(4, 14, 21, 4, 4)
    DOWN = _icon(4, 4, 21, 14, 4)
    LEFT = _icon(4, 8, 31, 8, 4)
    RIGHT = _icon(4, 2, 31, 2, 4)
    ARROW_UP = UP
    ARROW_DOWN = DOWN
    ARROW_LEFT = LEFT
    ARROW_RIGHT = RIGHT
    ARROW_RIGHT_UP = _icon(15, 3, 5, 9, 16)
    ARROW_RIGHT_DOWN = _icon(16, 9, 5, 3, 15)
    ARROW_LEFT_UP = _icon(30, 24, 20, 18, 1)
    ARROW_LEFT_DOWN = _icon(1, 18, 20, 24, 30)
    HEART = _icon(10, 31, 31, 14, 4)
    HAPPY = _icon(0, 10, 0, 17, 14)
    SAD = _icon(0, 10, 0, 14, 17)
    EYE_LEFT = _icon(0, 0, 24, 24, 0)
    EYE_RIGHT = _icon(0, 0, 3, 3, 0)
    SQUARE = _icon(31, 17, 17, 17, 31)
    CIRCLE = _icon(14, 17, 17, 17, 14)
    TRIANGLE_UP = _icon(0, 4, 10, 31, 0)
    TRIANGLE_DOWN = _icon(0, 31, 10, 4, 0)
    TRIANGLE_LEFT = _icon(2, 6, 10, 6, 2)
    TRIANGLE_RIGHT = _icon(8, 12, 10, 12, 8)
    PAUSE = _icon(27, 27, 27, 27, 27)
    TRUE = _icon(0, 1, 2, 20, 8)
    FALSE = _icon(17, 10, 4, 10, 17)
    CLOCKWISE = _icon(14, 17, 21, 1, 30)
    COUNTERCLOCKWISE = _icon(14, 17, 21, 16, 15)
    EMPTY = _icon(0, 0, 0, 0, 0)
    FULL = _icon(31, 31, 31, 31, 31)
