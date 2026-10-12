# 任务 03 实施记录 · token 估算器实测

> 任务文件：`docs/工作流程/03-token估算器插件.md`（含 2026-10-12 人工授权的「版本适用性警告」横幅，本次执行以横幅为准）
> 执行时间：2026-10-12
> 记录来源标注：**AI 机器验证**（本机 Node v24.20.0 直调 + 源码只读） / **人工执行**（需重启桌面端与新开会话的动作，见 §7）
> 配套结论：`docs/验收报告/03-报告.md`

---

## 0. 环境与前提

| 项 | 值 | 备注 |
|---|---|---|
| 仓库 | `<REPO>`（NTFS） | 本任务全部产出落在此 |
| 运行时机制 | **新版声明式 preset**（bundle 补丁 + `@deepseek-ai/dsh-agent-preset`） | 旧「preset 目录」在本机无效（`docs/调研/03-preset机制-新版.md`） |
| bundle 包 | `presets/task-planning-bundle/`，profile 里以 `link:` 安装为包名 `dsh-task-planning-preset` | 证据：`%USERPROFILE%\.dsh\profiles\desktop\package.json` 的 `dsh.profile.bundles` 含 `dsh-task-planning-preset`，`node_modules` 里是同名符号链接 |
| Node | `v24.20.0`（`E:\node.exe`） | |
| 只读对象 | `<DSH_INSTALL>\…`、`%USERPROFILE%\.dsh\profiles\…` | 全程未写、未改（铁律 1） |

**为什么本任务的落点不是任务书正文写的 `presets/task-planning/plugins/…`**：横幅已判定该思路"失去宿主"。
本次实测进一步给出了**确切的机制原因**（§2 E3）：loader 的相对行名是按 `new URL(name, ctx.baseUrl)` 解析的，
而 `ctx.baseUrl` 是 **profile 配置目录**，不是 patch 文件所在目录。故落点改为 bundle 包内 + 包名子路径行。

---

## 1. 计量服务探测结论（全部只读，含 `file:line`）

### 1.1 `@deepseek-ai/dsh-token-meter`（**可用**，本任务选用的运行时计量来源）

| 问题 | 结论 | 证据（file:line） |
|---|---|---|
| 服务名 | `tokenMeter`（挂到 `ctx.tokenMeter`） | `lib\types\index.d.ts:14-17`（`declare module '@deepseek-ai/cordis' { interface Context { tokenMeter: TokenMeter } }`）；`lib\types\index.d.ts:20`（`class TokenMeter extends Service`） |
| 有无"按会话读已用 token"的公开方法 | 有：`measure(session, requestHeader?)` 返回**当前请求与表面压力**（`totalTokens` / `surfaceTokens` / `nodes`）；另有 `estimateMessage(message)` | `lib\types\index.d.ts:46`（`measure(session: Session, requestHeader?: EpochHeader): TokenMeasurement`）；`README.zh.md`「测量压力」一节原文：`` const { totalTokens, surfaceTokens, nodes } = ctx.tokenMeter.measure(session) `` |
| 语义与单位 | **token 数（整数）**；`totalTokens` 是请求+响应压力，`surfaceTokens` 是仅表面路由定价总量 | `README.zh.md`「测量压力」一节 |
| 更贴近"本会话累计已用"的口径 | **投影单元 `tokenUsage`**：`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`，来自**完整持久日志**（分页与压缩不改变它） | `lib\types\usage-projection.d.ts:12-29`（state schema）；`README.zh.md`「会话投影」一节原文：「`tokenUsage` 携带完整持久日志中的 `uncachedInputTokens`、`outputTokens`、`cacheReadTokens` 与 `cacheWriteTokens`」 |
| 另两个投影 | `contextPressure`（`pressureTokens` / `projectedTokens` / `contextWindow`）、`contextBreakdown`（`systemTokens` / `toolsTokens` / `messageTokens`，**启发式近似**） | `lib\types\usage-projection.d.ts:38-49`；`README.zh.md`「会话投影」一节 |
| preset 内能否解析到 | **能**（设计上）：`dsh-base` 在 profile 基座挂了 `token-meter` 与 `session-projection`；本 preset 的 `compaction` 组 `isolate` 只隔离 `compaction`/`toolResultPruner`，不影响这两个服务 | `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-base\cordis.patch.yml:317-318`（`- id: token-meter` / `name: '@deepseek-ai/dsh-token-meter'`）与 `:138-139`（`- id: session-projection`） |

