# 更新日志

本文件记录本项目的显著变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.3.0] - 2026-11-12

### 变更

- **token 估算统一 ×20 校准**（依据 ds4.1f 实测消耗）：
  - `plugins/token-estimator/index.js` 新增 `CALIBRATION_FACTOR = 20`，**只乘在 `raw` 一行**
    （`LOW_FACTOR` 0.8 / `HIGH_FACTOR` 2.5 / `RETRY_FACTOR` 1.5 的语义不变，不混入标定倍率）。
  - 返回值新增 `breakdown.calibrationFactor` 与顶层 `calibrationNotice`，`usage_report` 新增 `disclaimer`；
    `output.schema` 同步声明，渲染文本输出「校准：×20（本估算基于 ds4.1f 消耗计算）」。
  - **6000 万阈值不变**，判据是**单任务预估高值**（`triggers.taskSplitExceeded`）。校准后更容易触发，
    这是正确行为：**触发就拆分，不许为了不触发而调小系数或抬高阈值**。
  - 单点反推可复核：`(c) 高值 ÷ 20 = 14,490,000`，正好回到 ×20 之前的标定高值 14.49M。
- **并行规划扩容**（硬约束 ⑦ / §八.8 / §十一）：
  - 主动找并行；允许**要求用子代理执行**并行批次；给五条硬判据（写入范围不重叠 / 必须回主会话复核 /
    依赖与接口先对齐 / 单列组装验收 / 上限 2 个会话）。
  - **无子代理时必须写「无子代理，已串行」**，不许标了并行却串行做完还说并行过。
- **新增必须产出物 `docs/工作流程/00-任务执行流程图.html`**（编号 `00`，不是任务）：
  由模板 `skills/planning-templates/assets/task-flow.html` 生成，**只替换 `window.TASK_FLOW_DATA`**；
  呈现进度条 / 依赖边 / 并行批次 / 五态 / 「下一个该做的任务」；**状态以执行进度台账为准**。
- **任务文件新增必填第六节「六、收尾交接」**：用 `ask_user_question` 逐条问人工决策（不许自行决定）+
  给出**下一个任务预计耗时**（区间 + 依据）。
- **结构变化**：正文骨架 **五节 → 六节**、自检 **11 → 14 条**、哨兵 **v10 → v11**；
  **硬约束仍是 12 条**（5 条模式自省判别式放 §一.9~§一.13，不新增第 ⑬ 条）。

### 文档

- `skills/planning-templates/SKILL.md`（501 → 633 行）：新增「骨架六：任务执行流程图（HTML）」与
  骨架二「六、收尾交接」；共用硬规则 11 → 13 条（并行必须可执行 / 任务收尾必须交接）；
  落盘核对 11 → 13 条；新增「三、模式自省规则」（5 条判别式，与 `PROMPT.md` §一.9~§一.13 逐字一致）；
  补 4 行 ds4.1f 口径注记（任务 20 的 C2 修正）。
- 新增 `skills/planning-templates/assets/task-flow.html`（967 行 / 45,077 字节，**零外链**；
  状态只存本机 `localStorage`）。
- `PROMPT.md`（388 → 435 行 / 12419 汉字）：×20 校准口径（§零 ③ / §七.8）、并行与子代理（§零 ⑦ / §八.8 /
  §十一.8）、流程图（§一.2 / §五 目录表 / §五.8 / §十一.8）、收尾交接（§六 骨架 / §十一.9 / §十二 自检）、
  自省判别式（§一.9~§一.13），哨兵 `v11`。
