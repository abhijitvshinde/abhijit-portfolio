"""Runs a user program inside the simulator (internal)."""
import builtins
import json
import sys
import time as _time
import traceback

_OWN = ('pybricks', 'umath', 'urandom', 'ustruct', 'uerrno', 'usys', 'ujson', 'utime', 'micropython')


def run(code):
    import js
    S = js.SIM
    for name in list(sys.modules):
        if name.split('.')[0] in _OWN:
            del sys.modules[name]

    orig_print = builtins.print
    orig_input = builtins.input
    orig_sleep = _time.sleep

    def sim_print(*args, sep=' ', end='\n', file=None, flush=False):
        S.emitPrint(sep.join(str(a) for a in args) + end)

    def sim_input(prompt=''):
        raise OSError('input() is not available in the simulator')

    def sim_sleep(seconds):
        S.waitTime(seconds * 1000)

    builtins.print = sim_print
    builtins.input = sim_input
    _time.sleep = sim_sleep
    result = {'ok': True}
    try:
        compiled = compile(code, 'main.py', 'exec')
        exec(compiled, {'__name__': '__main__'})
    except SystemExit:
        pass
    except BaseException as e:  # noqa: B902 — report everything to the user
        msg = str(e)
        if 'SIM_TIMEUP' in msg:
            result = {'ok': True, 'timeup': True}
        else:
            line = None
            if isinstance(e, SyntaxError) and e.filename == 'main.py':
                line = e.lineno
            frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == 'main.py']
            if frames:
                line = frames[-1].lineno
            src = code.splitlines()
            text = 'Traceback (most recent call last):\n'
            for f in frames:
                text += '  File "main.py", line {}, in {}\n'.format(f.lineno, f.name)
                if f.lineno and 0 < f.lineno <= len(src) and src[f.lineno - 1].strip():
                    text += '    ' + src[f.lineno - 1].strip() + '\n'
            text += ''.join(traceback.format_exception_only(type(e), e))
            result = {'ok': False, 'error': text, 'line': line}
    finally:
        builtins.print = orig_print
        builtins.input = orig_input
        _time.sleep = orig_sleep
    return json.dumps(result)
