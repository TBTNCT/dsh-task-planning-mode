# DSH agent preset 机制调研（新版 · 声明式 preset）

> **调研性质**：只读事实核查。做法是**解包桌面端的 `app.asar`**，读取"运行中的那一份"代码与随包文档；未修改任何官方文件。
> **调研时间**：2026-10-12　**适用版本**：本机桌面端 DSH **0.2.x**
> （实测：`@deepseek-ai/dsh-web-app@0.2.1-alpha.1`、`@deepseek-ai/dsh-agent-preset@0.2.1-alpha.1`、`@deepseek-ai/dsh-agent-preset-registry@0.2.1-alpha.1`；桌面端自称 `@deepseek-ai/dsh-desktop 0.2.0-rc.2`）
> **与旧文档的关系**：`docs/调研/01-preset机制.md` 描述的是 **0.1.5-rc.2 的"目录型"机制**（`<home>\.agent-presets\<id>\agent.cordis.yml`），
> **在本机运行版本上已不适用**。本文是它的替代调研，旧文保留原结论并加了版本适用性标注。
> **结论分级**：标「实测」＝本机命令/解包直接读到；标「推导」＝由多条证据推出、未经运行期验证；标「未实测」＝明确不知道。

---

## 0. 怎么读到"运行中的那一份"（可复现）

桌面端把整棵 DSH 打包进一个 asar 文件：

```text
%USERPROFILE%\AppData\Local\Programs\DeepSeek Harness\resources\app.asar   (142 MB, 单文件)
```

宿主进程命令行（实测，PID 3572）：

```text
"…\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\index.js"
"…\resources\app.asar\dsh" "%USERPROFILE%\.dsh\profiles\desktop" …
```

`app.asar` **不是目录**（`Test-Path …\app.asar\dsh` → False），要用 asar 头部格式自行解析。
**头部布局（实测）**：`[u32=4][u32 headerSize][u32 jsonSize+4][u32 jsonSize][JSON @16]`，`dataOffset = 8 + headerSize`。
读取脚本：`%TEMP%\dsh-tp-01\asar.cjs`（`list` / `get` / `grep` 三个子命令）。

**第一条关键事实（实测）**：打包树 `dsh/node_modules/@deepseek-ai/` 里**没有 `dsh-agent-presets`**（旧机制的包），
只有 **`dsh-agent-preset`**（声明行）、**`dsh-agent-preset-registry`**（注册表）、**`dsh-client-ui-agent-preset`**（客户端 UI）。

> 为什么这件事决定一切：profile bundle 的解析顺序是"**先安装目录（asar），后 profile 目录**"
> （依据：崩溃日志原文 `cannot resolve profile bundle "…" from the dsh installation or %USERPROFILE%\.dsh\profiles\desktop`），
> 因此 `<DSH_INSTALL>` 里那份 **0.1.5 的 `dsh-web-app` 补丁根本没被加载**；真正生效的是 asar 里 0.2.1-alpha.1 的那份。

---

## A. 机制总览（实测）

| 概念 | 新版实现 | 证据 |
|---|---|---|
| **preset 是什么** | 一行插件声明：`name: '@deepseek-ai/dsh-agent-preset'`，`config` 就是这个模式的全部内容 | `dsh-agent-preset/lib/index.js`（全文仅 898 B） |
| **谁登记它们** | 注册表服务 `@deepseek-ai/dsh-agent-preset-registry`，行 id `agent-preset-registry`，`config.default` 指定默认 preset | 打包版 `dsh-web-app/cordis.patch.yml:576-581` |
| **内置 4 个模式从哪来** | `dsh-web-app` 的 `dsh.bundle.patch` 是**数组**：主 patch + `presets/{standard,ptc,minimal,cordis}.patch.yml` | 打包版 `dsh-web-app/package.json` |
| **子插件清单写在哪** | 声明的 `config.plugins`：普通 Cordis 插件行（支持 `!!js`、`group`、`isolate`） | 打包版 `dsh-web-app/presets/standard.patch.yml` |
| **preset 目录/路径** | **不存在**：注册表**不扫描目录，也不接受 preset 路径** | `dsh-agent-preset-registry/README.zh.md`「注册表不扫描目录，也不接受 preset 路径」 |
| **怎么新增/覆盖** | 写 **bundle 补丁**（一个带 `dsh.bundle.patch` 的包），插入 `@deepseek-ai/dsh-agent-preset` 行；再用**插件管理器**装进 profile | `dsh-agent-preset-registry/README.zh.md`「新建 preset 或覆盖内置 preset 都是 bundle 补丁……再用 `plugin_manager` 安装到 profile」 |
| **用户层目录** | `<home>/.agent-presets` 在 0.2.x **不被读取**（`%USERPROFILE%\.dsh` 还是指向 `<DSH_HOME>` 的 Junction，但没人扫它） | 三条一致：注册表代码无该目录名、打包树无旧包、README 明说不扫描 |