- `docs/优化提示词/00-插件提示词-token估算器.md`：新增 §2.5「校准口径」表格与文末 §七「变更记录」。
- `cordis.patch.yml`：新增 `touch` 记录（哨兵 `v10 -> v11`，五件事逐条登记；**这是 preset 重组的触发器**）。
- `docs/优化提示词/01-通用规范.md` 新增「六、v1.3.0 增量补充」（估算口径 / 流程与并行 / 收尾交接 / 发布面 / 模式自省）。
- `docs/工作流程/00-总览与使用说明.md`：规划期估算表与 §八 总账**只加口径标注、不改原数字**
  （该表是规划期人工档位粗估，不是 `estimate_tokens` 输出，×20 对它不适用；整项目量级按工具口径为约 92M–290M）。
- 三份 README + 两份 `presets/` README 同步（流程图产出、收尾交接、×20 标注、`PROMPT.md` 实际体积、哨兵 `v11`）。

### 未改动

- preset id（`task-planning`）与工具行集合（顶层 16 行 / 展开 19 行）未动；插件仍是**单文件零依赖**
  （只 import `node:` 内置模块）。
- `docs/实施记录/03` 等历史记录里的旧标定数字（4.64M–14.49M）**按铁律 14 不追改**——
  它们是「×20 之前」的口径证据。
- `docs/实施记录/` 下任何文件、台账 01–10 行的历史内容均未改动。

### 验证

- **任务 11（估算校准）**：三组规模实算与任务书基准**偏差全部 0.0000%**
  （(a) 11,492,800 / 35,915,000 / 35,555,850；(b) 11,752,000 / 36,725,000 / 36,357,750；
  (c) 92,736,000 / 289,800,000 / 286,902,000 且 `taskSplitExceeded=true`）；`CALIBRATION_FACTOR = 20`
  全文仅一处参与计算；宿主 `assertSupportedJsonSchema` + `validateJsonSchemaValue` **7 项 0 violations**；
  `node --check` 退出码 0。
- **任务 12（流程图与骨架）**：`task-flow.html` **967 行 / 45,077 字节**，五类外链命中 **全 0**、悬空依赖 0、
  五态 5/5；`SKILL.md` 501 → 601 行；五项自检 **31 PASS / 0 FAIL** + 逻辑冒烟 **34 PASS / 0 FAIL**。
- **任务 13（并行与收尾交接）**：`PROMPT.md` 388 → 415 行 / 11576 汉字 / 哨兵 `v11`；18 处替换各命中恰好 1 次、
  顶级 `##` 16 个；`正文五节`/`五节`/`14.5M`/`v10` 旧口径 **全 0 命中**。
- **任务 13A（模式自省）**：5 条判别式两处 **sha256 相同、逐字差异 0 处**；硬约束 ①–⑫ 完整（无 ⑬）。
- **任务 20（组装验收）**：跨文件对账 **7/7 PASS、不一致项 0 条**，结构检查 **2/2 PASS**；
  `PROMPT.md` 哨兵 `v11`、顶级 `##` 排除围栏 16 个、`task-flow.html` 外链 5 项全 0；
  只读文件（`package.json` / `CHANGELOG.md` / README / `cordis.patch.yml` / `docs/实施记录/`）`git diff` 为空；
  回归 **20/20 PASS**；人工在 Windows PowerShell 5.1 逐行实跑 **7/7 PASS**（2026-11-13 11:37）。
- **本任务（30）**：版本元数据与文档自检见 `docs/验收报告/30-报告.md`；`plugins/`、`skills/`、`PROMPT.md`
  的 `git diff` 为空。

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
- `presets/task-planning-bundle/README.md`：文件清单标注哨兵 `v10`、小节数更正为 15；
  安装步骤里的版本号 `0.1.0` → `1.2.0`（与 `package.json` 同步）。
