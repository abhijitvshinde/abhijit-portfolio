"""pybricks.iodevices — generic devices. Not attached to the simulated robot."""
from ._sim import no_device


class PUPDevice:
    def __init__(self, port):
        no_device(port, 'PUPDevice')


class LWP3Device:
    def __init__(self, *args, **kwargs):
        raise OSError(110, 'ETIMEDOUT: no Bluetooth devices in the simulator')


class XboxController:
    def __init__(self, *args, **kwargs):
        raise OSError(110, 'ETIMEDOUT: no Xbox controller in the simulator')
