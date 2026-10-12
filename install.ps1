<#
.SYNOPSIS
  把「任务规划」模式安装到 DeepSeek Harness（DSH）。

.DESCRIPTION
  DSH 0.2.x 用「声明式 preset」：模式以 bundle 包的形式存在，**必须通过桌面端插件管理器安装**。
  本脚本不代替你点界面，它负责：

    1. 校验 bundle 包是否完整、DSH home 与 profile 目录是否存在；
    2. 打印要粘贴进插件管理器的【绝对路径】与逐步操作说明；
    3. （可选）对 DSH 0.1.x 的旧「目录型」机制，用 -LegacyCopy 把目录复制到用户层预设根。

  脚本内**不含任何个人绝对路径**：仓库路径取自 $PSScriptRoot，用户目录取自 $env:USERPROFILE，
  可用 -DshHome 覆盖。

.PARAMETER DshHome
  DSH home 目录。默认 $env:USERPROFILE\.dsh

.PARAMETER LegacyCopy
  走 DSH 0.1.x 的目录型机制：复制 presets\task-planning\ 到 <DshHome>\.agent-presets\task-planning\。
  **注意**：在 0.2.x 上这份副本不会被任何代码扫描（本机实测），只对 0.1.x 有效。

.PARAMETER Force
  目标目录已存在时直接覆盖，不再询问。

.PARAMETER WhatIf
  只演示将要做什么，不复制、不创建任何文件。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File install.ps1
  powershell -ExecutionPolicy Bypass -File install.ps1 -DshHome 'E:\dshtest\home'
  powershell -ExecutionPolicy Bypass -File install.ps1 -LegacyCopy -Force
#>
[CmdletBinding()]
param(
  [string]$DshHome = '',
  [switch]$LegacyCopy,
  [switch]$Force,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$RepoRoot  = $PSScriptRoot
$BundleDir = Join-Path $RepoRoot 'presets\task-planning-bundle'
$LegacySrc = Join-Path $RepoRoot 'presets\task-planning'

if ([string]::IsNullOrWhiteSpace($DshHome)) {
  $DshHome = Join-Path $env:USERPROFILE '.dsh'
}
$LegacyDest = Join-Path $DshHome '.agent-presets\task-planning'

Write-Host ''
Write-Host '=== 「任务规划」模式安装 ===' -ForegroundColor Cyan
Write-Host ("仓库根      : {0}" -f $RepoRoot)
Write-Host ("DSH home    : {0}" -f $DshHome)
if ($WhatIf) { Write-Host '模式        : WhatIf（只演示，不写任何文件）' -ForegroundColor Yellow }
Write-Host ''

# ── 1. 校验 bundle 包完整性 ────────────────────────────────────────────────
$required = @(
  'package.json',
  'cordis.patch.yml',
  'PROMPT.md',
  'plugins\token-estimator\index.js',
  'skills\planning-templates\SKILL.md'
)
$missing = @()
foreach ($rel in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $BundleDir $rel))) { $missing += $rel }
}

if ($missing.Count -gt 0) {
  Write-Host '[1/3] bundle 包校验：失败' -ForegroundColor Red
  foreach ($m in $missing) { Write-Host ("      缺少：{0}" -f $m) -ForegroundColor Red }
  Write-Host '      请确认你在仓库根目录运行本脚本，且 presets\task-planning-bundle\ 未被裁剪。'
  exit 1
}
Write-Host '[1/3] bundle 包校验：通过（5 个关键文件齐全）' -ForegroundColor Green