### 1.2 `@deepseek-ai/dsh-session-stats`（**不作为计量来源**）

| 问题 | 结论 | 证据 |
|---|---|---|
| 服务名/形态 | 它**不是可调用服务**，只注册一个投影单元 `sessionStats` | `lib\types\index.d.ts:14`（`export declare const name = "session-stats"`）、`:22`（`export declare function apply(ctx: Context): void`）；`README.zh.md`「模型体验」一节原文：「不注册任何面向模型的内容」 |
| 字段 | `turns` / `steps` / `llmMs` / `toolMs` / `ttftMs` / `decodeMs` / `decodeTokens`（**只有提供方输出 token 之和，没有输入侧**） | `README.zh.md`「各字段含义」表 |
| 是否挂载 | **本 profile 未挂载**（`dsh-base` 的 patch 里没有它） | `grep -rn "session-stats" dsh-base/*.yml` → 无命中；`dsh-base/cordis.patch.yml` 只有 `session-projection` / `session-projection-cache` / `token-meter` |
| 处置 | **不依赖它**。即便它挂了，字段也缺输入侧，不足以支撑"本会话已用 token" | —— |

### 1.3 探测结论汇总

- **运行时计量可用**，本插件取两条来源，按序尝试：
  1. `ctx.get('sessionProjections').snapshot(session).values.tokenUsage` → `uncachedInputTokens + outputTokens`（**主口径**，完整日志、不受压缩影响）。
     读取 API 证据：`@deepseek-ai/dsh-session-projection\README.zh.md`「注册与读取」一节原文：`` const { asOfSeq, values } = ctx.sessionProjections.snapshot(session) ``，以及「载体使用 `ctx.get('sessionProjections')`，注册表缺席时省略自己的块或帧」。
  2. `ctx.get('tokenMeter').measure(session).totalTokens`（兜底口径）。
- 两条都取不到 → **降级为静态轨并写明原因**，不抛错。
- **`inject` 只声明 `tools`**：把 `sessionProjections` / `tokenMeter` 放进 `inject` 会让 fiber 在它们缺席时**挂起**（`dsh-session-projection\README.zh.md` 原文：「inject 使 fiber 保持挂起」），连静态估算都注册不上；故运行时用 `ctx.get(...)` 可选读取。

> ✅ **该"未验证项"已于 2026-10-12 由人工在模式内实测闭合**：`usage_report` 返回了**运行时实测值 7.6K**
> （见 §7.1 第 3 步），即"preset 内确实拿得到运行时计量服务"由**推导升级为实测**。

---

## 2. E1/E2/E3 最小挂载实验（原始输出照抄）

### 2.0 实验方式说明（与任务书的差异，必须如实标注）

任务书设想的 E1/E2/E3 是"改 patch → **重启桌面端** → 看设置页"。
**本记录执行的是机器等价实验**：直接按 loader 的解析语义（源码见下）在本机用 Node 复现
"行名怎么解析""模块能不能 import"，因此**不需要重启**、也不会打断当前会话。

**唯一仍需重启才能确认的一环**（"设置 → Agent presets 里是否出现卡片且无加载失败"）**留给人工**，见 §7。

loader 的解析语义（原文，只读）：

```js
// %USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\cordis-plugin-loader\lib\index.js:270-283
import(name, getOuterStack) {
    if (name.startsWith("cordis:")) return this.ctx.loader.builtins[name.slice(7)];
    return composeError(async (info) => {
        info.offset += 3;
        if (this.ctx.loader.internal) return await this.ctx.loader.internal.import(name, this.ctx.baseUrl, {});
        else if (name.startsWith(".")) return await import(__rewriteRelativeImportExtension(
            /* @vite-ignore */
            new URL(name, this.ctx.baseUrl).href
        ));
        else return await import(__rewriteRelativeImportExtension(
            /* @vite-ignore */
            name
        ));
    }, getOuterStack);
}
```

