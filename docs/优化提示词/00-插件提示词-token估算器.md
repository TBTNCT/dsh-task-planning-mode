# 00-插件提示词 · token 估算器（优先级最高，先于全局提示词）

> 命名依据：模式规则 3(6)——**插件类提示词按名称排序优先级最高，先于全局提示词**。
> 因此本文件编号 `00`，排在 `01-通用规范.md` 之前：执行任何涉及该插件的任务时，**先读本文件，再读通用规范**。
> 对应主线任务：`docs/工作流程/03-token估算器插件.md`（本文件是它的精简版指令书，可单独拖入对话使用）。

---

## 一、插件定位

| 项 | 内容 |
|---|---|
| 名称 | `token-estimator` |
| 形态 | **preset 自带的本地 JS 插件**（不是独立 npm 包）：`presets/task-planning-bundle/plugins/token-estimator/index.js` |
| 挂载方式 | `presets/task-planning-bundle/cordis.patch.yml` 里一行：`name: './plugins/token-estimator/index.js'`（相对 preset 目录） |
| 宿主 | DSH desktop profile（本机 DSH_HOME = `%USERPROFILE%\.dsh`） |
| 目的 | 让「任务规划」模式的 token 估算有硬数据：**运行时计量优先，静态估算兜底** |

**它不是一个"精确计算器"**：它的职责是（a）尽量读到真实用量；（b）读不到时给出可解释的区间；
（c）永远不让模式因为估算失败而中断。

## 二、接口契约（必须先定死，再写实现）

### 工具 1：`estimate_tokens`

| 参数 | 必填 | 说明 |
|---|---|---|
| `stage` | 是 | 阶段名/阶段描述（例如"工具集接线与实测"） |
| `scale` | 否 | 规模参数：预计文件数、是否含前端、是否含游戏逻辑、是否含联网等（给默认值） |

**返回必须包含**（缺一不可）：

1. 低估算 / 高估算 / 合计 = 工具 total = (低+高)/2 × 1.5
2. 是否触发「任务拆分阈值（6000 万）」 → 若触发，明确输出"必须二次拆分"
3. 估算依据（哪些事实支撑这个量级）
4. 一句免责说明："这是估算，不是承诺"
5. **校准说明**：返回值里的 `calibrationNotice` 必须含「**本估算基于 ds4.1f 消耗计算**」，
   且 `low` / `high` / `total` 三个数值**已经按 ×20 校准**（不是"原始值 + 一句提示"）；
   `breakdown.calibrationFactor` 给出所用系数（当前为 `20`）。渲染文本同样要出现这一标注，见 §2.5。

> **2026-10-16 变更**：曾有的第 3 项「**2 亿/单任务** 阈值（触发则必须告知使用者并取得确认）」已删除，
> 不再是判断标准；现在的阈值只有「任务拆分阈值（6000 万）」。同步改动见 `CHANGELOG.md` 的 `[1.1.0]`。

