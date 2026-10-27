# 更新日志

本文件记录本项目的显著变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.2.0] - 2026-10-27

### 变更

- **取消提问轮数的固定上限，改为「版本迭代询问法」**：
  - `presets/task-planning-bundle/PROMPT.md` §二 重写：流程由「解析需求 → 多轮提问」四步改为
    「解析需求 → **版本迭代规划表（等使用者确认）** → 逐版本多轮提问 → 每版需求确认书 → 规划」五步。
  - **节奏口径**：原「每轮 3–10 题、最多 6 轮」**整条删除**，改为 **每版本每轮 3–9 题、每版本最多 9 轮**
    （下限 = 3 题 × 1 轮 = **3 题**；上限 = 9 题 × 9 轮 = **81 题**）。9 轮问完仍不满 9/9 的，
    剩余项写「未知，按默认假设 X」，**不许开第 10 轮**；只剩 1–2 项的**不单独开一轮**（会破 3 题下限），
    直接用默认假设收口。
  - **版本划分依据**：按能力实现阶段切，默认 **骨架 → 核心能力 → 收尾验收**；**版本数量不设上限**，
    `9×9` 只约束「每版每轮题数 × 每版轮数」，**不约束版本个数**。
  - **每个版本各一份 9 项需求清单**，逐版本填到 9/9；后面版本沿用前面结论时**必须复述结论**，不许只写「同上」。
  - **版本闸门**：本版本确认书通过 → **自动进下一版本**，不再问「要不要继续」；全部版本问完后
    再给**一页总确认书**，确认后才进入规划。
  - **喊停语义升级**：使用者说「停，开始规划」**对整个项目生效**，不再只对当前版本生效；
    已确认版本照常出确认书，问到一半的版本用默认假设补齐并标注「未确认」。
  - 进度显示由「已清楚 x/9」改为「**第 N 版本 · 已清楚 x/9**」。
  - 硬约束 ④ 补一句：版本迭代下 = **每个版本各填满一份** 9 项清单。
- **新增并行规划与「组装验收」收口（硬约束 ⑦ 扩容）**：
  - 允许规划**互不依赖的任务并行**（例如任务 2 在推进、同时另开会话做 3/4/5），但必须三条同时满足：
    ① 依赖图里标出哪些可并行并给理由；② **改同一文件的任务不许并行**，必须串行；
    ③ **单列一个「组装验收」任务**排在这批并行任务之后，负责合并冲突 / 接口对齐 / 重复实现 /
    各自验收相互抵消的检查。**缺 ③ 视为规划不合格。**
  - §十一 增加：**按版本分组给顺序**、**必须画版本依赖图**（并列括号 = 可并行，并行线末端必须收到
    组装验收任务）、可并行时**同时开的会话不超过 3 个**。
- **总览文件新增必填小节**：`docs/工作流程/00-总览与使用说明.md` 必须有「**版本迭代规划**」小节
  （版本表 + 版本依赖图 + 并行说明三件齐全），缺这一节视为不合格（§五.7）。
- 任务文件信息头的「阶段」一栏明确填**版本号 + 阶段名**（如 `v0.2 核心能力`）。

### 文档

- `presets/task-planning-bundle/skills/planning-templates/SKILL.md`：
  骨架一新增【必须】小节「版本迭代规划」；任务总清单表新增「可并行?」列、改按版本分组；
  共用硬规则新增第 11 条「并行必须收口」；落盘前核对 **10 → 11 条**（新增版本迭代核对）。
- `README.zh.md` / `README.en.md`：使用流程按版本迭代重写（版本规划表 → 逐版本提问 → 每版确认书 →
  总确认书），补「可并行任务可同时开 2–3 个会话、但必须过组装验收」；产出表补版本迭代规划表一行。
