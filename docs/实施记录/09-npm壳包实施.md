# 任务 09 · 实施记录：npm 壳包（发布既有 bundle 包）

> 任务文件：`docs/工作流程/09-可选-npm壳包.md`
> 评估文档：[`09-npm壳包评估.md`](09-npm壳包评估.md)（三处前提冲突与形态取舍）
> 执行时间：2026-10-14　**执行者**：执行 AI（标准模式会话）
> 机器：本机（Windows / Node v24.20.0 / npm 11.19.0 / DSH 桌面端 0.2.1-alpha.1 声明式 preset 机制）
> **本文只记录机器可复核的部分**（命令 + 原始输出）。需要「登录 npm / 点插件页 / 重启 / 新开会话」的验证
> 一律留给人工（铁律 11），步骤见 §6，原始输出由人工回填到
> [`../验收报告/09-npm包安装报告.md`](../验收报告/09-npm包安装报告.md)。

---

## 0. 人工裁决（本次执行的前提）

评估落盘后，人工裁决：

| 问题 | 裁决 |
|---|---|
| 做不做 | **做，按方案 (d)：发布既有 bundle 包**（不新建 `package/` 壳包） |
| 包名 | **沿用裸名 `dsh-task-planning-preset`**（不用 scope） |

因此本次**没有**按任务书原文新建"含 `presets/` 目录 + 安装器"的壳包 —— 理由见评估文档 §1（0.1.x 前提在本机不成立）
与 §5.1（两份内容相同的包会制造"哪份是真的"这个新坑）。

---

## 1. 落点与产物

| 文件 | 动作 | 说明 |
|---|---|---|
| `presets/task-planning-bundle/package.json` | 改 | `version` `0.1.0`→`1.0.0`；加 `files` 白名单、`repository`/`homepage`/`bugs`、`publishConfig.access`；**保留** `dsh.bundle.patch` |
| `presets/task-planning-bundle/LICENSE` | **新增** | MIT，与仓库根 `LICENSE` **逐字一致**（sha256 复核见 §2） |
| `README.zh.md` / `README.en.md` | 改 | 安装章节重排为「路线 A 从 npm / 路线 B 本地目录 / 路线 C 0.1.x 旧机制」；新增"npm 包被下架后仍可装"一节；目录树补 `LICENSE` |
| `presets/task-planning-bundle/README.md` | 改 | 文件清单加 `LICENSE` 与 `files` 白名单说明；安装章节拆成"路线 1 npm / 路线 2 本地目录"；更新说明补 npm 版本维护负担 |
| `presets/README.md` | 改 | 文件清单补 `LICENSE`、注明本目录＝ npm 包全部内容 |
| `docs/实施记录/09-npm壳包评估.md` | **新增** | 评估（第一步交付物） |
| `docs/实施记录/09-npm壳包实施.md` | **新增** | 本文件 |
| `docs/验收报告/09-npm包安装报告.md` | **新增** | 结论报告 + 人工步骤与回填栏 |
| `docs/优化提示词/执行进度.md`、`CHANGELOG.md` | 改 | 收尾四步 |

**未动**（范围围栏，铁律 1）：`install.ps1` / `uninstall.ps1`（任务 08 交付物，npm 路线不需要它们改动）、
`presets/task-planning/`（0.1.x 留档）、`PROMPT.md`、`cordis.patch.yml`、`plugins/`、`skills/`。

---

## 2. 改动后的 `package.json`（全文）与 LICENSE 一致性