### 工具 2：`usage_report`

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionId` / `taskId` | 否 | 不传则报告当前会话 |

**返回必须包含**：

1. 运行时计量的已用 token（**能读到才给数字，并附调用证据来源**）
2. 读不到时：明确写"运行时计量不可用（原因）"，并给静态估算对照
3. 一句建议：是否需要收尾/是否需要拆分

### 2.5 校准口径（2026-11-12 起，v1.3.0 任务 11）

| 项 | 内容 |
|---|---|
| 系数 | `CALIBRATION_FACTOR = 20`（定义在插件常量区） |
| 依据 | 使用者**实测**：模型 `deepseek-v4.1-flash`（简称 **ds4.1f**）的真实消耗，平均约为原静态公式输出的 **20 倍** |
| 作用点 | **只乘在 `estimate()` 里 `raw` 那一行**（`raw = (…) × 乘子 × CALIBRATION_FACTOR`）。全文不许出现第二处乘 20，否则变成 400 倍 |
| 不受影响的常数 | `LOW_FACTOR`（0.8）/ `HIGH_FACTOR`（2.5）/ `RETRY_FACTOR`（1.5）语义不变——它们是**区间与重试系数**，不是标定倍率，混用就没人说得清某个数代表什么 |
| 阈值 | **任务拆分阈值（6000 万）保持不变**，判断口径是单任务预估高值。校准后更容易触发，**这是正确行为**；不许为了不触发报警把系数调小或把阈值抬高 |
| 必须标注 | 返回值 `calibrationNotice`、`estimate_tokens` 渲染行 `校准：×20（本估算基于 ds4.1f 消耗计算）`、`usage_report` 的 `notes`，三处都要出现「本估算基于 ds4.1f 消耗计算」 |
| 两个口径不可相减 | `usage_report` 的「已用」是**运行时实测**的本会话累计，静态对照是**校准后的公式预估**，量纲与来源都不同，只能并列陈述，不能做差 |
| 标定后的量级 | 以本项目（8 个主任务 / 约 40 文件 / 6 万字文档 / 5 千行既有代码）代入：**校准前约 4.6M–14.5M → 校准后约 92M–290M** |

> 历史口径提示：`docs/实施记录/03-token估算器实测.md` 里的 4.64M–14.49M 是**校准前**的标定值，
> 按铁律 14（历史记录只归档不追改）保持原样，自 v1.3.0 起一律以校准后数字为准。

## 三、技术路线（照这个顺序做，别跳）

1. **读机制**：`docs/调研/01-preset机制.md` —— 确认 preset 支持相对路径行、本地插件随 preset 分发。
2. **读工具链**：`docs/调研/02-插件工具链.md` —— 确认无全局 `dsh` 命令、插件是纯 ESM JS。
3. **抄结构**：读 `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-tool-todo\`
   的 `package.json` 与 `lib/index.js`，照它写"插件如何声明 name / Config / inject / apply、
   工具如何注册、schema 怎么写"。**不许凭记忆猜 API**。
4. **探测计量服务**：读
   `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-token-meter\` 与
   `...\dsh-session-stats\` 的 README.zh.md 与 `lib/types/*.d.ts`，回答：
   服务名是什么？有没有"按会话读已用 token"的公开方法？签名与单位？preset 内能否解析到？
   **把结论写进记录文件（含 file:line 证据）**。
5. **实现**：两个工具 + 静态算法 + 降级逻辑（任何探测失败都不许抛错中断）。
6. **挂载 + 安装**：改 `agent.cordis.yml`，复制到 `%USERPROFILE%\.dsh\.agent-presets\task-planning\`，
   新开会话实测。
7. **落盘**：`docs/实施记录/03-token估算器实测.md`（探测结论 + 两个工具真实输入输出 + 降级验证）。

## 四、硬性要求

1. 禁止修改 `<DSH_INSTALL>\...` 与 `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\...`（只读）
2. 每个内部 API 用法都要有"从哪个文件哪一行读到的"证据
3. **不许伪造用量数据**；数字要么来自计量服务（附证据），要么来自可解释的静态公式
4. 工具失败必须降级为可用输出；不许让模式整体不可用
5. 相对路径行挂载失败时的回退顺序：`./plugins/...` → `file:///` 绝对路径 → 独立 npm 包（并在记录里写清取舍）
6. 纯 ESM、无第三方依赖、中文注释；提交信息 `[任务03] token估算器插件`
7. 同一个错误超过 3 次仍失败：停下，把现场写进记录并给两条备选路线

## 五、验收（人工可复核）

- [ ] 模式内调用 `estimate_tokens` 返回低-高区间 + 6000 万阈值判断 + 依据
- [ ] 模式内调用 `usage_report` 返回可用信息（真实用量或明确的降级说明）
- [ ] 人为让计量服务不可用时，两个工具仍返回静态估算（有验证记录）
- [ ] `agent.cordis.yml` 挂载该行后模式不 broken
- [ ] `docs/实施记录/03-token估算器实测.md` 有探测证据与真实样例

---

## 六、可直接复制的提示词（单独拖入对话时用这一段）

```
请为 DSH 的「任务规划」模式实现一个自带的本地工具插件 token-estimator（纯 ESM JS），
提供 estimate_tokens 与 usage_report 两个工具。按"先读源码 → 再写代码 → 再实测"的顺序做，
不许凭记忆猜 DSH 内部 API。

先读（全部只读）：
1. <REPO>\docs\优化提示词\00-插件提示词-token估算器.md（本文件，接口契约）
2. <REPO>\docs\调研\01-preset机制.md
3. <REPO>\docs\调研\02-插件工具链.md
4. %USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-tool-todo\（写法样板：package.json + lib/index.js）
5. %USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-token-meter\ 与 dsh-session-stats\
   （计量服务探测：服务名、方法签名、能否从 preset 内解析到）

然后：
- 写 presets\task-planning\plugins\token-estimator\index.js（中文注释，无第三方依赖）
- 在 presets\task-planning\agent.cordis.yml 加一行挂载：name: './plugins/token-estimator/index.js'
- 复制 presets\task-planning\ 到 %USERPROFILE%\.dsh\.agent-presets\task-planning\（覆盖）
- 新开会话切到「任务规划」实测两个工具，含"计量不可用时的降级"路径
- 写 <REPO>\docs\实施记录\03-token估算器实测.md

硬性要求：不许伪造用量；不许抛错中断；每个 API 用法给出处（file:line）；挂载失败按
'./plugins/...' → 'file:/// 绝对路径' → '独立 npm 包' 顺序回退，并把结论写进记录。
**静态估算必须按 ×20 校准**：`CALIBRATION_FACTOR = 20` 只许乘在 `estimate()` 的 `raw` 那一行
（不许改 `LOW_FACTOR`/`HIGH_FACTOR`/`RETRY_FACTOR`，更不许出现第二处乘 20），且返回值与渲染文本都要标注
「本估算基于 ds4.1f 消耗计算」；「任务拆分阈值（6000 万）」保持不变。
最后告诉我人工如何验证（调什么、看什么）。
```

---

## 七、变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-12 | 静态估算统一 ×20 校准（实测 ds4.1f 实际消耗约为原输出 20 倍），返回值与渲染文本必须标注「本估算基于 ds4.1f 消耗计算」。 |
| 2026-11-13 | 任务 20 人工决策 4：`usage_report` 取消失效的「已用 ≤ 静态高估算」对照判据，回归纯报告（只并列陈述已用与静态区间、不做跨口径比较）；`estimate_tokens` 的 `triggers.taskSplitExceeded` 由 `total` 改为按 `high` 判定，对齐 `PROMPT.md` §七.7/§十五.3「判阈值一律用高值」。详见 §八。 |
| 2026-11-13 | 任务 20 三轮检查整改：常量/字段改名为 `TASK_SPLIT_LIMIT` / `taskSplitExceeded`，全仓库活文档同步；阈值措辞统一为「任务拆分阈值（6000 万）」；舍入规则改为「按工具 `fmt()` 显示值照抄」；合计口径统一为「工具 total = (低+高)/2 × 1.5」；插件路径修正为 `presets/task-planning-bundle/…`。旧名 → 新名映射与历史文件例外清单见 `20-报告.md` §九。 |

---

## 八、对照口径归位（v1.3.0 任务 20，2026-11-13）

> 本节是**人工裁决落地**（任务 20 §六 决策 4），取代 §二 工具 2 第 3 项与 §2.5「两个口径不可相减」里关于「给静态估算对照 / 一句建议」的旧描述。旧记录按铁律 14 不追改，只在此登记新口径。

| 项 | 内容 |
|---|---|
| 6000 万的原义 | **任务拆分阈值**：`PROMPT.md` §零③ / §七.7 / §七.8 / §八.1 / §十五.3 与本文档 §2.5 —— 判据对象是「**单个任务的静态预估高值**」，高值 > 6000 万就拆成多个不超过它的任务。**它不是本会话的 token 预算，也不是进度条的分母** |
| 作废的旧判据 | `runtime.used <= staticResult.high`（「已用 ≤ 静态高估算」）。×20 校准后默认规模高估算抬到 **35,555,000**，而本项目历史会话实测「已用」是万级 → 恒不触发，「已超过预估」提醒事实上失效（`11-报告.md` §四 第 3 行 / §7.1 第 7 项） |
| 新口径（纯报告） | `usage_report` 只并列陈述「本会话已用」与「静态估算区间（低～高 / 保守合计）」，**不做任何大小比较、不据此给拆分建议**；`advice` 统一指向 `estimate_tokens` 的 `triggers.taskSplitExceeded`。这与 `PROMPT.md` §七.5「两个口径不能相减、也不能用实测远低于预估判定估算失真」一致 |
| 判阈值改为按高值 | `estimate()` 原写 `total > TASK_SPLIT_LIMIT`，与 `PROMPT.md` §七.7/§十五.3「判断 6000 万阈值一律用高值」不符。因 `total = 0.99 × high`，当 `high ∈ (6000 万, 6060.6 万]` 时会误判为「未触发」；现改为 `high > TASK_SPLIT_LIMIT`。`total` 仍照常返回，只作总量参考（§七.8） |
| 降级路径 | 运行时计量不可用时只给静态区间 + 原因，不编造对照结论；建议里写明「恢复后重新调用，拆分判定仍以 estimate_tokens 高值为准」 |
| 不变的东西 | `output.schema` 的字段名与类型、`estimate_tokens` 的 low/high/total 三个数值、`CALIBRATION_NOTICE`、`LOW_FACTOR` / `HIGH_FACTOR` / `RETRY_FACTOR`、`TASK_SPLIT_LIMIT` 与 6000 万阈值本身 |
| 范围说明 | 本次改动越过任务 20 任务书「只做对齐、不重新实现功能」的负面清单，属**人工裁决覆盖卡片判据**（同 13A「直接删分支」），登记在 `20-报告.md` §八 |
| 代价 | `usage_report` 失去「已超过预估 / 接近上限」的提前提醒能力，降级为纯报告工具；此后果已在 `20-报告.md` §八 登记，由使用者明确接受 |