---

## B. 声明行的 schema（实测：源码）

`dsh-agent-preset/lib/index.js` 全文要点：

```js
class AgentPreset {
  static inject = ["agentPresets"];
  /** 让子插件里的 !!js 表达式保留到各子插件自己加载时求值 */
  static [EntryGroup.key] = true;
  static Config = z.object({
    id: z.string().required(),        // preset 标识符（会话保存的那个）
    name: z.string(),                 // 显示名
    description: z.string(),          // 显示说明
    order: z.number(),                // 列表排序
    plugins: z.array(z.any()).required()   // 子插件行列表（group 子配置）
  });
  async *[Service.init]() { yield await this.ctx.agentPresets.register(this.config) }
}
```

要点：
1. **`config.plugins` 就是 group 子配置**（`EntryGroup.key = true`），所以行里可以写 `group`/`isolate`/`!!js`，与旧 `agent.cordis.yml` 的行**同构**。
2. **行 id ≠ preset id**：行的 `id`（如 `preset-task-planning`）是 Loader 的编辑地址（按 id 写覆盖补丁用）；
   `config.id`（如 `task-planning`）才是会话与选择器使用的 preset 身份。
3. 注册表**不提供目录、文件复制、文件删除**（`dsh-agent-preset/README.zh.md` 已知限制）。

---

## C. 内置模式的形态（实测摘录）

打包版 `dsh-web-app/presets/standard.patch.yml` 开头：

```yaml
# Agent preset standard: one `@deepseek-ai/dsh-agent-preset` declaration inserted
# after the web patch. Edits saved from the Web editor override this row's
# `config.plugins` by id from the profile patch.
- insert:
    - id: preset-standard
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: standard
        order: 1
        plugins:
          - id: persona
            name: '@deepseek-ai/dsh-persona'
            config:
              suffix: Your working directory is {{cwd}}.
              prefix: You are a coding agent powered by the {{model}} model.
          # …tool-bash / tool-pwsh / tool-fs / tool-fs-search / tool-jobs / tool-schedule /
          #    skill-filesystem / tool-skill / goal 组 / planning 组 / compaction 组（带 isolate）/
          #    delegation 组（带 isolate）/ tool-ask-user / tool-todo / tool-web / present /
          #    tool-plugin-manager（disabled: true）
```

对照结论：**本仓库的 `presets/task-planning-bundle/cordis.patch.yml` 与 shipped patch 同形**
（顶层 patch 数组 → `insert` → 声明行 `{id,name,config}`；`config` 五字段齐全），机器校验 34/34 PASS。

---

## D. 客户端与 UI 语义（实测摘录）

- **设置 → Agent presets**（`dsh-client-ui-agent-preset`）：显示内置/自定义卡片分组、默认项高亮、点击选择；
  每张卡片提供**只读**「查看配置」（按 Loader 方言渲染该声明的插件列表）。
  **本页不编辑任何内容**；「创造入口」会开一个 `cordis` preset 的会话，由它**以 bundle 形式**创建或覆盖 preset。
  已知限制原文：「**Web 不创建也不编辑 preset**；配置查看器是只读的」。