`baseUrl` 的来源（原文，只读）：

```js
// %USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-app-boot\lib\index.js:1529
ctx.baseUrl = pathToFileURL(dirname(absoluteConfigPath)).href + "/";
```

→ `baseUrl` = **profile 配置目录**（本机 `%USERPROFILE%/.dsh/profiles/desktop/`），不是 patch 文件所在目录。

### 2.1 探针文件（已删除；此处留档以便重放）

放在 `presets/task-planning-bundle/plugins/probe/` 下：

`helper.mjs`
```js
// E1 探针：相对导入的辅助模块（只验证"相对导入能否被解析"）。
export const PROBE_HELPER = "relative-import-ok";
```

`e1-node-only.mjs`
```js
// E1 探针：只用 `node:` 内置模块 + 相对导入。
import { platform } from "node:process";
import { PROBE_HELPER } from "./helper.mjs";

export const name = "probe-e1";
export const inject = ["tools"];
export const Config = undefined;
export function apply() {
  return `${PROBE_HELPER} on ${platform}`;
}
```

`e2-bare-import.mjs`
```js
// E2 探针：在 E1 基础上加一行裸包导入（照抄官方包写法的那一行）。
// 预期：模块找不到 —— 因为 bundle 目录向上没有 node_modules。
import { z } from "zod";
import { PROBE_HELPER } from "./helper.mjs";

export const name = "probe-e2";
export const inject = ["tools"];
export const Config = z.object({});
export function apply() {
  return PROBE_HELPER;
}
```

驱动脚本（`%TEMP%\probe-test.mjs` 等价内容）：

```js
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const bundle  = '<REPO>/presets/task-planning-bundle';
const profile = '%USERPROFILE%/.dsh/profiles/desktop/';
// E1 / E2：按绝对路径 import 探针（等价于 loader 解析到文件后 import）
// 行名解析：new URL(name, baseUrl)；以及从 profile 解析裸包名子路径
```

### 2.2 E1 —— 相对导入 + `node:` 内置（**结论：可行**）

原始输出：

```text
--- E1: 相对导入 + node: 内置 ---
E1 OK  exports= Config,apply,inject,name | apply()= relative-import-ok on win32
```

结论：**插件文件内部**的相对导入（`./helper.mjs`）与 `node:` 内置导入都正常，命名导出
`name`/`inject`/`Config`/`apply` 完整保留。→ 因此正式插件可以"零依赖 + 单文件"。

### 2.3 E2 —— 插件内裸包导入（**结论：必然失败**）

原始输出（**报错原文**）：

```text
--- E2: 裸包导入 (zod) ---
E2 FAIL ERR_MODULE_NOT_FOUND
Cannot find package 'zod' imported from <REPO>\presets\task-planning-bundle\plugins\probe\e2-bare-import.mjs
```

配套事实（为什么必挂）：从 bundle 目录向上**一整条链都没有 `node_modules`**：

```text
=== node_modules chain from bundle dir ===
（无输出：<REPO>\presets\task-planning-bundle 至 D:\ 全链无 node_modules）
--- D:/node_modules ---   ls: cannot access 'D:/node_modules': No such file or directory
--- <DSH_DIR>/node_modules --- ls: cannot access '<DSH_DIR>/node_modules': No such file or directory
```

结论：**这是"不许照抄官方包样板"的直接证据**。官方 `dsh-tool-todo/lib/index.js:1-3` 的
`import z from "@deepseek-ai/schemastery"` / `from "zod"` / `from "@deepseek-ai/dsh-tools"`
三条，在本插件位置全部会 `ERR_MODULE_NOT_FOUND`。

### 2.4 E3 —— 行名的三种形态（**结论：选"包名子路径"**）