- `presets/task-planning-bundle/README.md`：文件清单标注哨兵 `v10`、小节数更正为 15。
- `presets/task-planning-bundle/cordis.patch.yml`：新增 `touch` 记录（哨兵 `v9 -> v10`，用于触发 preset 重组）；
  persona 段补注释「**不要写 `suffix`（`{{cwd}}` 未注册）**」。
- `docs/实施记录/12-Release草稿-v1.2.0.md`（新增）：本版 Release 正文成文，格式对齐 `07` / `10` 两份草稿。

### 修复

- **persona 模板不得写 `{{cwd}}`**（`2026-10-18` 实测踩坑，随本版一并发布）：
  - 现象：preset 的 persona 段带 `suffix: Your working directory is {{cwd}}.` 时，**任何模型请求之前**就抛
    `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`，整个 prompt 组装失败、会话不可用。
  - 根因：persona 段的模板渲染只注册 `{{provider}}` / `{{model}}` 两个变量，`{{cwd}}` 从未注册；
    工作目录由运行时上下文（working-directory 服务）作为必需上下文注入，不需要在 persona 模板里再写一遍。
  - 处理：`presets/task-planning-bundle/cordis.patch.yml` 删掉该 `suffix` 行并补注释说明；
    旧机制留档目录 `presets/task-planning/agent.cordis.yml` 同步删掉该行；
    `docs/工作流程/01-仓库地基与预设骨架.md` / `04-模式系统提示词正文.md` 里**指导读者写这一行**的示例同步改正
    （这两处的改动已在工作区里，属于本次源码更新的一部分，随本版一并提交）。
  - 复核：改后 `{{cwd}}` 只出现在 `#` 注释里，求值的 YAML 值与 `PROMPT.md` 正文中**模板变量 0 处**；
    两份 YAML 均可解析（`js-yaml` + 自定义 `!!js` tag）。

### 未改动（有意保留）

- **硬约束 ① 原文一字未改**（「只规划不执行」）。本次改动本身属于「修改本模式自己的文件」，
  按使用者裁决走**会话内口头例外**，不写进提示词正文；因此 `PROMPT.md` 的自指边界保持原样。
- 历史记录（`docs/实施记录/`、`docs/验收报告/`、`docs/经验/`）记录的是当时口径，**不作追改**；
  本次改动的证据另见 `docs/实施记录/11-版本迭代询问法.md`。
  **唯一例外**：`docs/工作流程/01`、`04` 两份任务书里**教人写 `suffix: {{cwd}}`** 的那几行已改正——
  它属于「照抄就会让模式不可用」的错误指令，留着等于继续挖坑（见上面「修复」一节）。

### 验证（机器侧，2026-10-27）

- [x] 静态核对脚本 `55 PASS / 0 FAIL`：哨兵 `v10`；`PROMPT.md`、两份 README 里「最多 6 轮」「3–10 题」
      **零命中**；「每轮 3–9 题 / 最多 9 轮 / 上限 81 题 / 版本迭代询问法 / 组装验收」均按预期出现；
      12 条硬约束 ①–⑫ 齐全；15 个章节齐全；行数 **389 ≤ 400**；汉字 **9887**。
- [x] 运行方口径脚本 `9 PASS / 0 FAIL`：按 `cordis.patch.yml` 里两条 `!!js` 的**真实求值路径**
      （`createRequire` 以 profile 目录为 `baseUrl`）解析 → 读到 `PROMPT.md` **16862 字符**、与磁盘**逐字一致**、
      首行哨兵 `v10`；`skills/` 可解析且 `SKILL.md`（12606 字符）含「版本迭代规划」「组装验收」；
      patch 用 `js-yaml` 解析通过，`preset id` / 16 行插件 / 未设 `complete` / persona 仍读 `PROMPT.md` 全部通过。