- **侧栏 → 插件**（`ui-plugin-manager`，打包 patch `:313-314` 插入）：管理 profile 的组合包与其行；
  **添加插件**接受「**包名（可带版本）、Git 地址、压缩包或本地绝对路径**」；安装前 Host 先 `inspect` 读出 spec 指向什么；
  安装完成后提供「**立即启用**」。
- 选择器可用项与「代码工作工具」开关有关（关闭时提供标准/创造/自定义，开启时另提供 PTC/极简）。
- 「Agent 预设条目保持只读」（`dsh-plugin-manager/README.zh.md`）。

---

## E. 安装 / 启用 / 卸载（实测摘录 `dsh-plugin-manager/README.zh.md`）

| 动作 | 行为 |
|---|---|
| 安装 | `installBundle(spec)`：本地路径直接读其 `package.json`；**不兼容的 DSH peer 会在 pnpm 运行前失败**；成功后默认启用（追加 `dsh.profile.bundles`） |
| 启用/停用组合包 | 修改 profile `package.json` 的有序 `dsh.profile.bundles`；停用保留依赖 |
| 启停组合包里的**单行** | 往 profile `cordis.patch.yml` 写该行 id 的 `disabled` 覆盖 |
| 生效时机 | 「在 YAML 中启用 HMR 时，配置变化立即生效；未启用 HMR 时，运行中的组合保留到**重启**」 |
| 卸载 | 从 `dsh.profile.bundles` 移除 → 卸载运行时贡献 → `pnpm remove` → 发布 runtime resolution |
| 已知限制 | 「替换已有包后需要**重启进程**，以加载新的 JavaScript 模块版本」；「管理器……不能编辑 agent 预设组合」 |

---

## F. 旧机制 vs 新机制（对项目的直接影响）

| 维度 | 旧（0.1.x，`01-preset机制.md`） | 新（0.2.x，本文） |
|---|---|---|
| preset 身份 | 目录名 = id | 行声明，`config.id` = id |
| 能力清单 | `agent.cordis.yml`（顶层数组） | 该行 `config.plugins`（同构的插件行） |
| 显示元数据 | `preset.yml` 三键 | `config.name/description/order` |
| 发现 | 扫 shipped 根 + `<home>/.agent-presets` | 扫**插件行**，不扫目录 |
| 新增 | 复制目录到用户层 | 写 bundle 包 + 插件管理器安装 |
| 本仓库产物 | `presets/task-planning/`（**本机无效**） | `presets/task-planning-bundle/`（**本机交付物**） |

**对后续任务的影响（本文只指出现状，改不改规划由人工决定）**：

1. **任务 02（工具集接线）**：落点从 `agent.cordis.yml` 改为 bundle 的 `config.plugins`；权威清单从
   `<DSH_INSTALL>\…\presets\standard\agent.cordis.yml`（0.1.5）改为**打包版** `dsh-web-app/presets/standard.patch.yml`（0.2.1-alpha.1，用第 0 节的方法读）。
2. **任务 03（token 估算器本地插件）**：新版没有"preset 目录"，`name: './plugins/…'` 的相对路径失去宿主；
   要重新设计为「bundle 包自带插件行 + 插件实现随包分发」或独立包。
3. **任务 04（系统提示词）**：落点从 persona `prefix` 的内联/`!!js` 改法不变（仍在 `config.plugins` 里），但"字数与 token 粗估"的验证方式要重做。
4. **任务 08/09（开源化 / npm 壳包）**：安装方式从"复制目录到 `.agent-presets`"改为"发布 bundle 包 + 插件管理器安装"；
   `roots` 配置那套（旧机制）不再适用。

---

## G. 未验证 / 未知（必须如实标注）