原始输出：

```text
--- 行名解析：相对路径行按 loader 语义 new URL(name, baseUrl) ---
baseUrl = %USERPROFILE%/.dsh/profiles/desktop/
  ./plugins/token-estimator/index.js  => %USERPROFILE%/.dsh/profiles/desktop/plugins/token-estimator/index.js
  ./plugins/token-estimator/index.js (若 baseUrl 是 bundle 目录) => file:///<REPO>/presets/task-planning-bundle/plugins/token-estimator/index.js
--- 行名解析：裸包名子路径（从 profile 解析） ---
FAIL dsh-task-planning-preset -> MODULE_NOT_FOUND
OK   dsh-task-planning-preset/plugins/probe/e1-node-only.mjs -> <REPO>\presets\task-planning-bundle\plugins\probe\e1-node-only.mjs
OK   dsh-boot-animation -> <PLUGINS_DIR>\dsh-boot-animation\entry.js
```

| 形态 | 实测 | 判定 |
|---|---|---|
| ① 相对行 `./plugins/token-estimator/index.js` | 按 loader 语义会解析到 **`…/profiles/desktop/plugins/…`**（profile 下，不是 bundle 里） | ❌ **不可用**（任务书横幅已预判，本次给出机制原因） |
| ② 包名子路径 `dsh-task-planning-preset/plugins/token-estimator/index.js` | 从 profile 解析 **OK**，落到 bundle 里的真实文件 | ✅ **采用** |
| ③ 包名本体 `dsh-task-planning-preset` | `MODULE_NOT_FOUND`（该包 `package.json` 没有 `main`/`exports`，是纯 patch 包） | ❌ 不可用（除非给它加 `main`，但那会改变包身份，不做） |
| 对照：既有本地 bundle `dsh-boot-animation` | 裸包名 **OK** → `…\dsh-boot-animation\entry.js` | ✅ 说明"裸包名从 profile 解析"这条路径在本机是**已验证可用**的既有惯例（`dsh-whale-widget` 同款） |

**附带结论（模块类型）**：bundle 的 `package.json` 原本**没有 `"type"`**，而 Node 对无 `type` 的包内
`.js` 按 CJS 解析 → `export` 语法会报错。故给 `presets/task-planning-bundle/package.json` 补了
`"type": "module"`。依据：本机另两个可用的本地 bundle（`dsh-boot-animation`、`dsh-whale-widget`）
的 `package.json` **都声明了 `"type": "module"`**，这是本 profile 的既有惯例。

### 2.5 探针处置

按任务书要求**已删除** `presets/task-planning-bundle/plugins/probe/`（未保留；证据即 §2.1–§2.4 的原文留档）。
删除后 `plugins/` 下只剩正式插件：

```text
$ ls presets/task-planning-bundle/plugins/
token-estimator
```

---

## 3. 实现

### 3.1 产出文件

| 文件 | 作用 |
|---|---|
| `presets/task-planning-bundle/plugins/token-estimator/index.js` | 插件本体（纯 ESM，**只用 `node:process` 一个内置导入**，零第三方依赖，中文注释） |
| `presets/task-planning-bundle/package.json` | 补 `"type": "module"`（原因见 §2.4） |
| `presets/task-planning-bundle/cordis.patch.yml` | 新增一行 `- id: token-estimator` / `name: dsh-task-planning-preset/plugins/token-estimator/index.js`（附机制说明注释） |

### 3.2 关键实现取舍（每条都有证据）

1. **不导出 `Config`**：cordis 是 `if (!runtime.Config) return config`（`@deepseek-ai\cordis\lib\index.js:956`），
   不导出即"原样透传、不校验"。本插件无需配置，故不导出，也就避免了"必填字段"这类 0.2.x 事故面（教训 E4）。
2. **工具定义手写原始 JSON Schema**，不用 `defineTool`（裸包，见 §2.3）。宿主注册表真正要求的是
   `definition.output = { schema, render }` 且 `schema` 落在受支持子集内
   （证据：`@deepseek-ai\dsh-tools\lib\index.js:2773-2782` 的 `register()`）。
