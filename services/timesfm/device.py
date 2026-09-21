"""Safe device and CUDA diagnostics for the local TimesFM service."""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DeviceInfo:
    requested: str
    selected: str
    cuda_available: bool
    gpu_name: str | None
    torch_cuda_build: str | None
    vram_total_mb: int | None
    vram_free_mb: int | None
    fallback_reason: str | None

    def as_dict(self):
        return {
            "device_requested": self.requested,
            "device_selected": self.selected,
            "cuda_available": self.cuda_available,
            "gpu_name": self.gpu_name,
            "torch_cuda_build": self.torch_cuda_build,
            "vram_total_mb": self.vram_total_mb,
            "vram_free_mb": self.vram_free_mb,
            "fallback_reason": self.fallback_reason,
        }


def _smi_info():
    windows_root = Path(os.environ.get("WINDIR", r"C:\Windows"))
    candidates = [
        shutil.which("nvidia-smi"),
        str(windows_root / "System32" / "nvidia-smi.exe"),
        *[str(path) for path in (windows_root / "System32" / "DriverStore" / "FileRepository").glob("nvami.inf_amd64_*/nvidia-smi.exe")],
    ]
    for candidate in candidates:
        if not candidate:
            continue
        try:
            result = subprocess.run([candidate, "--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=3, check=True)
            name, total, free = [value.strip() for value in result.stdout.strip().splitlines()[0].split(',', 2)]
            return name, int(float(total)), int(float(free))
        except (OSError, subprocess.SubprocessError, IndexError, ValueError):
            continue
    return None, None, None


def _gpu_name_from_smi() -> str | None:
    return _smi_info()[0]


def resolve_device(requested: str | None = None, require_cuda: bool | None = None) -> DeviceInfo:
    requested = (requested or os.environ.get("TIMESFM_DEVICE", "auto")).strip().lower()
    if requested not in {"auto", "cpu", "cuda"}:
        raise ValueError("TIMESFM_DEVICE must be auto, cpu, or cuda")
    require = require_cuda if require_cuda is not None else os.environ.get("TIMESFM_REQUIRE_CUDA", "false").lower() == "true"
    smi_name, smi_total_mb, smi_free_mb = _smi_info()
    gpu_name = smi_name
    try:
        import torch
        torch_cuda_build = torch.version.cuda
        cuda_available = bool(torch.cuda.is_available())
    except Exception as error:  # pragma: no cover - import failure is environment-specific
        torch_cuda_build = None
        cuda_available = False
        import_error = str(error)
    else:
        import_error = None

    reason = None
    if requested == "cpu":
        selected = "cpu"
        if require:
            raise RuntimeError("TIMESFM_REQUIRE_CUDA=true conflicts with TIMESFM_DEVICE=cpu")
    elif cuda_available:
        selected = "cuda"
    elif requested == "cuda" or require:
        reason = import_error or "CUDA is unavailable in the installed PyTorch build."
        raise RuntimeError(reason)
    else:
        selected = "cpu"
        reason = import_error or "CUDA is unavailable in the installed PyTorch build; using CPU fallback."

    total_mb, free_mb = smi_total_mb, smi_free_mb
    if selected == "cuda":
        try:
            free_bytes, total_bytes = torch.cuda.mem_get_info()
            total_mb, free_mb = int(total_bytes // (1024 * 1024)), int(free_bytes // (1024 * 1024))
            gpu_name = gpu_name or torch.cuda.get_device_name(0)
        except Exception as error:  # pragma: no cover - hardware-specific
            if requested == "cuda" or require:
                raise RuntimeError(f"CUDA device initialization failed: {error}") from error
            selected = "cpu"
            reason = f"CUDA device initialization failed; using CPU fallback: {error}"
    return DeviceInfo(requested, selected, cuda_available, gpu_name, torch_cuda_build, total_mb, free_mb, reason)