```json
{
  "name": "dsh-task-planning-preset",
  "version": "1.0.0",
  "description": "DSH「任务规划」模式：以声明式 preset（@deepseek-ai/dsh-agent-preset）注册一个只做规划、自己不动手实现的 Agent 组合",
  "keywords": ["dsh", "dsh-plugin", "deepseek-harness", "agent-preset", "task-planning"],
  "license": "MIT",
  "type": "module",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/TBTNCT/dsh-task-planning-mode.git",
    "directory": "presets/task-planning-bundle"
  },
  "homepage": "https://github.com/TBTNCT/dsh-task-planning-mode#readme",
  "bugs": { "url": "https://github.com/TBTNCT/dsh-task-planning-mode/issues" },
  "files": ["PROMPT.md", "README.md", "LICENSE", "cordis.patch.yml", "plugins/", "skills/"],
  "publishConfig": { "access": "public" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

> ⚠️ **`dsh.bundle.patch` 必须保留**：任务书原文说"不写任何 `dsh` 字段"，那是 0.1.x 的结论。
> 0.2.x 里这个字段**正是** preset 的落地机制 —— 去掉它，插件管理器会把本包判为 `not-a-bundle`（评估文档 §1 C2）。
>
> `publishConfig.access: public` 对裸名包不是必需项，但写上无害，且能让以后改 scoped 名时不至于忘记。

LICENSE 一致性（**实测**）：

```text
PS> Get-FileHash LICENSE -Algorithm SHA256
root   LICENSE sha256: BD88051A021D64E2207F3161EFC5FA5E610C435D47BA018FF34E0BE6C30EAFD4
bundle LICENSE sha256: BD88051A021D64E2207F3161EFC5FA5E610C435D47BA018FF34E0BE6C30EAFD4
identical: True
```

---

## 3. `npm pack --dry-run` 终态清单（任务书硬性要求 4：发布前交使用者确认）

命令（工作目录 = `presets/task-planning-bundle`；`--cache` 指向临时目录以避开沙箱）：

```text
PS> npm pack --dry-run --json --cache %TEMP%\dsh-npm-cache-09
```

原始输出（逐字，仅保留 JSON 主体）：

```json
[
  {
    "id": "dsh-task-planning-preset@1.0.0",
    "name": "dsh-task-planning-preset",
    "version": "1.0.0",
    "size": 43466,
    "unpackedSize": 114639,
    "shasum": "a51aa21ff610c3e0bacf2b100599ec3573841bcc",
    "integrity": "sha512-2YlkGt3A2b7l09HES4HfWXrYruO/hbiL465B9Qrx4uCgxV/rMr2AT5Ga3g2MlLAxYSPxuDnki2BqolnjIFAWHg==",
    "filename": "dsh-task-planning-preset-1.0.0.tgz",
    "files": [
      { "path": "LICENSE",                          "size": 1078,  "mode": 420 },
      { "path": "PROMPT.md",                        "size": 34920, "mode": 420 },
      { "path": "README.md",                        "size": 12742, "mode": 420 },
      { "path": "cordis.patch.yml",                 "size": 15900, "mode": 420 },
      { "path": "package.json",                     "size": 950,   "mode": 420 },
      { "path": "plugins/token-estimator/index.js", "size": 24213, "mode": 420 },
      { "path": "skills/planning-templates/SKILL.md", "size": 24836, "mode": 420 }
    ],
    "entryCount": 7,
    "bundled": []
  }
]
```

对照任务书硬性要求 2（包内不得含个人绝对路径 / `demo/_自测/` / `demo/_验收/` 等临时产物）：

- **7 个文件**，与 `git ls-files presets/task-planning-bundle` 的输出**完全一致**（除新增的 `LICENSE`）；
- **无** `demo/`、无 `.tmp-*`、无个人绝对路径文件；全部文件已过隐私门（§5）；
- `files` 白名单生效：以后误放临时文件也不会进包（白名单外的路径不参与打包）。

---

## 4. 本地验证：干净目录安装 + 复刻 3 处 `!!js` 解析

任务书硬性要求 4「本地验证：`npm pack` → 在临时目录 `npm i <tgz>` → 按说明完成安装」中，
**AI 能做的部分是前两步与"文件级/解析级"验证**；"新开会话确认模式出现"必须人工（§6）。

### 4.1 做法

把 tgz 解到一个**隔离站点**的 `node_modules/<包名>`（真实目录，等价 pnpm 的 `node_modules` 布局），
再在该站点里用一个探针复刻 `cordis.patch.yml` 里 3 处 `!!js` 的**同一条解析基准**：

| # | 补丁文件里的原表达式 | 探针复刻 |
|---|---|---|
| ① | `cordis.patch.yml:63` persona `prefix`：`createRequire(new URL('noop.js', baseUrl)).resolve('dsh-task-planning-preset/PROMPT.md')` | 同一表达式 |
| ② | `cordis.patch.yml:134` `customSkillDirs`：`resolve('dsh-task-planning-preset/package.json')` → `dirname` + `'skills'` | 同一表达式 |
| ③ | 插件行 `name: dsh-task-planning-preset/plugins/token-estimator/index.js` | `await import('dsh-task-planning-preset/plugins/token-estimator/index.js')` |

> **沙箱注意**：本机沙箱禁止子进程用管道捕获输出（`spawnSync EPERM`），
> 所以探针把结果写成文件、以 `stdio: 'inherit'` 启动，父进程再读文件（脚本见 §4.3 说明）。

### 4.2 原始输出（终态，逐字）

```text
== 步骤 1：解 tgz 到干净目录（不碰用户环境、不碰 profile）==
       tgz        : %USERPROFILE%\AppData\Local\Temp\dsh-tp-09\dsh-task-planning-preset-1.0.0.tgz
       安装点      : %USERPROFILE%\AppData\Local\Temp\dsh-tp-09\install2\site\node_modules\dsh-task-planning-preset
       是真实目录  : true