3. **`usage_report` 用闭包捕获 `ctx`，不用 `this`**：宿主以 `definition.execute(args, exec)` 调用，
   `this` 是工具定义对象而非插件 ctx。**这是本次真实踩到的 bug**（首版写成 `readRuntimeUsage(this, …)`，
   导致运行时计量被误判为不可用；见 §6 第 1 行的修复前后对照）。
4. **静态算法可解释**（写在文件头注释里，且工具返回值里逐项复现）：
   `raw = (tasks×700000 + existingCodeLines×8 + files×600 + docChars×1.2 + files×1500) × 复杂度 × 迭代`；
   `低 = raw×0.8`、`高 = raw×2.5`、`合计 = (低+高)/2 × 1.5`。
5. **降级路径用插件内环境变量** `TOKEN_ESTIMATOR_FORCE_STATIC=1`（不碰任何 profile 文件，满足铁律 1 与任务书第 4 条硬性要求）。

### 3.3 机器校验（用**宿主自己的校验器**，不是自造标准）

```text
resolved: <REPO>\presets\task-planning-bundle\plugins\token-estimator\index.js
exports: apply,inject,name | name= token-estimator | inject= ["tools"]
registered: estimate_tokens,usage_report
  estimate_tokens SCHEMA OK
  usage_report SCHEMA OK
```

- `SCHEMA OK` 的含义：把两个工具的 `parameters` 与 `output.schema` 分别喂给
  `@deepseek-ai/dsh-tools` 导出的 **`assertSupportedJsonSchema()`**（宿主注册时用的同一个函数），**无违规**。
- `exports` 只剩 `apply,inject,name`：确认没导出 `Config`（即不做配置校验）。

bundle 级校验（`%TEMP%\dsh-tp-01\validate-bundle.cjs`）：

```text
PASS | 能解析到行模块 dsh-task-planning-preset/plugins/token-estimator/index.js
PASS | 必填字段齐全 dsh-task-planning-preset/plugins/token-estimator/index.js | required=[] 提供=[]
=== 合计：全部 PASS（FAIL 数 0） ===
```

> **校验器改了两行**（任务 02 的校验器假设"每一行都是安装树里的 `@deepseek-ai/*` 包"，会去读
> `dsh/node_modules/<行名>/lib/index.js`；本任务的行名是**文件路径**，被拼成
> `…/index.js/lib/index.js` → 假 FAIL）。改法：行名不以 `@deepseek-ai/` 开头时改用
> `createRequire(profile/package.json).resolve(行名)` 读取。改前该行 `FAIL | 安装树里能读到 …/lib/index.js`，
> 改后 `PASS | 能解析到行模块 …`，其余 60 项不变。**这是校验器口径问题，不是插件缺陷**；
> 与插件本身等价的独立证据见 §3.3 第一段（`import` 真的成功、schema 真的过校验）。

---

## 4. 两个工具的真实输入输出（**AI 机器验证**，Node 直调插件本体）

> 说明：本段是"把插件当库直接调"的真实输出，用于证明算法与降级逻辑正确。
> **模式内（经 DSH 会话）的调用属于人工执行项**，见 §7。

### 4.1 `estimate_tokens` —— 以本项目（8 个主任务）为输入

输入：`{ stage: "本项目（8 个主任务的插件开发）", scale: { tasks: 8, files: 40, docChars: 60000, existingCodeLines: 5000 } }`

原始输出（工具返回值摘要 + `render` 文本）：

