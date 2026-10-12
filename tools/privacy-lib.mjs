/**
 * privacy-lib.mjs —— 开源前隐私/凭据扫描的公共库
 *
 * 设计要点（与「新增规范」配套，见 docs/工作流程/10-开源前隐私与泄露检查.md）：
 *   1. 【通用规则入库、本机字面量不入库】通用规则在 tools/privacy-rules.json；
 *      本机真实值（用户名/邮箱/盘符布局）在 tools/privacy-local-rules.json，该文件被 .gitignore 排除。
 *      这样扫描器本身不会把要防的东西写进公开仓库。
 *   2. 只扫「会公开的东西」：默认扫 git 跟踪的文件 + 全部提交历史；
 *      --all 才扫工作区里的未跟踪文件。
 *   3. 两级严重度：block（门禁失败，退出码 1）、warn（只报告，人工判断）。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const BOM_UTF8 = '\uFEFF';

/** 正则元字符转义（用于把本机字面量安全嵌进 pattern） */
export function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 运行时上下文：供 {{USERNAME}} 这类占位符使用 */
export function runtimeContext() {
  let username = '';
  try {
    username = os.userInfo().username || '';
  } catch {
    /* 某些受限环境下取不到，退到环境变量 */
  }
  if (!username) username = process.env.USERNAME || process.env.USER || '';
  return { USERNAME: username };
}

/** 展开 pattern 里的 {{KEY}} 占位符（值做正则转义） */
export function expandPlaceholders(pattern, ctx) {
  return String(pattern).replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (whole, key) => {
    const v = ctx[key];
    if (v === undefined || v === null || v === '') return whole;
    return escapeRe(v);
  });
}

/** 读取并编译规则集（通用 + 本机） */
export function loadRuleSet(rulesPath, localPath) {
  const base = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  const ctx = runtimeContext();
  const rules = [];

  const compile = (list, origin) => {
    for (const r of list || []) {
      // source 保持 PCRE 原样（交给 git grep -P）；jsSource 去掉 (?i) 这类 PCRE 前缀后交给 JS RegExp
      const source = expandPlaceholders(r.pattern, ctx);
      if (source.includes('{{')) continue; // 占位符解析不出来（如用户名为空）→ 跳过该规则
      let jsSource = source;
      let flags = 'g';
      const inline = /^\(\?([a-z]+)\)/.exec(jsSource);
      if (inline) {
        for (const f of inline[1]) if ('imsu'.includes(f) && !flags.includes(f)) flags += f;
        jsSource = jsSource.slice(inline[0].length);
      }
      for (const f of String(r.flags || '')) if ('imsu'.includes(f) && !flags.includes(f)) flags += f;
      let regex;
      try {
        regex = new RegExp(jsSource, flags);
      } catch (e) {
        throw new Error(`规则 ${r.id} 的正则无法编译：${e.message}`);
      }
      rules.push({ ...r, origin, source, regex });
    }
  };

  compile(base.rules, 'general');
  let localLoaded = false;
  if (localPath && fs.existsSync(localPath)) {
    compile(JSON.parse(fs.readFileSync(localPath, 'utf8')).rules, 'local');
    localLoaded = true;
  }

  return {
    version: base.version,
    skipDirNames: new Set(base.skipDirNames || []),
    skipFileNames: new Set(base.skipFileNames || []),
    skipExtensions: new Set((base.skipExtensions || []).map((s) => String(s).toLowerCase())),
    removedPaths: base.removedPaths || [],
    rules,
    ctx,
    localLoaded,
    localPath,
  };
}

/** 在文本里找命中；allow 列表里的子串不算命中 */
export function findInText(text, rules, sampleLimit = 3) {
  const out = [];
  for (const r of rules) {
    r.regex.lastIndex = 0;
    let m;
    let count = 0;
    const samples = [];
    while ((m = r.regex.exec(text)) !== null) {
      const hit = m[0];
      if (r.allow && r.allow.some((a) => hit.includes(a))) {
        if (m.index === r.regex.lastIndex) r.regex.lastIndex++;
        continue;
      }
      count++;
      if (samples.length < sampleLimit) {
        samples.push({
          line: text.slice(0, m.index).split('\n').length,
          text: hit.replace(/\s+/g, ' ').slice(0, 100),
        });
      }
      if (m.index === r.regex.lastIndex) r.regex.lastIndex++;
    }
    if (count > 0) out.push({ rule: r, count, samples });
  }
  return out;
}

/** 判断某相对路径是否在跳过名单里 */
export function isSkipped(rel, rs) {
  const parts = rel.split('/');
  if (parts.some((p) => rs.skipDirNames.has(p))) return true;
  if (rs.skipFileNames.has(parts[parts.length - 1])) return true;
  if (rs.skipExtensions.has(path.extname(rel).toLowerCase())) return true;
  return false;
}

/** git 跟踪的文件（= 会随仓库公开的文件） */
export function listTrackedFiles(root) {
  const buf = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'buffer',
    maxBuffer: 1 << 28,
  });
  return buf.toString('utf8').split('\0').filter(Boolean);
}

