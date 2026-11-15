"""Minimal micropython module for compatibility."""


def const(x):
    return x


def native(f):
    return f


viper = native


def mem_info(*args):
    print('mem: simulated')


def kbd_intr(chr):
    pass
