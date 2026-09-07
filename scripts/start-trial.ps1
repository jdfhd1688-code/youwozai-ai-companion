$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
# Respect the user's existing Windows proxy only for this child process.
# NODE_USE_ENV_PROXY requires Node 24+, as installed on this machine.
$trialProxy = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
if ($trialProxy.ProxyEnable -eq 1 -and $trialProxy.ProxyServer -and $trialProxy.ProxyServer -notmatch '=') {
  $env:HTTPS_PROXY = if ($trialProxy.ProxyServer -match '^https?://') { $trialProxy.ProxyServer } else { 'http://' + $trialProxy.ProxyServer }
  $env:HTTP_PROXY = $env:HTTPS_PROXY
  $env:NO_PROXY = 'localhost,127.0.0.1,::1'
  $env:NODE_USE_ENV_PROXY = '1'
}
pnpm dev