# ── 2. 校验 DSH 环境 ──────────────────────────────────────────────────────
if (-not (Test-Path -LiteralPath $DshHome)) {
  Write-Host ("[2/3] DSH 环境：找不到 DSH home（{0}）" -f $DshHome) -ForegroundColor Yellow
  Write-Host '      如果你把 DSH 装在别处，请用 -DshHome <路径> 重新运行。'
  Write-Host '      仍要继续看安装步骤的话，下面的路径照样可用。'
} else {
  $profilesDir = Join-Path $DshHome 'profiles'
  $profiles = @()
  if (Test-Path -LiteralPath $profilesDir) {
    $profiles = @(Get-ChildItem -LiteralPath $profilesDir -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -ne 'node_modules' } |
      Select-Object -ExpandProperty Name)
  }
  if ($profiles.Count -gt 0) {
    Write-Host ("[2/3] DSH 环境：找到 profile -> {0}" -f ($profiles -join ', ')) -ForegroundColor Green
  } else {
    Write-Host '[2/3] DSH 环境：DSH home 存在，但没找到 profiles\ 子目录' -ForegroundColor Yellow
    Write-Host '      如果你从没启动过 DSH 桌面端，先启动一次再装。'
  }
}

# ── 3. 安装 ───────────────────────────────────────────────────────────────
if ($LegacyCopy) {
  Write-Host ''
  Write-Host '[3/3] 旧机制安装（DSH 0.1.x）：复制目录到用户层预设根' -ForegroundColor Cyan
  Write-Host '      警告：在 DSH 0.2.x 上，这个目录不会被任何代码扫描（本机实测），模式不会出现。' -ForegroundColor Yellow

  if (-not (Test-Path -LiteralPath $LegacySrc)) {
    Write-Host ("      源目录不存在：{0}" -f $LegacySrc) -ForegroundColor Red
    exit 1
  }

  Write-Host ("      源目录  ：{0}" -f $LegacySrc)
  Write-Host ("      目标目录：{0}" -f $LegacyDest)

  if ($WhatIf) {
    Write-Host '      [WhatIf] 将执行：复制上面这个目录到目标目录（递归、覆盖）。未写任何文件。' -ForegroundColor Yellow
    exit 0
  }

  if ((Test-Path -LiteralPath $LegacyDest) -and (-not $Force)) {
    Write-Host '      目标已存在。'
    $ans = ''
    try { $ans = Read-Host '      覆盖它吗？(y/N)' } catch { $ans = '' }
    if ($ans -notmatch '^(y|Y)') {
      Write-Host '      已取消，未改动任何文件。'
      exit 0
    }
  }

  $parent = Split-Path -Parent $LegacyDest
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  Copy-Item -LiteralPath $LegacySrc -Destination $parent -Recurse -Force
  Write-Host ("      已复制：{0}  ->  {1}" -f $LegacySrc, $LegacyDest) -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host '[3/3] 正式安装路线（DSH 0.2.x，实测可用）：用桌面端插件管理器装 bundle 包' -ForegroundColor Cyan
  Write-Host ''
  Write-Host '      第 1 步  打开 DSH 桌面端，左侧栏点「插件」。'
  Write-Host '      第 2 步  点「添加插件」（或箭头菜单里的「安装第三方插件」）。'
  Write-Host '      第 3 步  在包名输入框里粘贴下面这一行（这是本 bundle 的绝对路径）：'
  Write-Host ''
  Write-Host ("               {0}" -f $BundleDir) -ForegroundColor White
  Write-Host ''
  Write-Host '      第 4 步  等界面读出包名 dsh-task-planning-preset 与版本号，点「安装」，等 pnpm 跑完。'
  Write-Host '      第 5 步  点「立即启用」（或回插件列表打开该组合包的开关）。'
  Write-Host '      第 6 步  新开一个会话，模式选择器里应出现「任务规划」。'
  Write-Host ''
  Write-Host '      没出现时怎么办：' -ForegroundColor Yellow
  Write-Host '        · 先重启桌面端，再新开会话（组合变更通常要重启才加载）。'
  Write-Host '        · 若插件页显示「加载失败」，把报错原文抄下来再排查。'
  Write-Host '        · 安装报 ERR_PNPM_UNEXPECTED_STORE：见 presets\task-planning-bundle\README.md 第二节。'
}

Write-Host ''
Write-Host '下一步：新开 DSH 会话，并在模式选择器里选「任务规划」。' -ForegroundColor Green
Write-Host '（安装动作会写入 DSH 的 profile，属使用者本人操作；本脚本只做校验与提示。）'
Write-Host ''
exit 0
