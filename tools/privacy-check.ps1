<#
.SYNOPSIS
  开源前隐私与凭据门禁（薄包装，实际扫描由 tools/privacy-scan.mjs 完成）。

.DESCRIPTION
  默认扫描「会公开的东西」：git 跟踪的文件 + 全部提交历史。
  退出码 0 = 通过；1 = 有 block 级命中（或内部产物仍被跟踪）；2 = 用法/环境错误。

.EXAMPLE
  pwsh -File tools/privacy-check.ps1
  pwsh -File tools/privacy-check.ps1 -All          # 连未跟踪文件一起扫
  pwsh -File tools/privacy-check.ps1 -WorktreeOnly # 只扫工作区，不扫历史
#>
[CmdletBinding()]
param(
  [switch]$All,
  [switch]$WorktreeOnly,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = Split-Path -Parent $PSScriptRoot
$nodeArgs = @((Join-Path $PSScriptRoot 'privacy-scan.mjs'), '--root', $root)
if ($All) { $nodeArgs += '--all' }
if ($WorktreeOnly) { $nodeArgs += '--worktree-only' }
if ($Json) { $nodeArgs += '--json' }

& node @nodeArgs
exit $LASTEXITCODE
