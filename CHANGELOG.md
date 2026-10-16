# 更新日志

本文件记录本项目的显著变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## [未发布]

### 变更

- **删除「单任务 2 亿 token」限额标准**（2026-10-16）：
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
