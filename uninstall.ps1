<#
.SYNOPSIS
  卸载「任务规划」模式的用户层副本。

.DESCRIPTION
  删除 <DshHome>\.agent-presets\task-planning\ —— 这是 DSH **0.1.x 旧机制**的安装落点。

  DSH 0.2.x 的正式安装是 bundle 包（装在 profile 里），**本脚本不会碰 profile**：
  那部分要在桌面端插件管理器里点「卸载」（脚本代做会改 profile 的 package.json，
  属于必须由使用者本人确认的操作）。

  安全设计：
    · 只允许删除「...\.agent-presets\task-planning」这一个路径，其它路径一律拒绝；
    · 先打印将被删除的绝对路径，再确认，最后才删；
    · -WhatIf 只演示不删；-Yes 跳过确认（给自动化用）。

.PARAMETER DshHome
  DSH home 目录。默认 $env:USERPROFILE\.dsh

.PARAMETER Yes
  跳过交互确认，直接删除（谨慎使用）。

.PARAMETER WhatIf
  只演示将删除什么，不删任何东西。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File uninstall.ps1 -WhatIf
  powershell -ExecutionPolicy Bypass -File uninstall.ps1
  powershell -ExecutionPolicy Bypass -File uninstall.ps1 -Yes
#>
[CmdletBinding()]
param(
  [string]$DshHome = '',
  [switch]$Yes,
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

if ([string]::IsNullOrWhiteSpace($DshHome)) {
  $DshHome = Join-Path $env:USERPROFILE '.dsh'
}
$Target = Join-Path $DshHome '.agent-presets\task-planning'

Write-Host ''
Write-Host '=== 「任务规划」模式卸载（用户层副本） ===' -ForegroundColor Cyan
Write-Host ("将被删除的路径：{0}" -f $Target) -ForegroundColor White
if ($WhatIf) { Write-Host '模式：WhatIf（只演示，不删任何东西）' -ForegroundColor Yellow }
Write-Host ''

# ── 安全护栏：只允许删这一个路径 ──────────────────────────────────────────
$expectedSuffix = '.agent-presets\task-planning'
if (-not $Target.EndsWith($expectedSuffix, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Host '路径校验失败：目标不是 .agent-presets\task-planning，已中止。' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $Target)) {
  Write-Host '该路径不存在 —— 用户层副本本来就没装（0.2.x 上这是常态）。' -ForegroundColor Yellow
} else {
  if ($WhatIf) {
    Write-Host '[WhatIf] 将执行：递归删除上面这个目录。未删任何文件。' -ForegroundColor Yellow
  } else {
    if (-not $Yes) {
      $ans = ''
      try { $ans = Read-Host '确认删除？(y/N)' } catch { $ans = '' }
      if ($ans -notmatch '^(y|Y)') {
        Write-Host '已取消，未删除任何文件。'
        exit 0
      }
    }
    Remove-Item -LiteralPath $Target -Recurse -Force
    Write-Host ("已删除：{0}" -f $Target) -ForegroundColor Green
  }
}

Write-Host ''
Write-Host '--- 如果你的模式是用插件管理器装的（DSH 0.2.x），还要做这一步 ---' -ForegroundColor Cyan
Write-Host '  桌面端 → 左侧栏「插件」→ 找到 dsh-task-planning-preset 那张卡片 → 卸载。'
Write-Host '  卸载后重启桌面端，新开会话确认「任务规划」已消失。'
Write-Host '  （本脚本不代做这一步：它会改 profile 的 package.json，须由使用者本人操作。）'
Write-Host ''
exit 0
