from pybricks._sim import S
from pybricks.tools import wait


def sleep(s):
    wait(s * 1000)


def sleep_ms(ms):
    wait(ms)


def ticks_ms():
    return int(S.time())


def ticks_diff(a, b):
    return a - b