- [x] `node --check plugins/token-estimator/index.js` 通过；`node tools/privacy-scan.mjs` → **block 命中 0**。
- [x] **发布前二次复核（2026-10-27，只读独立复核）**：两份 YAML 解析通过（`cordis.patch.yml` 用 FAILSAFE +
  自定义 `!!js` tag，`plugins` 16 行、4 行含 `!!js`；`agent.cordis.yml` DEFAULT_SCHEMA，顶层 5 行）；
  `PROMPT.md` 389 行 / 9887 汉字 / 哨兵唯一；旧口径 10 条正则（含全半角与 en-dash 变体）三份面向使用者文档
  **全 0 命中**；本次改动新增的 13 行 + 未跟踪新文件 121 行**本机信息 0 命中**；
  `{{cwd}}` 只存在于注释、求值字符串里的模板变量 0 处。
- [ ] **待人工**：重启桌面端 + 新开会话 → 问模式「当前哨兵值是多少」，答 `v10` 才算真生效
      （判据与步骤见 `docs/实施记录/11-版本迭代询问法.md` §6）。

---

## [1.1.0] - 2026-10-16

### 变更

- **删除「单任务 2 亿 token」限额标准**：
  - 插件 `presets/task-planning-bundle/plugins/token-estimator/index.js`：删掉 `TASK_LIMIT = 200_000_000`
    常量、`triggers.taskLimit` 字段与相关判定文案；`estimate_tokens` 只判断**「单对话 6000 万」一个阈值**
    （输出 schema 同步收窄、工具描述同步改，调用方拿不到 `taskLimit` 了）。
  - `presets/task-planning-bundle/PROMPT.md`：硬约束 ③、§七.2 三列结论、§七.7 样例表、§十五.3 去掉 2 亿口径；
    **§八 删掉「单次对话预估 > 2 亿 token → 必须告知并取得确认」整条**；§八.3「小项目主动说明」的判定
    改用「**可在一个对话内完成**」（不再引用两亿）；§八 因删条重编号（落盘 §八.6 → **§八.5**、
    拒绝立项 §八.7 → **§八.6**），正文互引同步改。哨兵 `v8 → v9`。
  - 面向用户文档：`README.zh.md` / `README.en.md` 的「token 估算表」一行改为只写 6000 万阈值。
  - 保留的阈值只有：**单任务预估 > 6000 万 → 必须二次拆分**（含估算表落盘要求，未动）。
  - 历史记录（`docs/实施记录/`、`docs/验收报告/`、`docs/经验/`、`docs/工作流程/` 任务书）**按原样保留**：
    它们记录的是当时口径，不作追改。

### 文档

- `docs/优化提示词/00-插件提示词-token估算器.md`（可单独拖入对话使用的接口契约）第 35 行删除
  「2 亿/单任务」返回项，§五 验收项由「两个阈值判断」改为「6000 万阈值判断」，并加了一行变更注记。

### 发布记录（2026-10-16）

- [x] 改动落地后的**机器验证**：`node --check` 通过；三组输入实跑 `estimate_tokens`，返回不含 `taskLimit`、
  对声明输出 schema 校验通过；`cordis.patch.yml` 解析通过且与改前结构逐字等价（16 行插件 id 完整）。
- [x] **推送前隐私门**：`node tools/privacy-scan.mjs` → **block 命中 0**（退出码 0）。首次扫描曾报 4 处
      `windows-user-path` 命中，均为**未推送**的本地提交里的家目录写法（`<盘符>:\Users\<用户名>\…`，
      用户名本就是占位符、无真实个人信息），已按本仓库规范统一改写为 `%USERPROFILE%` 后复扫通过。
      **注意**：本条发布记录第一次写的时候，把那个字面量原样抄了进来，复扫又报 1 处 —— 已改写为
      不带盘符的写法，并 `git commit --amend` + `git push --force-with-lease` 修正（tag `v1.1.0` 同步重建）。
      教训：**发布记录里不要抄敏感字面量，要抄也抄成不含盘符/用户名的形式**。
