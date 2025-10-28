# --- diagnose.ps1: sammelt Build-Kontext + Logs lokal ---

$ErrorActionPreference = "Continue"
$LogDir = ".diagnose_logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# 1) Umgebung dumpen
"### Node & npm"            | Out-File "$LogDir\env.txt"
node -v                     | Out-File "$LogDir\env.txt" -Append
npm -v                      | Out-File "$LogDir\env.txt" -Append
"### Git"                   | Out-File "$LogDir\env.txt" -Append
git rev-parse --abbrev-ref HEAD | Out-File "$LogDir\env.txt" -Append
git rev-parse HEAD              | Out-File "$LogDir\env.txt" -Append

# 2) netlify.toml & package.json sichern
if (Test-Path ".\netlify.toml") { Get-Content .\netlify.toml | Out-File "$LogDir\netlify.toml" }
if (Test-Path ".\package.json") { Get-Content .\package.json | Out-File "$LogDir\package.json" }

# 3) Verzeichnisstruktur (Top-Level)
"### Tree" | Out-File "$LogDir\tree.txt"
Get-ChildItem -Force | Format-List | Out-File "$LogDir\tree.txt" -Append

# 4) Frische Installation + Build
#    (lockfile sollte im Repo committed sein)
try {
  npm ci 2>&1 | Tee-Object -FilePath "$LogDir\npm-ci.log"
} catch {
  "npm ci failed: $($_.Exception.Message)" | Out-File "$LogDir\npm-ci.log" -Append
}

try {
  $env:NETLIFY_BUILD_DEBUG = "true"
  npx netlify-cli build --debug --context=production 2>&1 | Tee-Object -FilePath "$LogDir\netlify-build.log"
} catch {
  "netlify build failed: $($_.Exception.Message)" | Out-File "$LogDir\netlify-build.log" -Append
}

"==> Fertig. Bitte hänge die Dateien im Ordner .diagnose_logs an."
