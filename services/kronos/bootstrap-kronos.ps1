$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceRoot = Join-Path $serviceRoot '.deps\Kronos'
$expectedCommit = '67b630e67f6a18c9e9be918d9b4337c960db1e9a'

if (Test-Path (Join-Path $sourceRoot '.git')) {
  $actualCommit = (git -C $sourceRoot rev-parse HEAD).Trim()
  if ($actualCommit -eq $expectedCommit) { Write-Output "Kronos is already pinned at $actualCommit"; exit 0 }
  Remove-Item -LiteralPath $sourceRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $sourceRoot) | Out-Null
git clone https://github.com/shiyu-coder/Kronos.git $sourceRoot
git -C $sourceRoot checkout --detach $expectedCommit
$actualCommit = (git -C $sourceRoot rev-parse HEAD).Trim()
if ($actualCommit -ne $expectedCommit) { throw "Kronos checkout mismatch: expected $expectedCommit, got $actualCommit" }
Write-Output "Kronos pinned at $actualCommit"