- [x] **打 tag 与发 Release**：`v1.1.0` → <https://github.com/TBTNCT/dsh-task-planning-mode/releases/tag/v1.1.0>。
- [x] **发布后验证**：把远端仓库**克隆回来复扫** → block 命中 **0**；`PROMPT.md` 首行哨兵 = `v9`；
      远端提交作者只剩中性身份（`dsh-task-planning-mode contributors <noreply@example.com>` /
      `dsh-agent <agent@local>`）。

---

## [未发布]

### 发布记录（2026-10-12 已完成）

- [x] **确认署名**：`LICENSE` 版权人 = `这里有只小西琳`（个人笔名署名）。
      规范依据：`docs/优化提示词/02-开源前隐私规范.md` §一 —— **个人签名允许但不强制**。
      若要改成集体署名，改 `LICENSE` + `README.zh.md` / `README.en.md` 的「许可」小节 + 本文件。
- [x] **GitHub 登录**：`gh auth login --hostname github.com --git-protocol https --web`（账号 `TBTNCT`）。
- [x] **推送前隐私门**：`node tools/privacy-scan.mjs` → **block 命中 0**，退出码 0。
- [x] **建仓库并推送**：<https://github.com/TBTNCT/dsh-task-planning-mode>（**public**，默认分支 `main`，
      GitHub 识别协议 = **MIT**）。
- [x] **打 tag 与发 Release**：`v1.0.0` → <https://github.com/TBTNCT/dsh-task-planning-mode/releases/tag/v1.0.0>。
- [x] **发布后验证**：把远端仓库**克隆回来复扫** —— block 命中 **0**、48 个提交的作者只剩中性身份
      （`dsh-task-planning-mode contributors <noreply@example.com>` / `dsh-agent <agent@local>`）、
      内部产物被跟踪 **0** 个。
- [x] **全局 git 身份改为 GitHub noreply**（方案 A）：
      `user.name = 这里有只小西琳`、`user.email = 325988531+TBTNCT@users.noreply.github.com`
      —— 避免今后每建一个新仓库都重新泄露真实邮箱。
- [x] **安装演练 A 段（真实路径）**：5 条判据全过（卸载 → 重启后模式消失 → 重装并启用 →
      重启后模式出现、无「加载失败」、哨兵答 `v8` → 无重复项）。记录见
      [`docs/验收报告/08-安装演练报告.md`](docs/验收报告/08-安装演练报告.md)。
      **注意**：任务书原本的判据（"删掉用户层副本 → 模式重新出现"）基于 0.1.x 旧机制，**在 0.2.x 上不成立**
      （用户层副本是死数据，删了模式照旧在），故拆成两段。

### 仍待办（可选）

- [ ] **安装演练 B 段（可选）**：删掉用户层副本 → 新开会话确认模式**仍在**（实测"死数据"结论）→ 用
      `install.ps1 -LegacyCopy -Force` 重建。

---

## [1.0.0] - 2026-10-12

首个版本。给 **DeepSeek Harness（DSH）** 增加「任务规划」模式。

### 新增

- **「任务规划」模式本体**（DSH Agent Preset，声明式 bundle 包）：`presets/task-planning-bundle/`
  - `cordis.patch.yml`：`insert` 一行 `@deepseek-ai/dsh-agent-preset`，`config.plugins` 内联标准档工具集
    （persona / agent-instructions / time-context / shell / fs / fs-search / jobs / skill / todo / ask-user / web / present / compaction 组）。
  - `PROMPT.md`：模式系统提示词正文（13 小节 + **12 条硬性约束**首尾双写 + 4 组作业纪律），
    由 persona 行的 `!!js` 按包名解析读入（不写相对路径）。
- **token 估算器本地工具插件**：`presets/task-planning-bundle/plugins/token-estimator/index.js`
  - 注册 `estimate_tokens`（可解释的静态区间 + 6000 万 / 2 亿阈值判定）与 `usage_report`（优先读运行时计量，读不到降级为静态对照）。
  - 单文件、纯 ESM、**零第三方依赖**（只用 `node:` 内置模块），任何失败都不抛错。
