#!/usr/bin/env node
/**
 * privacy-scan.mjs —— 开源前隐私/凭据门禁扫描器（只读，不改文件）
 *
 * 用法：
 *   node tools/privacy-scan.mjs                 # 扫「会公开的东西」：git 跟踪的文件 + 全部提交历史
 *   node tools/privacy-scan.mjs --all           # 连工作区里未跟踪的文件一起扫
 *   node tools/privacy-scan.mjs --worktree-only # 只扫工作区，不扫历史（快）
 *   node tools/privacy-scan.mjs --json          # 输出 JSON（给 CI / 其它脚本用）
 *
 * 退出码：0 = 通过（无 block 级命中）；1 = 有 block 级命中；2 = 用法/环境错误。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadRuleSet, scanWorkingTree, scanGitHistory, checkRemovedPaths } from './privacy-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const o = { all: false, history: true, json: false, quiet: false, root: '', rules: '', local: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') o.all = true;
    else if (a === '--worktree-only' || a === '--no-history') o.history = false;
    else if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--root') o.root = argv[++i] || '';
    else if (a === '--rules') o.rules = argv[++i] || '';
    else if (a === '--local') o.local = argv[++i] || '';
    else if (a === '-h' || a === '--help') o.help = true;
    else {
      console.error(`未知参数：${a}`);
      process.exit(2);
    }
  }
  return o;
}

function resolveRoot(given) {
  if (given) return path.resolve(given);
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
}

const SEV_ORDER = { block: 0, warn: 1 };

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('/**', '').trim());
    return 0;
  }

  const root = resolveRoot(args.root);
  const rulesPath = args.rules ? path.resolve(args.rules) : path.join(HERE, 'privacy-rules.json');
  const localPath = args.local ? path.resolve(args.local) : path.join(HERE, 'privacy-local-rules.json');
  if (!fs.existsSync(rulesPath)) {
    console.error(`找不到通用规则文件：${rulesPath}`);
    return 2;
  }

  const rs = loadRuleSet(rulesPath, localPath);
  const result = {
    root,
    scannedAt: new Date().toISOString(),
    rules: { general: rs.rules.filter((r) => r.origin === 'general').length, local: rs.rules.filter((r) => r.origin === 'local').length, localLoaded: rs.localLoaded },
    worktree: { scanned: 0, findings: [] },
    history: { revs: 0, findings: [], note: '' },
    removedPathsTracked: [],
  };

  const wt = scanWorkingTree(root, rs, { all: args.all });
  result.worktree.scanned = wt.scanned;
  result.worktree.findings = wt.findings;

  if (args.history) {
    const h = scanGitHistory(root, rs);
    result.history.revs = h.revs;
    result.history.findings = h.findings;
    if (h.note) result.history.note = h.note;
  }

  result.removedPathsTracked = checkRemovedPaths(root, rs);

  const allFindings = [...result.worktree.findings, ...result.history.findings];
  const blocks = allFindings.filter((f) => f.rule.severity === 'block');
  const warns = allFindings.filter((f) => f.rule.severity !== 'block');
  const pass = blocks.length === 0 && result.removedPathsTracked.length === 0;
  result.pass = pass;
  result.summary = {
    blockFindings: blocks.length,
    warnFindings: warns.length,
    blockMatches: blocks.reduce((s, f) => s + f.count, 0),
    warnMatches: warns.reduce((s, f) => s + f.count, 0),
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return pass ? 0 : 1;
  }

  if (!args.quiet) {
    console.log('=== 开源前隐私与凭据扫描 ===');
    console.log(`仓库根      : ${root}`);
    console.log(`规则        : 通用 ${result.rules.general} 条` + (rs.localLoaded ? ` + 本机 ${result.rules.local} 条` : '（未加载本机规则：tools/privacy-local-rules.json 不存在）'));
    console.log(`扫描范围    : ${args.all ? '工作区全部文件（含未跟踪）' : 'git 跟踪文件'} ${result.worktree.scanned} 个` + (args.history ? ` + ${result.history.revs} 个提交的全部历史` : '（未扫历史）'));
    if (result.history.note) console.log(`历史扫描说明: ${result.history.note}`);
    console.log('');

    const printFindings = (title, list) => {
      if (list.length === 0) {
        console.log(`[${title}] 无命中`);
        return;
      }
      const sorted = [...list].sort((a, b) => SEV_ORDER[a.rule.severity] - SEV_ORDER[b.rule.severity] || b.count - a.count);
      for (const f of sorted) {
        console.log(`[${title}] ${f.rule.severity.toUpperCase()} ${f.rule.id} (${f.rule.label}) × ${f.count}  ← ${f.file}`);
        for (const s of f.samples) {
          const loc = s.line ? `:${s.line}` : '';
          console.log(`         ${f.file}${loc}  ${s.text}`);
        }
      }
    };

    printFindings('工作区', result.worktree.findings);
    if (args.history) printFindings('历史', result.history.findings);
    if (result.removedPathsTracked.length) {
      console.log('[内部产物] 下列内部/临时产物仍被 git 跟踪，不应随仓库公开：');
      for (const r of result.removedPathsTracked) console.log(`         ${r.path}  (${r.count} 个文件)`);
    }
    console.log('');
  }

  const { blockMatches, warnMatches } = result.summary;
  if (pass) {
    console.log(warnMatches > 0 ? `结论：通过（block 命中 0；warn 命中 ${warnMatches} 处，请人工确认）` : '结论：通过（0 命中）');
  } else {
    console.log(`结论：不通过 —— block 命中 ${blockMatches} 处，另有 ${warnMatches} 处 warn；内部产物被跟踪 ${result.removedPathsTracked.length} 项。`);
    console.log('处理：node tools/privacy-sanitize.mjs --all   （自动占位化，可先加 --dry-run 预览）');
  }
  return pass ? 0 : 1;
}

process.exit(main());