- `presets/task-planning-bundle/package.json`：**补齐 npm 发布所需字段** ——
  `version` `0.1.0 → 1.2.0`（与仓库 tag / Release 对齐，避免「npm 上是 0.1.0、GitHub 上是 v1.2.0」）；
  新增 `repository`（`git+https://github.com/TBTNCT/dsh-task-planning-mode.git`，
  `directory: presets/task-planning-bundle`，市场按它把 npm 包与仓库关联，不匹配则判定为未发布）；
  新增 `engines.dsh: ">=0.2.0-0 <0.3.0-0"`（市场索引 format 1 要求每版本必须声明；
  `-0` 前缀是为了让 rc/alpha 预发布版也能满足，不加会静默排除所有预发布运行时）；
  新增 `files` 白名单（`PROMPT.md` / `cordis.patch.yml` / `plugins/` / `skills/`），把打包内容钉死。
  **实测**：`npm pack` 出 6 个文件 / 45 KB，在隔离目录装回后用 DSH 的 `createRequire` 解析路径复核，
  `PROMPT.md`（哨兵 `v10`）、`package.json`、`skills/`、插件行全部可解析。
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

### 发布记录（2026-10-27）

- [x] **推送**：`32100ab..41e773e` 推到 `main`（3 个提交）；`git ls-remote` 复核远端 `main` = `41e773e`。
- [x] **tag 与 Release**：附注 tag `v1.2.0`（`f6de2d8`）已推送；
      Release <https://github.com/TBTNCT/dsh-task-planning-mode/releases/tag/v1.2.0>（非草稿、非预发布）。
- [x] **发布后复验（从远端取回快照再扫，2026-10-27）**：
      拉取 `api.github.com` 上 `v1.2.0` 的 tarball（`github.com:443` 当时连接超时，故改走 API，结果等价）→
      `PROMPT.md` 首行哨兵 **`v10`**、389 行 / 9887 汉字；关键文件 9/9 齐备；
      内部产物目录（`_自测` / `_验收` / `notepad-app` / `.dsh-acl-report`）**0 个**；
      隐私门 `--worktree-only` → **block 命中 0**（warn 16 处均为既有机器布局路径）；
      远端最近 5 个提交的作者/提交者**全部是中性身份**。
### 发布面隐私复核（2026-10-27）

- **审计对象不是工作区，而是实际已公开的三处**：npm 包内容（解出 registry 上真实 tarball）、
  npm registry 公开元数据、市场 PR #9840 的 diff。
- **npm 包内容（6 个文件）逐字扫**：本机用户名 0 / 邮箱 0 / SID 0 / 凭据特征 0 / 家目录真实写法 0；
  仓库门禁（通用 14 条 + 本机 13 条）**block 0**，warn 2 处为 `D:\.pnpm-store\v11`——
  pnpm 在任意 Windows 机器上的默认 store 路径，不含身份信息，且在讲 `ERR_PNPM_UNEXPECTED_STORE` 的排错上下文里。
- **市场 PR #9840 的 6 行 diff**：只有公开 URL、仓库名、分类 id 与两段描述，**0 处个人信息**；
  提交身份为 `325988531+TBTNCT@users.noreply.github.com`（noreply）；本仓库提交为中性身份。
- **npm registry 公开元数据**的 `maintainers` / `_npmUser` 会写入发布者**账号邮箱**（本文已占位化记录）。
  该字段来自账号设置而非 `package.json`，**在仓库里做什么清洗都无法覆盖它**，且已发布版本不可回改。
  **裁决：接受（不处理）**，理由与后续改法的说明见 `docs/实施记录/17-发布面隐私复核.md` §五之一。
- **过程中一次自伤（如实记录）**：写审计文档时把该邮箱原样抄了进去，门禁当场拦下（block 3）。
  已改为 `<EMAIL_REDACTED>` / `<npm_user>` 占位符并加注说明——与 v1.1.0 发布记录里踩过的同一个坑同源。

- **过程中的一次网络自伤（如实记录）**：`git push` / `git clone` 有数次报
      `Failed to connect to github.com:443`，重试若干次后 `push` 成功（第 3 次尝试 + `http.version=HTTP/1.1`）；
      克隆始终连不上，改用 `api.github.com` 的 tarball 完成复验。**结论不变，但复验路径与任务书示例不同**。

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