/** 工作区里全部文件（含未跟踪） */
export function walkAllFiles(root, rs) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (rs.skipDirNames.has(e.name)) continue;
        walk(abs);
      } else if (e.isFile()) {
        if (rs.skipFileNames.has(e.name)) continue;
        if (rs.skipExtensions.has(path.extname(e.name).toLowerCase())) continue;
        out.push(path.relative(root, abs).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return out;
}

/** 读文本文件；二进制返回 null；保留编码信息以便回写 */
export function readTextFile(abs) {
  const buf = fs.readFileSync(abs);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.slice(2).toString('utf16le'), encoding: 'utf16le', bom: false };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.slice(2));
    swapped.swap16();
    return { text: swapped.toString('utf16le'), encoding: 'utf16be', bom: false };
  }
  if (buf.includes(0)) return null; // NUL 视为二进制
  return { text: buf.toString('utf8'), encoding: 'utf8', bom: false };
}

/** 按原编码回写 */
export function writeTextFile(abs, text, encoding) {
  if (encoding === 'utf16le') {
    fs.writeFileSync(abs, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
  } else if (encoding === 'utf16be') {
    const b = Buffer.from(text, 'utf16le');
    b.swap16();
    fs.writeFileSync(abs, Buffer.concat([Buffer.from([0xfe, 0xff]), b]));
  } else {
    fs.writeFileSync(abs, Buffer.from(text, 'utf8'));
  }
}

/** 扫描工作区 */
export function scanWorkingTree(root, rs, { all = false } = {}) {
  const files = (all ? walkAllFiles(root, rs) : listTrackedFiles(root)).filter((f) => !isSkipped(f, rs));
  const findings = [];
  for (const rel of files) {
    const abs = path.join(root, rel.split('/').join(path.sep));
    let info;
    try {
      info = readTextFile(abs);
    } catch {
      continue;
    }
    if (!info) continue;
    for (const h of findInText(info.text, rs.rules)) {
      findings.push({ scope: 'worktree', file: rel, rule: h.rule, count: h.count, samples: h.samples });
    }
  }
  return { findings, scanned: files.length };
}

/** 检查 removedPaths 里是否还有被跟踪的文件 */
export function checkRemovedPaths(root, rs) {
  const tracked = listTrackedFiles(root);
  const bad = [];
  for (const p of rs.removedPaths) {
    const hits = tracked.filter((f) => f === p || f.startsWith(p + '/'));
    if (hits.length) bad.push({ path: p, count: hits.length, sample: hits.slice(0, 3) });
  }
  return bad;
}

/** 扫描全部提交历史：作者/提交者身份 + 提交信息 + 全部 blob 内容 */
export function scanGitHistory(root, rs) {
  const findings = [];
  let revs = [];
  try {
    revs = execFileSync('git', ['-C', root, 'rev-list', '--all'], { encoding: 'utf8', maxBuffer: 1 << 28 })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return { findings, revs: 0, note: '取不到提交历史（可能还不是 git 仓库）' };
  }
  if (revs.length === 0) return { findings, revs: 0 };

  // 1) 提交元数据：作者名/邮箱、提交者名/邮箱
  const meta = execFileSync('git', ['-C', root, 'log', '--all', '--format=%h %an <%ae> | %cn <%ce>'], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  for (const h of findInText(meta, rs.rules)) {
    findings.push({ scope: 'git-meta', file: '(提交作者/提交者身份)', rule: h.rule, count: h.count, samples: h.samples });
  }

  // 2) 提交信息
  const msgs = execFileSync('git', ['-C', root, 'log', '--all', '--format=%B'], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  for (const h of findInText(msgs, rs.rules)) {
    findings.push({ scope: 'git-message', file: '(提交信息)', rule: h.rule, count: h.count, samples: h.samples });
  }

  // 3) 全部历史 blob 内容：git grep -P 逐规则扫所有 rev
  const CHUNK = 200;
  for (const r of rs.rules) {
    let count = 0;
    const samples = [];
    for (let i = 0; i < revs.length; i += CHUNK) {
      const args = ['-C', root, 'grep', '-P', '-I', '-n', '-e', r.source, ...revs.slice(i, i + CHUNK)];
      let out = '';
      try {
        out = execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
      } catch (e) {
        if (e.status === 1) continue; // 无命中
        if (e.status === 128 || /unknown option|not supported/i.test(String(e.stderr || ''))) {
          return { findings, revs: revs.length, note: 'git grep -P 不可用，历史 blob 内容未扫描（请升级 Git）' };
        }
        continue;
      }
      const lines = out.split('\n').filter(Boolean);
      count += lines.length;
      for (const l of lines) {
        if (samples.length >= 3) break;
        samples.push({ line: 0, text: l.slice(0, 160) });
      }
    }
    if (count > 0) {
      findings.push({ scope: 'git-blob', file: '(历史文件内容)', rule: r, count, samples });
    }
  }

  return { findings, revs: revs.length };
}

/** 删除 root 内的相对路径（带越界保护） */
export function removePaths(root, removedPaths) {
  const rootAbs = path.resolve(root);
  const removed = [];
  for (const rel of removedPaths) {
    const abs = path.resolve(rootAbs, rel);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
      throw new Error(`拒绝删除：${abs} 不在 ${rootAbs} 内`);
    }
    if (fs.existsSync(abs)) {
      fs.rmSync(abs, { recursive: true, force: true });
      removed.push(rel);
    }
  }
  return removed;
}
