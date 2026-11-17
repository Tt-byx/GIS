# 统一自检入口 PowerShell 等价实现（T-04：与 check.sh 行为必须一致）。
# 先行实现范围：CHK-LINT / CHK-BUILD / CHK-DEP（前端部分）/ CHK-UNIT。
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Checks
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Fe = Join-Path $Root 'frontend'
$LogDir = Join-Path $Root 'scripts\.log'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$script:FinalExit = 0

function Write-Result {
    param([string]$Id, [string]$Status, [string]$Summary)
    Write-Output "CHECK $Id $Status $Summary"
    if ($Status -eq 'FAIL') { $script:FinalExit = 1 }
}

function Invoke-NpmCheck {
    param([string]$Id, [string]$Script, [string]$OkSummary)
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        Write-Result $Id 'FAIL' 'npm 不存在，环境不可用'
        return
    }
    Push-Location $Fe
    $log = & npm run $Script 2>&1 | ForEach-Object { $_.ToString() }
    $code = $LASTEXITCODE
    Pop-Location
    $log -join "`n" | Out-File -FilePath (Join-Path $LogDir "$Id.log") -Encoding utf8
    if ($code -eq 0) {
        Write-Result $Id 'PASS' $OkSummary
    }
    else {
        $first = ($log | Select-String -Pattern 'error|✖|failed|FAIL' | Select-Object -First 1).Line
        Write-Result $Id 'FAIL' "exit=$code, first: $(if ($first) { $first } else { "见日志 $LogDir\$Id.log" })"
    }
}

function Invoke-DepGrep {
    param([string]$SubId, [string]$Pattern, [string]$Target, [string]$Exclude)
    if (-not (Test-Path $Target)) { return }
    $out = Select-String -Path "$Target*" -Pattern $Pattern -ErrorAction SilentlyContinue
    if (-not $out) { return }
    if ($Exclude) { $out = $out | Where-Object { $_.Line -notmatch $Exclude } }
    if (-not $out) { return }
    $lines = ($out | ForEach-Object { "$($_.Path):$($_.LineNumber): $($_.Line)" }) -join "`n"
    Add-Content -Path (Join-Path $LogDir 'CHK-DEP.log') -Value "[$SubId]`n$lines"
    if (-not $script:DepFirst) { $script:DepFirst = "$SubId: $(($out | Select-Object -First 1).Line)" }
    $script:DepViolations++
}

function Invoke-DepCheck {
    $script:DepViolations = 0
    $script:DepFirst = ''
    Set-Content -Path (Join-Path $LogDir 'CHK-DEP.log') -Value ''
    Invoke-DepGrep 'DEP-03' "from ['\`"]@/(api|modules|components|stores)" (Join-Path $Fe 'src\core') ''
    Invoke-DepGrep 'DEP-04' "from ['\`"]@/(modules|components|stores)" (Join-Path $Fe 'src\api') ''
    Get-ChildItem (Join-Path $Fe 'src\modules') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Invoke-DepGrep 'DEP-05' "from ['\`"]@/modules/" $_.FullName "@/modules/$($_.Name)"
    }
    Invoke-DepGrep 'DEP-06' "from ['\`"]@/modules" (Join-Path $Fe 'src\components') ''
    Invoke-DepGrep 'DEP-07' "from ['\`"]\.\./\.\./" (Join-Path $Fe 'src') ''
    Invoke-DepGrep 'DEP-08' 'new Zondy' (Join-Path $Fe 'src\modules') ''
    Invoke-DepGrep 'DEP-09' '127\.0\.0\.1|localhost:\d+|:6163|:8080' (Join-Path $Fe 'src') ''
    Invoke-DepGrep 'DEP-10' 'tk=[0-9a-f]{16,}|key=[0-9a-f]{16,}' (Join-Path $Fe 'src') ''
    Invoke-DepGrep 'DEP-11' 'TODO|FIXME|XXX|console\.log' (Join-Path $Fe 'src') ''
    $indexPath = Join-Path $Fe 'index.html'
    if ((Test-Path $indexPath) -and (Select-String -Path $indexPath -Pattern 'zondyclientOld' -Quiet)) {
        Add-Content -Path (Join-Path $LogDir 'CHK-DEP.log') -Value '[DEP-12]`nzondyclientOld found in index.html'
        $script:DepViolations++
        if (-not $script:DepFirst) { $script:DepFirst = 'DEP-12: zondyclientOld found in index.html' }
    }
    if ($script:DepViolations -eq 0) {
        Write-Result 'CHK-DEP' 'PASS' '0 violations'
    }
    else {
        Write-Result 'CHK-DEP' 'FAIL' "$($script:DepViolations) violation(s), first: $($script:DepFirst)"
    }
}

if (-not $Checks -or $Checks.Count -eq 0) {
    Write-Output '用法: scripts/check.ps1 <CHECK_ID>... | all' | Write-Error
    exit 2
}

foreach ($arg in $Checks) {
    switch ($arg) {
        'CHK-LINT' { Invoke-NpmCheck 'CHK-LINT' 'lint' '0 errors' }
        'CHK-BUILD' { Invoke-NpmCheck 'CHK-BUILD' 'build' 'dist built' }
        'CHK-DEP' { Invoke-DepCheck }
        'CHK-UNIT' { Invoke-NpmCheck 'CHK-UNIT' 'test:unit' 'all spec passed' }
        'all' {
            Invoke-NpmCheck 'CHK-LINT' 'lint' '0 errors'
            Invoke-NpmCheck 'CHK-BUILD' 'build' 'dist built'
            Invoke-DepCheck
            Invoke-NpmCheck 'CHK-UNIT' 'test:unit' 'all spec passed'
        }
        default {
            Write-Output "未知检查项: $arg"
            exit 2
        }
    }
}

exit $script:FinalExit
