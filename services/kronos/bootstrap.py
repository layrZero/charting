"""Fetch and verify the pinned Kronos source checkout."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

SOURCE = "https://github.com/shiyu-coder/Kronos.git"
PIN = "67b630e67f6a18c9e9be918d9b4337c960db1e9a"
ROOT = Path(__file__).resolve().parent
CHECKOUT = ROOT / ".deps" / "Kronos"


def run(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()


def main() -> None:
    if (CHECKOUT / ".git").is_dir():
        current = run("git", "-C", str(CHECKOUT), "rev-parse", "HEAD")
        if current != PIN:
            shutil.rmtree(CHECKOUT)
    if not CHECKOUT.exists():
        CHECKOUT.parent.mkdir(parents=True, exist_ok=True)
        subprocess.check_call(["git", "clone", SOURCE, str(CHECKOUT)])
        subprocess.check_call(["git", "-C", str(CHECKOUT), "checkout", "--detach", PIN])
    current = run("git", "-C", str(CHECKOUT), "rev-parse", "HEAD")
    if current != PIN:
        raise SystemExit(f"Kronos checkout mismatch: expected {PIN}, got {current}")
    print(f"Kronos pinned at {current}")


if __name__ == "__main__":
    main()