```text
{"low":4636800,"high":14490000,"total":14345100,"triggers":{"conversationLimit":false,"taskLimit":false}} | output conforms

【token 估算 · 本项目（8 个主任务的插件开发）】
低估算：4.64M（4636800） ｜ 高估算：14.49M（14490000）
保守合计：14.35M（14345100，= (低+高)/2 × 1.5）

阈值判断：
  - 未触发「单对话 60.00M」阈值。
  - 未触发「单任务 200.00M」阈值。

估算依据：
  - 阶段：本项目（8 个主任务的插件开发）
  - 规模：子任务 8 个 / 文件 40 个 / 文档 60000 字 / 需读既有代码 5000 行
  - 任务基准：8 × 700000 = 5600000 token
  - 读入侧：5000 行 × 8 + 40 文件 × 600 = 64000 token
  - 产出侧：60000 字 × 1.2 + 40 文件 × 1500 = 132000 token
  - 乘子：复杂度 ×1.000 × 迭代 3/3 = ×1.000
  - 区间系数：低 ×0.8 / 高 ×2.5；合计 = (低+高)/2 × 重试系数 1.5

这是估算，不是承诺：数字来自可解释的静态公式，实际用量随对话轮次与返工次数变化。
```

**与 `docs/工作流程/00-总览与使用说明.md` 第八节的对标**：该节给"任务 01–08"的区间是
**4.7M – 14.5M**；本工具对同一件事给 **4.64M – 14.49M**。→ **同一量级，标定成立**。
（标定方式：把 `BASE_TOKENS_PER_TASK = 700_000` 调到让 8 任务代入后落在该区间内，其余系数取整数量级。）

### 4.2 `estimate_tokens` —— 只给阶段名（默认规模，验证"永远有输出"）

输入：`{ stage: "工具集接线与实测" }` → 原始输出：

```text
{"low":568880,"high":1777750,"total":1759973} | output conforms
```

### 4.3 `usage_report` —— 运行时计量路径（**AI 机器验证**，注入伪 `sessionProjections`）

```text
{"available":true,"used":131346,"source":"sessionProjections.tokenUsage（完整持久日志口径）"} | output conforms

【token 用量报告 · 任务 03】
运行时计量：可用（sessionProjections.tokenUsage（完整持久日志口径））
本会话已用：131.3K（131346 token）
静态估算对照：低 568.9K ～ 高 1.78M（保守合计 1.76M）
对照结论：已用 131.3K 仍在静态高估算 1.78M 之内。
建议：用量在预估区间内，可继续当前阶段。

备注：
  - 明细：未缓存输入 123456 / 输出 7890 / 缓存读 555 / 缓存写 66（缓存读写不计入"已用"）。
  - 数据切点 asOfSeq=42。
  - 本报告不伪造任何用量：数字要么来自运行时计量（附来源），要么来自上面可解释的静态公式。
```

（伪数据只为验证"读数路径通不通"；**没有把它当成真实用量写进任何结论**。真实会话用量见 §7 人工回填。）

### 4.4 `usage_report` —— 无服务降级路径（**不抛错**）

```text
{"available":false,"used":0,"source":"无"} | output conforms

【token 用量报告 · 当前会话】
运行时计量：不可用
静态估算对照：低 568.9K ～ 高 1.78M（保守合计 1.76M）
对照结论：无法对照：运行时计量不可用，以下只有静态估算。
建议：静态估算偏保守；若连续多个阶段实际用量都高于静态高估算，请在实施记录里反馈以便校准公式。

备注：
  - 运行时计量不可用（原因）：sessionProjections 服务不可见；tokenMeter 服务不可见
  - 本报告不伪造任何用量：数字要么来自运行时计量（附来源），要么来自上面可解释的静态公式。
```

### 4.5 输出契约自检

每一段的 `| output conforms` 都是用宿主的
`validateJsonSchemaValue(output.schema, 返回值)` 校验的，**全部无违规** ——
即返回值与声明的 `output.schema` 一致，不会在运行期因 schema 不符而变成工具错误。

---

## 5. 降级验证（插件内环境变量，**未修改任何 profile 文件**）

命令（在伪 `sessionProjections` **可用**的前提下强制走静态轨，以证明环境变量真的生效）：