| # | 事项 | 状态 |
|---|---|---|
| 1 | 本机 profile 是否启用 HMR（决定装完 bundle 要不要重启） | **未实测**；README 说未启用 HMR 时需重启，**推导**需要重启 |
| 2 | 声明行只出现在 profile patch（而非 bundle）时是否同样生效 | **未实测**（README 说 bundle 补丁是官方路径） |
| 3 | `order` 在 roster 里的精确排序语义（是否仅按数字升序、并列如何） | **推导**（字段语义 + 旧文档 C.2 的排序实现），未在本机枚举验证 |
| 4 | 两个 bundle 声明同一个 `config.id` 时的确切行为 | README 只说"重复的 preset ID 会导致声明加载失败"，**未实测** |
| 5 | 本地路径安装后改文件是否随重启生效（还是要重新安装） | **未实测** |
| 6 | 创造模式产出的 bundle 落在 profile 的哪个文件 | **未实测** |
| 7 | `.agent-presets` 是否在 0.2.x **完全**无效 | **实测 + 官方文档双重确认**：注册表代码无该目录名、打包树无旧包、README 明说"不扫描目录、不接受 preset 路径" |

---

### G2. 踩坑记录：**必填 config 字段**（2026-10-12 实测，教训）

- **现象**：preset 在「设置 → Agent presets」的**自定义分组里能出现**（说明声明注册成功），
  但带「加载失败」红标；**模式选择器里则完全看不到它**（客户端只列健康 preset：
  `presetOptions()` = `presets.filter(preset => preset.broken === void 0)`）。
  本机报错原文：
  ```text
  tool-fs-search (@deepseek-ai/dsh-tool-fs-search): invalid config:
  - $.sampleOverCapGlobResults missing required value (at sampleOverCapGlobResults)
  ```
- **实测原因**：`@deepseek-ai/dsh-tool-fs-search` 在 0.2.x 把 `sampleOverCapGlobResults` 定为
  `z.boolean().required()`（安装树 `…/dsh-tool-fs-search/lib/index.js:1218`）；0.1.5 时代它只是可选项，
  旧文档里也没强调。
- **规律**：**新版把不少 0.1.5 的可选项变成了必填**。写行之前必须读该包 `lib/index.js` 里
  `Config = z.object({…})` 的定义，把带 `.required()` 的字段补齐；光看旧 `agent.cordis.yml` 抄会漏。
- **工具**：`%TEMP%\dsh-tp-01\validate-bundle.cjs` 已实现「逐包提取必填字段 + 与 shipped standard 同名行对照」，
  改完必跑（本机重跑：全部 PASS）。
- **排查顺序建议**（下次直接从第 2 步开始，省半小时）：
  1. 选择器里没有 → 先看**设置 → Agent presets**：有卡片但「加载失败」= 声明在、配置错；
     连卡片都没有 = 声明没注册（查 bundle 是否在 `dsh.profile.bundles`、是否重启过）。
  2. 「加载失败」的悬浮提示通常直接给出**哪个包、哪个字段**缺什么。

---

## H. 复核命令（照抄可重放）

```powershell
# 1) 确认宿主用的是 asar 里那份
Get-CimInstance Win32_Process -Filter "Name='DeepSeek Harness.exe'" | Select-Object ProcessId,CommandLine | Format-List

# 2) 解 asar（脚本见任务 01 冲突记录第 6 节）
$js = "$env:TEMP\dsh-tp-01\asar.cjs"
& 'E:\node.exe' $js list  'dsh/node_modules/@deepseek-ai'            # 里面没有 dsh-agent-presets
& 'E:\node.exe' $js get   'dsh/node_modules/@deepseek-ai/dsh-web-app/package.json' "$env:TEMP\w.json"
& 'E:\node.exe' $js get   'dsh/node_modules/@deepseek-ai/dsh-agent-preset/lib/index.js' "$env:TEMP\ap.js"
& 'E:\node.exe' $js get   'dsh/node_modules/@deepseek-ai/dsh-agent-preset-registry/README.zh.md' "$env:TEMP\reg.md"
& 'E:\node.exe' $js get   'dsh/node_modules/@deepseek-ai/dsh-web-app/presets/standard.patch.yml' "$env:TEMP\std.yml"

# 3) 校验本仓库的 bundle（34 项 PASS）
& 'E:\node.exe' "$env:TEMP\dsh-tp-01\validate-bundle.cjs"
```