== 步骤 2：包内容与仓库源逐文件比对 ==
PASS | 包内文件清单 = 预期 7 项（不多不少、无临时产物）
       => LICENSE, PROMPT.md, README.md, cordis.patch.yml, package.json, plugins/token-estimator/index.js, skills/planning-templates/SKILL.md
PASS | sha256 一致: LICENSE                              => bd88051a021d64e2
PASS | sha256 一致: PROMPT.md                            => 4a2a4053d282d5c5
PASS | sha256 一致: README.md                            => 99cbff0b84a0b70c
PASS | sha256 一致: cordis.patch.yml                     => a994fd07c84c7bcb
PASS | sha256 一致: package.json                         => e5e7de724a3665a7
PASS | sha256 一致: plugins/token-estimator/index.js     => 60e2dfb5c652d588
PASS | sha256 一致: skills/planning-templates/SKILL.md   => f4a8df123f06edd2

== 步骤 3：在隔离站点里复刻 3 处 !!js 解析 ==
PASS | 探针进程退出码 0                                     => status=0
PASS | ① persona：resolve("dsh-task-planning-preset/PROMPT.md") 成功
       => ...\install2\site\node_modules\dsh-task-planning-preset\PROMPT.md
PASS | ① 解析到「装出来的副本」而非仓库源
       => 副本根=...\install2\site\node_modules\dsh-task-planning-preset
PASS | ① PROMPT.md 与仓库源逐字一致                          => 14691 字符
PASS | ② skill-filesystem：resolve(package.json) 落在副本里   => ...\node_modules\dsh-task-planning-preset\package.json
PASS | ② customSkillDirs 指向副本 skills/ 且含 planning-templates/SKILL.md
       => ...\node_modules\dsh-task-planning-preset\skills
PASS | ③ 按包名子路径 import token-estimator 成功            => ["apply","inject","name"]
PASS | ③ 模块导出含 apply                                   => ["apply","inject","name"]

