$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
uv run --project $serviceRoot python (Join-Path $serviceRoot 'bootstrap.py')