- **规划文档模板 skill**：`presets/task-planning-bundle/skills/planning-templates/SKILL.md`
  - 5 类规划文档（总览与使用说明 / 任务文件 / 通用规范 / 执行进度台账 / 验收报告）的【必须】与【可选】章节清单 + 可直接复制的骨架。
- **Demo**：`demo/shelter-idle/`（末日避难所挂机）—— 用本模式真跑一个项目，证明产出可用。
- **开源前隐私门禁**：`tools/privacy-scan.mjs` / `privacy-sanitize.mjs` / `privacy-lib.mjs` / `privacy-check.ps1`
  - 默认扫「会公开的东西」= git 跟踪文件 + **全部提交历史**（作者/提交者身份、提交信息、每个历史版本的文件内容）。
  - 规则分两层：通用规则入库（`privacy-rules.json`），本机真实字面量不入库（`privacy-local-rules.json`，已 `.gitignore`）。
- **安装/卸载脚本**：`install.ps1`（校验 + 打印插件管理器要粘贴的绝对路径；`-LegacyCopy` 支持 0.1.x 旧机制）、
  `uninstall.ps1`（删除用户层副本，先打印路径再删，支持 `-WhatIf`）。
- **新增规范**：`docs/优化提示词/02-开源前隐私规范.md`
  —— 一条硬规则：**最终程序只要有开源需求，开源前必须保证个人信息零泄露**；个人签名允许但不强制。

### 变更

- `PROMPT.md` 硬性约束 **11 条 → 12 条**（新增 ⑫ 开源前隐私门），哨兵 `v7 → v8`。
- `planning-templates` skill：骨架三铁律新增第 11 条（开源前隐私门）、骨架二补「发布类项目额外要求」、
  落盘前核对 **9 条 → 10 条**。
- `docs/优化提示词/01-通用规范.md` 铁律新增第 13 条；`docs/工作流程/08-开源化与发布.md` 新增第 0 步（先过隐私门）与硬性要求 9。
- 仓库跟踪文件 **102 → 77**：内部验证产物（`demo/_自测/`、`demo/_自测-复测/`、`demo/_验收/`、`notepad-app/`）
  与沙箱 ACL 报告（`**/.dsh-acl-report/`、`**/acl-recovery/`）改为不跟踪，并补进 `.gitignore`。

### 安全

- **重写全部提交历史**（41 个提交）：作者 / 提交者由真实邮箱改为中性身份
  `dsh-task-planning-mode contributors <noreply@example.com>`；历史树里的个人信息（登录用户名、邮箱、家目录绝对路径、机器 SID）
  全部占位化；内部产物从历史中移除。旧→新 hash 对照见 `docs/实施记录/06-历史重写对照表.md`。
- 工作区文本占位化 **52 个文件 / 487 处**。
- 全量扫描结果：**API key / token / 私钥 / 口令 命中 0**（无需吊销）；审计报告见 `docs/验收报告/08-开源前泄露审计报告.md`。
- 提交身份：本仓库 `git config --local` 已设为中性身份，避免后续提交再次带上真实邮箱。

### 已知限制

- 未在 **macOS / Linux** 实测（仅 Windows + Windows PowerShell 5.1 实测）。
- preset **据机制推导**不能携带浏览器 UI（**推导，未做运行时验证**）。
- 用户自建 preset 在模式列表里的精确排序语义为**推导**，未在本机枚举验证。
- `PROMPT.md` 体积偏大（14691 字符 / 8664 汉字），每个请求都要加载；精简列入后续版本。

---

## 版本号约定

- `v1.0.0` 之前不保证兼容；`preset` 的 `id`（`task-planning`）一经发布不再改，避免使用者已保存的会话找不到模式。
- 改动 `PROMPT.md` 或 `skills/` 下的文件后，必须**同时触碰 `cordis.patch.yml`**（改一行注释即可）才能让 preset 重组生效；
  详见 `presets/task-planning-bundle/README.md` 第四节第 7 条。