```text
$ TOKEN_ESTIMATOR_FORCE_STATIC=1 E:/node.exe %TEMP%\plugin-force.mjs
FORCE_STATIC 下 available = false | 原因见下：
【token 用量报告 · 当前会话】
运行时计量：不可用
静态估算对照：低 568.9K ～ 高 1.78M（保守合计 1.76M）
...
备注：
  - 运行时计量不可用（原因）：TOKEN_ESTIMATOR_FORCE_STATIC=1：已强制走静态轨
```

结论：
1. 环境变量生效（即使服务在位也走静态轨）；
2. 降级**不抛错**，工具仍返回完整可用信息；
3. **未触碰** `%USERPROFILE%\.dsh\profiles\` 下任何文件（本验证只改进程环境变量）。

---

## 6. 本任务真实踩到的 bug（留档，供任务 04 提炼约束）

| # | 现象 | 根因 | 处置 |
|---|---|---|---|
| 1 | `usage_report` 在伪 `sessionProjections` 在位时仍报"运行时计量不可用" | `execute` 里写了 `readRuntimeUsage(this, session)`；宿主是以 `definition.execute(args, exec)` 调用的，`this` 是**工具定义对象**，不是插件 ctx → `this.get` 不存在 | 改为在 `apply(ctx)` 里用工厂函数**闭包捕获 ctx**（`createUsageReportTool(ctx)`），并把 `this` 改回 `ctx`。修复后 §4.3 通过 |
| 2 | 插件首次 import 直接 `SyntaxError` | 描述字符串里嵌了 **ASCII 直引号** `"拍脑袋估 token"`，把双引号字符串提前闭合 | 改用中文引号 `「」`；并在模板字符串里的引号确认合法（模板字符串内 ASCII 引号不冲突） |
| 3 | `validate-bundle.cjs` 对插件行报 1 项 FAIL | 校验器假设"每行都是 `@deepseek-ai/*` 包"，把文件路径行拼成 `…/index.js/lib/index.js` | 给校验器加 `rowSource()`：非 `@deepseek-ai/` 行改用 `createRequire(profile)` 解析（详见 §3.3 注） |
| 4 | 任务书正文的落点（`presets/task-planning/plugins/…` + 相对行）在本机不成立 | loader 相对行名按 `new URL(name, ctx.baseUrl)` 解析，而 `baseUrl` 是 **profile 配置目录** | 改用 bundle 包名子路径（§2.4），并保留任务书正文原样不动 |

---

## 7. 人工执行清单与回填（✅ 2026-10-12 已完成，原始输出见 §7.1）

> 依据既定口径（2026-10-12 人工裁决"判「算」"，见 `docs/验收报告/02-报告.md` §五第 8 条）：
> **人工**负责只有人能做的动作（重启桌面端 / 新开会话 / 切模式 / 逐条下达指令 / 看界面并回报），
> **会话内 AI** 负责调用工具，**原始输出以会话记录为证**。

1. **重启桌面端**（必须）：本 bundle 是 `link:` 安装、就地读仓库文件；未启用 HMR 时组合变更保留到重启
   （依据：`docs/调研/03-preset机制-新版.md` §E「生效时机」）。
2. **新开会话**，模式选择器选「任务规划」（preset 在**新会话**时组装）。
3. **看界面**：设置 → Agent presets 里「任务规划」卡片**无「加载失败」红标**（若有红标，请把悬浮提示原文抄下来）。
4. **在会话里调两个工具**（逐条下达指令即可）：
   - 让它调 `estimate_tokens`，`stage` 填"工具集接线与实测"，看是否返回低-高区间 + 两个阈值判断 + 依据；
   - 让它调 `usage_report`，看是否给出"本会话已用 token"或明确的降级说明（**不抛错**）。
5. **降级路径（运行期版）**：若要验证"计量真的不可用时也不抛错"，可在会话里确认
   `usage_report` 的返回里出现"运行时计量不可用（原因）"字样；**不要**去改 profile 或服务配置。
6. **把 3/4 的原始输出回填到本文件 §7.1**，并把截图（如第 3 步）存到 `docs/实施记录/` 下。

### 7.1 人工回填区（原始输出照抄）

> **执行人**：使用者本人（人工执行）　**时间**：2026-10-12　**执行对象版本**：提交 `5317405`
> 本段是**人工执行并回填的原始回报**，AI 未代填、未改写（只做分条与补注）。

**第 1 步（重启桌面端）**：原话「重启完成」。

**第 2 步（设置 → Agent presets 看卡片）**：原话「任务规划没有加载失败」。
截图入库：`docs/实施记录/03-预设卡片-无加载失败.png`
（45693 B，sha256 `4bd528cc3de85f3479ea74753b7ac79ea61dcd04c1ee0c8a4f86ba3592d27944`）。
截图内容：自定义分组下的「任务规划」卡片，带「新任务默认」标记与 `task-planning` 标识，**无「加载失败」红标**。

**第 3 步（模式内调两个工具）**：原话「都有，但是当前用量远低于估算区间下限，处于正常区间，可继续当前阶段。
需要说明的是，这两个数字口径不同——7.6K 是运行时实测的真实累计消耗，1.76M 是「按 1 个子任务 / 3 个文件 / 4000 字文档」
假设推出的静态区间；真实消耗会随对话轮次和返工次数增长，建议在阶段推进后再复测一次 usage_report 做趋势对照。」

**从这段回填能确证的三件事**：

1. `estimate_tokens` 在模式内**可被调用**，且返回了区间与阈值判断；
2. `usage_report` 在模式内**可被调用**，且**运行时计量真的读到了数** —— 用户明确写出「**7.6K 是运行时实测的真实累计消耗**」。
   这使 §1.3 那条"`ctx.get('sessionProjections')` 在本 preset 组装内可达"**由推导升级为实测**。
3. 静态侧按**默认规模**（`tasks=1 / files=3 / docChars=4000`，与插件默认值逐项吻合）给出
   区间 **0.57M–1.78M**、保守合计 **1.76M** —— 与运行时 7.6K **口径不同**，见 §8 第 6 条。

---

## 8. 未验证 / 未知（如实标注；1–3 已由人工实测闭合）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 重启后「任务规划」模式在设置页是否**无加载失败** | ✅ **已实测闭合**（人工 2026-10-12，§7.1 第 2 步 + 截图 `03-预设卡片-无加载失败.png`，sha256 `4bd528cc…944`） |
| 2 | 模式内 `estimate_tokens` / `usage_report` 是否**真的被调起并返回** | ✅ **已实测闭合**（人工 2026-10-12，§7.1 第 3 步：「都有」） |
| 3 | `ctx.get('sessionProjections')` 在**本 preset 组装内**是否真的可达 | ✅ **已实测闭合**：`usage_report` 在模式内返回**运行时实测值 7.6K**，说明运行时计量服务确实可达（§7.1 第 3 步）。原"推导"结论成立 |
| 4 | 兜底口径 `tokenMeter.measure().totalTokens` 在真实会话里的量级 | **未实测**：本次只确证了**主口径**（`sessionProjections.tokenUsage`）可用；7.6K 来自哪一条未逐项区分（不排除两条都返回）。影响很小（兜底路径只在主口径缺席时启用） |
| 5 | 静态公式对**单阶段**（如任务 03 本身 0.8M–2.5M）的贴合度 | **仍未定**：本工具对默认规模给 0.57M–1.78M（保守合计 1.76M），与任务书的 0.8M–2.5M 同量级；但**缺少"该阶段跑完后的最终真实用量"**，无法定标。建议任务 04/05 收尾时补一次 `usage_report` 拿终值再校准 |
| 6 | **两个数字口径不同**（人工明确指出） | **已确认，且是设计使然**：`usage_report` 的"已用"是**运行时实测的当前会话累计**（本次 7.6K），"静态估算"是按**给定规模对整个阶段**的预估区间（默认规模下 0.57M–1.78M / 合计 1.76M）。二者**不是同一件事**，单点比较会显得"实测远低于下限"。→ 待办：把这条口径说明**写进工具输出文案**（现仅在文档与本记录里），见 `docs/验收报告/03-报告.md` §四 |
