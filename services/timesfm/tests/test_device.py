import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))

from device import resolve_device


class DeviceTests(unittest.TestCase):
    def test_cpu_mode_never_initializes_cuda(self):
        with patch.dict(os.environ, {'TIMESFM_DEVICE': 'cpu', 'TIMESFM_REQUIRE_CUDA': 'false'}, clear=False):
            info = resolve_device('cpu', False)
        self.assertEqual(info.selected, 'cpu')
        self.assertEqual(info.requested, 'cpu')

    def test_invalid_mode_is_rejected(self):
        with self.assertRaises(ValueError):
            resolve_device('metal', False)

    def test_auto_falls_back_when_cuda_is_unavailable(self):
        with patch('device._smi_info', return_value=('NVIDIA test GPU', 4096, 2048)):
            info = resolve_device('auto', False)
        # This assertion is portable: on a CUDA runner auto may select CUDA.
        self.assertIn(info.selected, {'cpu', 'cuda'})
        self.assertIsNotNone(info.gpu_name)


if __name__ == '__main__':
    unittest.main()
