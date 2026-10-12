# 00-插件提示词 · token 估算器（优先级最高，先于全局提示词）

> 命名依据：模式规则 3(6)——**插件类提示词按名称排序优先级最高，先于全局提示词**。
> 因此本文件编号 `00`，排在 `01-通用规范.md` 之前：执行任何涉及该插件的任务时，**先读本文件，再读通用规范**。
> 对应主线任务：`docs/工作流程/03-token估算器插件.md`（本文件是它的精简版指令书，可单独拖入对话使用）。

---

## 一、插件定位

| 项 | 内容 |
|---|---|
| 名称 | `token-estimator` |
| 形态 | **preset 自带的本地 JS 插件**（不是独立 npm 包）：`presets/task-planning/plugins/token-estimator/index.js` |
| 挂载方式 | `presets/task-planning/agent.cordis.yml` 里一行：`name: './plugins/token-estimator/index.js'`（相对 preset 目录） |
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

1. 低估算 / 高估算 / 合计（保守口径：输入+输出 ×1.5 重试系数）
2. 是否触发 **6000 万/单对话** 阈值 → 若触发，明确输出"必须二次拆分"
3. 是否触发 **2 亿/单任务** 阈值 → 若触发，明确输出"必须告知使用者并取得确认"
4. 估算依据（哪些事实支撑这个量级）
5. 一句免责说明："这是估算，不是承诺"

### 工具 2：`usage_report`

| 参数 | 必填 | 说明 |
|---|---|---|
| `sessionId` / `taskId` | 否 | 不传则报告当前会话 |

**返回必须包含**：

1. 运行时计量的已用 token（**能读到才给数字，并附调用证据来源**）
2. 读不到时：明确写"运行时计量不可用（原因）"，并给静态估算对照
3. 一句建议：是否需要收尾/是否需要拆分

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

- [ ] 模式内调用 `estimate_tokens` 返回低-高区间 + 两个阈值判断 + 依据
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
最后告诉我人工如何验证（调什么、看什么）。
```