== 结果：PASS 16 / FAIL 0 ==
```

tgz 本体：`sha256 = AD0D3D6D342D59C5ACB1CA504210BC7D4FC4BE28F57027A0765BC11B026F7199`，`43466` 字节。

### 4.3 这条验证证明了什么、没证明什么

- **证明了**：包内容 = 仓库源（逐文件 sha256）；3 处 `!!js` 在"包被装进 `node_modules/<包名>`"这一布局下
  能解析到**装出来的那份副本**，且 `PROMPT.md` 读到的正文与仓库源逐字一致（14691 字符）；
  token-estimator 能按包名子路径被 `import` 且导出 `apply`。
  → 评估文档 §7 第 1 条（"registry 安装后 3 处 `!!js` 是否解析到同一份副本"）**由推导升级为实测**。
- **没证明**（如实标注，留给人工）：DSH 插件管理器从 registry 真实安装、重启后模式真的出现在选择器里。
  探针复刻的是**解析基准**，不是插件管理器的安装流程。

### 4.4 验证脚本的留档与处理

验证脚本是**临时产物**（`verify-npm-install.mjs`，约 90 行，跑完即删，**不随仓库发布**，与任务 02/05 的三支校验脚本同一处理方式）。
它的做法已完整写在 §4.1；若要重建，照上表复刻 3 个表达式即可（本机任意 Node ≥ 20）。

---

## 5. 隐私门（铁律 13）

```text
PS> node tools\privacy-scan.mjs
…
[历史] WARN outside-abs-path (仓库外的绝对路径（人工确认）) × 659  ← (历史文件内容)
结论：通过（block 命中 0；warn 命中 675 处，请人工确认）
privacy exit=0
```

- **block 命中 0**（门禁通过）；warn 全是既有文档里的"仓库外绝对路径"（`D:\.pnpm-store\v11`、
  `F:\…`、`D:\Plugins\…`、`E:\dshtest\home` 之类），与本次改动无关，属人工确认项；
- 本次新增/修改的文件里，`README.zh.md` / `README.en.md` / `presets/README.md` /
  `presets/task-planning-bundle/README.md` / `package.json` / `LICENSE` 均**未引入**新的 block 级命中。

> 备注：本机沙箱下 `privacy-scan.mjs` 需要子进程管道调用 `git`，会 `EPERM`；
> 本次是在放宽文件沙箱（danger-full-access）下跑通的。这属于**环境限制**，不是脚本缺陷。

---

## 6. 必须人工执行的部分（铁律 11：AI 不代填）

按顺序做，并把**原始输出**抄回 [`../验收报告/09-npm包安装报告.md`](../验收报告/09-npm包安装报告.md) 的人工回填栏：

### 6.1 登录与发布（前置：本机当前**未登录**）

```text
PS> npm whoami
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in.
```

1. **登录**（交互动作，只能由你本人做）：

   ```powershell
   npm login
   ```

2. **发布前最后确认**：§3 的 `--dry-run` 清单（7 个文件）是否符合预期。
3. **发布**（裸名包不需要 `--access public`；已写进 `publishConfig`）：

   ```powershell
   cd <仓库根>
   npm publish .\presets\task-planning-bundle
   ```

   预期成功输出末尾为 `+ dsh-task-planning-preset@1.0.0`。
4. 发布后**机器可复核的一条**（AI 也能跑，但需你发布完才能跑）：

   ```powershell
   npm view dsh-task-planning-preset version
   ```

   预期打印 `1.0.0`。

### 6.2 安装验收（桌面端 UI + 重启 + 新开会话）

1. 桌面端 → **插件** → **添加插件** → 输入 `dsh-task-planning-preset` → **安装** → **立即启用**；
2. **重启桌面端**；
3. **新开一个会话**，看模式选择器里有没有「**任务规划**」；
4. 切进去，问它一句"你是谁/这是什么模式"，看是否按本模式的流程开场（会先提问）。

### 6.3 回填要求

- 每一步的**原始输出/原文**（报错要原文，不要转述）；
- 发布成功后的 `npm view` 输出；
- 模式出现/未出现，以及是否有「加载失败」红标；
- 报告里要标明"本项由人工执行，执行人：<你的名字>"。

---

## 7. 给下一个任务的注意事项

1. **`dsh.bundle.patch` 不能删**。它是 0.2.x 的 preset 落地机制；删了包就装不上（评估文档 §1 C2）。
2. **`files` 白名单是包内容的唯一真相**。以后往 `presets/task-planning-bundle/` 加文件（例如再加一个 skill），
   必须同时改 `files`，否则 `npm pack` 不会带上它 —— 而**本地路径安装**会带上（两种安装方式内容不一致）。
3. **npm 上的版本要靠人记得发**。改了 `cordis.patch.yml` / `PROMPT.md` 后，本地路径用户重启即生效，
   但 npm 用户装到的仍是发布时的旧版。这是本任务唯一的长期维护负担（评估文档 §5.4）。
4. **别在 `presets/task-planning-bundle/` 里留临时文件**：白名单能挡住它们进包，但
   `git status` 会脏，且容易误提交。验证脚本建议直接写在 `%TEMP%` 下。
5. **下架不致命**：README 已写明"npm 被下架 → 走路线 B（克隆仓库 + 粘贴绝对路径）"，
   这条也是任务书硬性要求 6 的答案。
