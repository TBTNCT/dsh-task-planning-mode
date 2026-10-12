#!/usr/bin/env node
/**
 * privacy-sanitize.mjs —— 按规则把工作区文本里的个人信息占位化（会改文件）
 *
 * 用法：
 *   node tools/privacy-sanitize.mjs --dry-run --all   # 只预览，不改文件
 *   node tools/privacy-sanitize.mjs --all             # 改工作区全部文本文件（含未跟踪）
 *   node tools/privacy-sanitize.mjs                   # 只改 git 跟踪的文件
 *   node tools/privacy-sanitize.mjs --remove-paths    # 额外删除规则里列出的内部产物目录（谨慎）
 *
 * 只处理 replacement 非 null 的规则；replacement 为 null 的（无法自动判断真假）留给人工。
 * 本脚本幂等：对已清洗过的文本再跑一次不会有任何改动。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadRuleSet, readTextFile, writeTextFile, isSkipped, listTrackedFiles, walkAllFiles, removePaths } from './privacy-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const o = { all: false, dryRun: false, removePaths: false, quiet: false, root: '', rules: '', local: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') o.all = true;
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--remove-paths') o.removePaths = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--root') o.root = argv[++i] || '';
    else if (a === '--rules') o.rules = argv[++i] || '';
    else if (a === '--local') o.local = argv[++i] || '';
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

function applyRules(text, rules) {
  let out = text;
  const perRule = new Map();
  for (const r of rules) {
    if (r.replacement === null || r.replacement === undefined) continue;
    let n = 0;
    out = out.replace(r.regex, (match) => {
      if (r.allow && r.allow.some((a) => match.includes(a))) return match;
      n++;
      return r.replacement;
    });
    if (n > 0) perRule.set(r.id, (perRule.get(r.id) || 0) + n);
  }
  return { text: out, perRule };
}

const args = parseArgs(process.argv.slice(2));
const root = resolveRoot(args.root);
const rulesPath = args.rules ? path.resolve(args.rules) : path.join(HERE, 'privacy-rules.json');
const localPath = args.local ? path.resolve(args.local) : path.join(HERE, 'privacy-local-rules.json');
const rs = loadRuleSet(rulesPath, localPath);

const files = (args.all ? walkAllFiles(root, rs) : listTrackedFiles(root)).filter((f) => !isSkipped(f, rs));

let changedFiles = 0;
let changedTotal = 0;
const perRuleTotal = new Map();

for (const rel of files) {
  const abs = path.join(root, rel.split('/').join(path.sep));
  let info;
  try {
    info = readTextFile(abs);
  } catch {
    continue;
  }
  if (!info) continue;
  const { text, perRule } = applyRules(info.text, rs.rules);
  if (text === info.text) continue;
  changedFiles++;
  for (const [id, n] of perRule) {
    changedTotal += n;
    perRuleTotal.set(id, (perRuleTotal.get(id) || 0) + n);
  }
  if (!args.quiet) {
    const detail = [...perRule].map(([id, n]) => `${id}×${n}`).join(', ');
    console.log(`${args.dryRun ? '[预览] ' : '[改写] '}${rel}  (${detail})`);
  }
  if (!args.dryRun) writeTextFile(abs, text, info.encoding);
}

let removed = [];
if (args.removePaths && !args.dryRun) {
  removed = removePaths(root, rs.removedPaths);
}

if (!args.quiet) {
  console.log('');
  console.log(`文件：改动 ${changedFiles} 个 / 共扫 ${files.length} 个；替换 ${changedTotal} 处`);
  if (perRuleTotal.size) {
    console.log('按规则：' + [...perRuleTotal].map(([id, n]) => `${id}=${n}`).join('  '));
  }
  if (args.removePaths) {
    console.log(`删除目录：${removed.length ? removed.join(', ') : '（无）'}`);
  }
  const manual = rs.rules.filter((r) => r.replacement === null || r.replacement === undefined);
  if (manual.length) {
    console.log(`需人工处理的规则（不自动改写）：${manual.map((r) => r.id).join(', ')}`);
  }
  if (args.dryRun) console.log('这是预览模式，未写入任何文件。去掉 --dry-run 才会真正改写。');
}
