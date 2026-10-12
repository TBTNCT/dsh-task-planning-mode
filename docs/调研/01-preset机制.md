# DSH agent preset（模式）机制调研报告

> 调研性质：只读事实核查。未修改 `<DSH_INSTALL>` 下任何文件。
> 调研时间：2026-10-12。安装版本：`@deepseek-ai/dsh-agent-presets` 0.1.5-rc.2。
> 本文所有结论均附 `file:line` 证据；无法证实的一律标注「未证实」；由多条证据推导而非直接读到的结论标注「推导」。

## 0. 证据路径缩写

| 缩写 | 绝对路径 |
|---|---|
| `PKG/` | `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-agent-presets\` |
| `CLIENT/` | `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-agent-preset\` |
| `WEBAPP-PATCH` | `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-web-app\cordis.patch.yml` |
| `LOADER/` | `<DSH_INSTALL>\node_modules\@deepseek-ai\cordis-plugin-loader\` |
| `MANIFEST/` | `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-package-manifest\` |
| `APPBOOT/` | `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-app-boot\` |
| `SKILLFS/` | `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-skill-filesystem\` |

说明：`PKG/lib/types/*.js` 与 `PKG/lib/invariant.js` 是发布产物中带完整行号的实现（`invariant.js` 内联了同包的 discovery/metadata/authoring/mount 等全部实现区域），因此实现级证据优先引用它们；`PKG/lib/index.js` 是服务入口打包体。

---

## A. preset 目录的完整结构规范

### A.1 目录 = preset；目录名 = preset id

- 「AgentPreset 的 id 是 preset 目录名」：`PKG/lib/types/preset.d.ts:18-20`（`/** Stable identifier; the preset directory's name. */`），实现处 `PKG/lib/types/discovery.js:304`（`id: child.name`）。
- 一个目录成为 preset 的唯一判据是它含有 `COMPOSITION_FILE`：`PKG/lib/types/discovery.js:35`（`export const COMPOSITION_FILE = 'agent.cordis.yml'`）。
- 目录名必须匹配 `PRESET_ID = /^[a-z0-9][a-z0-9-]*$/`：`PKG/lib/types/preset.js:10`；不匹配的目录被**跳过**（既不是 preset 也不报告 broken）：`PKG/lib/types/discovery.js:293`、注释 `:270-274`。允许 `-`，不允许大写、下划线、以 `-` 开头。

### A.2 文件清单：两个必需/可选文件 + 任意附带文件

| 文件 | 必需性 | 作用 |
|---|---|---|
| `agent.cordis.yml` | **必需**（缺则 roster 行为 broken） | 组装：顶层插件行列表。`PKG/lib/types/discovery.js:35`、`:297-299` |
| `preset.yml` | 可选 | 展示元数据（name/description/order）。`PKG/lib/types/metadata.d.ts:20`、`:34-42` |
| 其它任意文件（`skills/`、`assets/`、自写插件 .js 等） | 可选 | 不被发现过程读取，但会被 `copy()` 整目录复制。`PKG/lib/types/authoring.d.ts:38-42`，实例见 `PKG/presets/cordis/skills/`（目录列表） |

- 实测本机随附 preset 目录内容（`Get-ChildItem PKG/presets` 结果）：`standard/`、`ptc/`、`minimal/` 各含 `agent.cordis.yml` + `preset.yml`；`cordis/` 额外含 `skills/cordis-plugin-development/SKILL.md`、`skills/editing-cordis-compositions/SKILL.md`（同前目录列表）。
- **没有** preset 级 `README.md` 之类约定：`scanRoot` 只读这两个文件（`PKG/lib/types/discovery.js:292-307`），因此其它文件是惰性的。
- 注意与文档的一处不一致：`PKG/README.zh.md:179` 提到随附集合里有 `cordis` 与 **`code`** 两个 preset，但本版本 `PKG/presets/` 下只有 `standard`/`ptc`/`minimal`/`cordis`（目录列表）。`code` 未随本版本交付 —— 事实如此，不做推测。

### A.3 `preset.yml` 字段（穷尽）

实现读取逻辑 `PKG/lib/invariant.js:51-74`（`readPresetMetadata`）与 `:83-93`（`renderPresetMetadata`）：

| 字段 | 类型/约束 | 证据 |
|---|---|---|
| `name` | 非空字符串（trim 后非空，否则忽略） | `PKG/lib/invariant.js:37-42`、`:66` |
| `description` | 非空字符串（同上） | `PKG/lib/invariant.js:67` |
| `order` | 有限 number（`Number.isFinite`），否则忽略 | `PKG/lib/invariant.js:68` |
| 其它键 | **静默忽略**（返回值只取上述三个） | `PKG/lib/invariant.js:69-73` |

- 接口声明仅三个字段：`PKG/lib/types/metadata.d.ts:22-33`。
- **不能**在 `preset.yml` 里写 `id` 或 `trust`：`id` 来自目录名、`trust` 来自根目录，注释明确「neither is writable here」：`PKG/lib/types/metadata.d.ts:10-12`。
- 元数据读取失败（缺失/不可解析/形状错误）不报错、不致命，退化为空元数据、UI 显示 id：`PKG/lib/types/metadata.d.ts:14-16`、`PKG/lib/invariant.js:55-64`。
- 实际样例（简中）：`PKG/presets/standard/preset.yml:1-3`（`name: 标准模式` / `description: ...` / `order: 1`）、`PKG/presets/ptc/preset.yml:1-3`（order 2）、`PKG/presets/minimal/preset.yml:1-3`（order 3）、`PKG/presets/cordis/preset.yml:1-3`（order 4）。

### A.4 `agent.cordis.yml` 的格式与约束

**顶层必须是数组**（行列表），且每一行必须是携带非空 `name` 字符串的 map：

- 判定函数 `entryListProblem`：`PKG/lib/types/discovery.js:72-94`
  - 非数组 → `'the composition must be a top-level list of plugin rows'`（`:73-77`）
  - 行不是 map/是数组 → `row N is not a plugin row (expected a map with a "name")`（`:80-82`）
  - `name` 不是非空字符串 → `row N names no plugin (a "name" string is required)`（`:84-86`）
  - `group: true` 的行递归检查其 `config` 必须是子行列表（`:87-91`）
- 空数组 `[]` 通过形状检查（无行的组合合法，见 `:78` 的循环语义）。

**行字段**来自 Loader 的 `EntryOptions`（YAML 里的键就是这些）：

| 键 | 含义 | 证据 |
|---|---|---|
| `id` | 树内稳定 id | `LOADER/lib/types/config/entry.d.ts:7-8` |
| `name` | 由 entry tree 导入的模块说明符 | `LOADER/lib/types/config/entry.d.ts:9-10` |
| `config` | 传给插件的配置（group 行时为子行列表） | `LOADER/lib/types/config/entry.d.ts:11-12` |
| `group` | 标记为嵌套 group | `LOADER/lib/types/config/entry.d.ts:13-14` |
| `disabled` | 阻止该行及其后代启动 | `LOADER/lib/types/config/entry.d.ts:15-16` |
| `inject` | 该行要求的服务或服务拦截配置 | `LOADER/lib/types/config/entry.d.ts:17-18` |
| `isolate` | `Dict<true \| string>`：逐服务命名 realm；`true` = entry-local，字符串 = 按标签共享的 realm | `LOADER/lib/types/config/isolate.d.ts:4-8`、`:21-32` |
| `intercept` | 同上模块增强里的另一个字段 | `LOADER/lib/types/config/isolate.d.ts:5-7` |

**`disabled`**：接受布尔值，也接受 `!!js` 表达式（在 Loader 上下文求值）：

- `LOADER/lib/index.js:378`：`isJsExpr(options.disabled) ? Boolean(this.evaluate(options.disabled.__jsExpr)) : Boolean(options.disabled)`
- 实例：`PKG/presets/standard/agent.cordis.yml:47`（`disabled: !!js process.platform === 'win32'`）、`:51`（取反）、`:206`（字面量 `true`）。

**`!!js` 也可出现在 `config` 内的任意位置**（不止 `disabled`）：Loader 在激活时对整个 config 递归插值：

- `LOADER/lib/index.js:289-300`（`evaluate` 用 `with (ctx)`；`interpolate` 递归替换 `__jsExpr` 节点）、`:689`（`return interpolate(this.ctx, config)`）
- 实例：`PKG/presets/cordis/agent.cordis.yml:260`（在 `config.customSkillDirs` 的数组元素位置使用 `!!js`）。
- 注意：`PKG/README.zh.md:178` 的「`disabled` 是加载器唯一会插值的条目字段」指的是**健康检查的判定字段**（发现过程只看 `disabled` 决定是否跳过解析），不是「config 里不能用 `!!js`」；两者不矛盾。

**group / isolate 的写法**（随附实例）：

- `PKG/presets/standard/agent.cordis.yml:105-109`：
  ```yaml
  - id: planning
    name: cordis:group
    group: true
    isolate:
      planMode: true
    config:
      - id: plan-mode
        name: '@deepseek-ai/dsh-plan-mode'
  ```
- 同一文件的 `:138-143`（`isolate: {compaction: true, toolResultPruner: true}`）、`:169-173`（`isolate: {workflowEngine: true}`）。
- `cordis:group` 是 Loader builtin，由 app-boot 的 `mountRootInclude` 注册（因为工作区外的 preset 无法按名解析 `@deepseek-ai/cordis-plugin-group`）：`APPBOOT/README.zh.md:88`。
- group 的语义：自身永远「enabled」，但禁用一个 group 行会阻止其子行运行；嵌套 id 用 `:` 连接（如 `tools:logger`）：`<DSH_INSTALL>\node_modules\@deepseek-ai\cordis-plugin-group\README.md:16-18`。
- `cordis:group` 在组合清单里被当作结构行、不单独上报，只上报其子行：`PKG/lib/invariant.js:990-1004`、`:1037-1049`。

**行的 `name` 可以是四类说明符**（决定解析基准）：`PKG/lib/types/specifier.d.ts:16-36`、实现 `PKG/lib/invariant.js:134-155`：

| 类别 | 形态 | 解析基准 |
|---|---|---|
| `builtin` | `cordis:` 前缀 | Loader 自带，不解析 |
| `preset` | 以 `.` 开头 | **preset 自己的目录**（`Include` 把 ctx.baseUrl 改写为组合文件所在目录） |
| `file` | `file:` URL 或绝对路径 | 绝对定位（绝对路径在分类时转成 file URL，以适配 Windows 盘符） |
| `package` | 其余裸名 | 已安装 harness 的 base（不是 preset 目录） |

- package 名的健康检查是「从 harness base 向上走 `node_modules` 看 package.json 是否存在」，不 import：`PKG/lib/types/discovery.js:111-124`、`:154-161`。
- mount 时同名分类复用于 import 覆盖：`PKG/lib/invariant.js:664-675`（`preset`/`builtin` 走 `super.import`，`package`/`file` 走 `internal.import(specifier, harnessBase, {})`）。

### A.5 最小可用 preset 模板（由上述规则推导，非新机制）

```
<root>/<id>/                  # id 必须匹配 ^[a-z0-9][a-z0-9-]*$
  agent.cordis.yml            # 顶层数组，每行含 name
  preset.yml                  # 可选：name / description / order
  skills/<skill-id>/SKILL.md  # 可选：preset 自带 skill（见 D 节）
```

---

## B. 发现路径与优先级

### B.1 生效根目录的推导（精确顺序）

`AgentPresets` 构造时一次性推导 `resolvedRoots`：`PKG/lib/index.js:1300-1310`

```
[ shipped (trust: "system") ]  ← 仅当 config.includeShippedRoot !== false
+ config.roots                  ← 部署配置的顺序，逐项使用其 trust
+ [ dshHomePath('.agent-presets') (trust: "user") ]  ← 仅当 config.includeUserRoot !== false
```

配套证据：

- 前置 shipped、后置 user 的原因（「earlier root wins a duplicate id」）：`PKG/lib/index.js:1250-1260`（字段 JSDoc）、`PKG/lib/types/preset.d.ts:52-59`（shipped「always mounts and wins a duplicate id」）。
- `resolvedRoots` **只推导一次**（不让 `list()` 与 `copy()` 看到不同的根集合）：`PKG/lib/index.js:1254-1256`。
- 对外只读入口 `roots`：`PKG/lib/index.js:1553-1562`；`authorable` = `resolvedRoots.some(trust === 'user')`：`PKG/lib/index.js:1563-1566`。

### B.2 Config schema 与默认值（穷尽）

`PKG/lib/index.js:1240-1248`：

| 字段 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `default` | **必填**（`z.string().required()`） | — | 会话未指定时挂载的 preset id |
| `roots` | 否 | `[]` | `{ path: string(必填), trust: 'system'\|'user'（默认 `'user'`） }` 的数组 |
| `includeShippedRoot` | 否 | `true` | 前置本包 `presets/` 作为 system 根 |
| `includeUserRoot` | 否 | `true` | 追加 `<dshHome>/.agent-presets` 作为 user 根 |

- TypeScript 声明同形：`PKG/lib/types/preset.d.ts:46-65`。
- 中文文档表格：`PKG/README.zh.md:51-56`；最小配置示例：`:42-49`。
- `roots[].path` 支持开头 `~` 展开：`PKG/lib/types/discovery.js:281`（`resolve(expandHomePath(root.path))`）、`PKG/lib/types/preset.d.ts:41-42`。「显式路径优先于 $DSH_HOME，后者优先于 ~/.dsh」：`dsh-home-paths/README.zh.md:34-38`。

### B.3 两类根的精确路径（本机实测）

| 根 | 精确路径 | 证据 |
|---|---|---|
| shipped root | `PKG/presets/` = `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-agent-presets\presets\` | `PKG/lib/types/discovery.js:56`：`SHIPPED_PRESET_ROOT = fileURLToPath(new URL('../presets/', import.meta.url))` |
| user root | `<dshHome>/.agent-presets`，本机 = `%USERPROFILE%\.dsh\.agent-presets` | `PKG/lib/types/discovery.js:48`：`USER_PRESET_DIR = '.agent-presets'`；`PKG/lib/index.js:1306-1309`（`dshHomePath(USER_PRESET_DIR)`） |

- 本机 `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\dsh-agent-presets` 是指向 `<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-agent-presets` 的 **Junction**（`Get-Item ... | Select LinkType,Target` 结果），因此 profile 侧看到的 shipped root 就是上表那个路径。
- `%USERPROFILE%\.dsh` 下当前**没有** `.agent-presets` 目录（目录列表实测），即用户根尚未创建 —— 与文档一致：「user root 直到第一个本地创作 preset 才存在」`PKG/lib/types/discovery.d.ts:66-68`。
- 实际 Web profile 的 `agent-presets` 行只写了 `default: standard`，没有自定义 `roots`：`WEBAPP-PATCH:480-484`。用户层 patch 文件当前是空数组：`%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`（`[]`）；home 级 patch 只含 dsh-skin 主题开关：`%USERPROFILE%\.dsh\cordis.patch.yml:1-6`。

### B.4 第三方 npm 包携带 preset 的机制

**结论：不存在「包自动携带 preset」的约定（未发现任何此类字段或目录扫描）。** 可用的只有「把该包的目录配成一个 root」。逐条排除：

1. **package.json 无 preset 字段。** `dsh` 清单的全部字段为 `bundle` / `profile` / `client` / `configTrees` / `sessionFormatMigration` / `moduleFallback`：`MANIFEST/lib/types/types.d.ts:7-23`。其中 `bundle` 只声明 patch 文件路径（`:24-28`），`profile` 只声明 bundle 列表与 patchReload（`:29-35`），都没有 preset。
2. **shipped root 不能由第三方提供。** `SHIPPED_PRESET_ROOT` 是相对**本包模块自身**的位置（`PKG/lib/types/discovery.js:49-56`），只有 `@deepseek-ai/dsh-agent-presets` 包内的 `presets/` 才是 shipped 集合；也没有「扫描已安装包的 presets/ 目录」的代码路径（全包只有 `roots` 与 `resolvedRoots` 两处根来源：`PKG/lib/index.js:1300-1310`）。
3. **无环境变量入口。** 在 `PKG/lib/invariant.js` 中检索 `process.env` / `DSH_` 无匹配（grep 结果为空），因此没有 `DSH_PRESET_ROOT` 之类的旁路。
4. **唯一受支持的第三方机制 = 配置 `roots`。** 文本依据：`PKG/README.zh.md:46-48`（`roots: [{ path: ~/company-presets, trust: system }]`）、`:54`；`PKG/presets/cordis/skills/editing-cordis-compositions/SKILL.md:28`（「A deployment can configure other roots」）。

第三方把 `roots` 塞进部署的两条路径（均在 profile/patch 层，不改 dsh 安装）：

- **路径 1：把包做成 profile bundle。** bundle = npm 包，manifest 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`：`APPBOOT/lib/types/profile.d.ts:8-13`。本机真实第三方样例（可作模板）：`%USERPROFILE%\.dsh\profiles\web\node_modules\dsh-whale-widget\package.json`（`dsh.bundle.patch` 指向同目录 `cordis.patch.yml`，后者内容是 `- insert: [{ id: dsh-whale-widget, name: dsh-whale-widget }]`）；另一个样例 `@dsh-pet/bridge` 同形。包的注册顺序在 profile manifest 的 `dsh.profile.bundles`：`%USERPROFILE%\.dsh\profiles\web\package.json:8-18`（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`dsh-whale-widget`、`@dsh-pet/bridge`）。
- **路径 2：用户/部署 patch 层。** profile 自己的 `cordis.patch.yml` 与 `$DSH_HOME/cordis.patch.yml` 在所有 bundle 层之后应用（先逐 profile、再 home，后者优先）：`APPBOOT/README.zh.md:55`；层序定义 `APPBOOT/lib/types/profile.d.ts:10-13`。

**关键约束（会决定插件方案是否可行）：**

- **按 id 定位的 patch 会替换该行整个 `config`，不做深合并**：`APPBOOT/README.zh.md:144`（「用户 patch 会替换匹配到的整个配置——按 id 定位的 patch 不做深度合并，因此 profile 覆盖必须重述需要保留的组合包字段」）。因此第三方要加 root，必须**重述 `default`** 等字段，例如：

  ```yaml
  # 推导示例（写法据字段语义与上述证据；未在本机实测）
  - id: agent-presets
    config:
      default: standard          # 必须重述，否则丢失
      roots:
        - path: <第三方包目录>/presets
          trust: system
  ```

  注意 `trust: system` 会让该根的 preset 不可删除（见 C.4），并使其命中 display 的本土化分支（仅对 4 个已知 id 生效，见 C.2）。
- **patch 的层序很重要**：`agent-presets` 这一行是 `@deepseek-ai/dsh-web-app` 的 bundle patch 通过 `- insert:` 插入的（`WEBAPP-PATCH:480-484`）。因此只有排在 `@deepseek-ai/dsh-web-app` **之后**的层才能按 id 命中它；否则该 patch 匹配不到行，只在 stderr 给出警告：`APPBOOT/README.zh.md:55`。
- `roots[].trust` 默认 `user`（`PKG/lib/index.js:1244`）；这意味着「随手配一个第三方根而不写 trust」会让它成为**可写根**（见 C.4 的 `writableRoot` 取「第一个 user 根」语义）。
- patch 层里也可以用 `!!js`：`APPBOOT/README.zh.md:55`、`APPBOOT/lib/types/index.d.ts:74-76`。

---

## C. 挂载/卸载语义

### C.1 挂载模型：每个 preset id 一份常驻组装

- 「每个 preset 在进程内只挂载一次，挂在常驻 scope 之下；agent 通过把自己的 scope key 认父到该挂载来加入」：`PKG/README.zh.md:99`；实现 `PKG/lib/index.js:1777-1802`（`createScope(this.selfCtx, { agentPreset: preset.id })` → `mountPreset`）。
- 加入 = `bindScopeParent(agentKey, standing.key)`：`PKG/lib/index.js:1504`（`mount()`）、`:1538`（`composeFrom()`，子 agent 继承父方同一份实例）。
- 单飞（single-flight）：两个并发首次使用同 id 的 agent 共享一次挂载；失败的 promise 会被移除以便重试：`PKG/lib/index.js:1768-1776`、`PKG/README.zh.md:121`。
- 服务实例的跨会话读取入口 `serviceForAgent`（因为 realm 对外不可见）：`PKG/lib/types/mount.d.ts:72-98`。
- 调用点必须在 agent 工厂的 `setup(agentCtx)`：`PKG/lib/index.js:1082-1087`（模块 JSDoc）、`PKG/lib/types/index.d.ts:16-20`。

### C.2 `order` 的作用 = 同一根目录内的排序（不是全局显示位次）

实现：`PKG/lib/types/discovery.js:310-313`

```js
found.sort((left, right) => {
  const byOrder = (left.order ?? Number.POSITIVE_INFINITY) - (right.order ?? Number.POSITIVE_INFINITY)
  return byOrder === 0 ? left.id.localeCompare(right.id) : byOrder
})
```

- 语义（JSDoc）：同一 group 内位置，数字小的在前；**未声明 `order` 的排在所有声明者之后，再按 id 排序**，这样随附集合可以按能力顺序读、而自建 preset 保持字母序：`PKG/lib/types/metadata.d.ts:27-32`。
- **排序只发生在单个根内**；跨根顺序由 `discoverPresets` 按根优先序拼接决定（`PKG/lib/types/discovery.js:321-331`，Map 首次写入为准）。所以：shipped 集合整体在最前，用户根整体在最后，无论 `order` 写多少都无法把用户 preset 插到 shipped 之前 —— 「order 是显示顺序」这个说法只在**同一个根内**成立。
- 最终 roster 顺序即被下游消费的顺序：客户端选择器「one option per selectable preset, in roster order」`CLIENT/lib/client.js:484`；组合清单「one composition per roster preset, in roster order」`PKG/lib/index.js:1384`。
- `order` **不参与挂载决策**：全包中对 `order` 的使用只有元数据读取（`PKG/lib/invariant.js:68,72,86-91`）与 `scanRoot` 排序（`:416-417`）；预设挂载只用 id（`PKG/lib/index.js:1778`）。
- 复制时会**丢弃 `order`**（保留 description），避免副本混进 shipped 的声明顺序：`PKG/lib/invariant.js:530-533`、`:560-569`。

### C.3 `name`/`description` 在 UI 的显示位置

| 位置 | 组件 | 槽位 / 证据 |
|---|---|---|
| 新会话页的 preset chip（hero，紧邻 workspace 选择器） | `AgentPresetSeat` | props `PropsRuntime<'conversation.hero.agentPreset'>`：`CLIENT/lib/types/client/AgentPresetSeat.d.ts:31`；用途说明 `:1-13` |
| 会话头部的 preset 标签（只读） | `AgentPresetLabel` | 槽位 `'conversation.session.header.actions'`：`CLIENT/lib/types/client/AgentPresetLabel.d.ts:23` |
| 设置里的「Agent presets」管理分区（卡片 + 复制对话框 + 只读查看器） | `AgentPresetSection` | 槽位 `'settings.section'`：`CLIENT/lib/types/client/AgentPresetSection.d.ts:54` |
| 设置 → 插件清单页（按 preset 分组展示组合行） | `PluginInventorySettingsTab` | 读取 `PluginInventorySnapshot['agentPresets']` 与 `presetDisplayText`：`dsh-client-ui-settings-plugin-inventory/lib/types/client/PluginInventorySettingsTab.d.ts:4`、`.../lib/client.js:245,660-661` |

- 宿主把 roster 投影为「无路径」的行（id/trust/isDefault/name/description/broken）供客户端渲染：`PKG/lib/index.js:1355-1368`、类型 `PKG/lib/types/types.d.ts:9-29`。
- 插件清单页的数据来自 `compositionInventory()`（每个 preset 的压平插件行 + roster 身份）：`PKG/lib/types/index.d.ts:132-149`、实现 `PKG/lib/index.js:1386-1424`。
- **本土化只覆盖 4 个内置 id**：shipped 且 id ∈ {standard, ptc, minimal, cordis} 时取字典键，否则回退到 preset 自己的 `preset.yml` 元数据（**用户自建元数据永不翻译**）：`PKG/lib/types/display.js:9-29`；键名清单 `CLIENT/lib/types/client/locales.d.ts:3`。**含义：新增一个随包交付的 preset（例如任务规划模式）不会自动获得本土化文案，除非改这个映射表与字典——但那是包内改动；作为第三方 preset 只需在 `preset.yml` 写中文 name/description 即可**（`PKG/lib/types/display.js:25-28`）。
- 管理分区按 trust 分组渲染：system → 「内置」、user → 「自定义」：`CLIENT/lib/client.js:1040`（`[["system", builtInGroup], ["user", customGroup]]`）、字典 `CLIENT/lib/client.js:77-78,131-132`。

### C.4 挂载 / 卸载 / 替换 / 删除的语义

- **挂载**：`mount(agentCtx, id?)`；id 省略用 `defaultId`；拒绝 broken preset：`PKG/lib/index.js:1499-1506`、`PKG/lib/types/index.d.ts:191-204`。
- **没有真正意义的「卸载」**：
  - 常驻挂载的子树由创建它的 scope 承载，会话侧只做父链重连；`recompose()` 是 re-link 而不是 unmount：`PKG/lib/types/index.d.ts:326-349`；实现 `PKG/lib/index.js:1696-1703`（`binding.rebind(standing.key)`）。
  - 被替代的代际永不回收（无加入计数），整棵子树留到进程结束：`PKG/README.zh.md:176`、`:190-192`。
  - `mountPreset` 的子树由 `agentCtx` 的 fiber 承载，随 agent 一起回卷，调用方拿不到 disposer：`PKG/lib/types/mount.d.ts:109-119`。
- **代际（generation）以组合文件为键**：stamp = `agent.cordis.yml` 的 `mtimeMs` + `size`；stamp 变化让**此后**创建的会话开启新代际，已加入的会话留在自己的代际：`PKG/lib/index.js:1770-1776`、`:1806-1818`；文档 `PKG/README.zh.md:100`、`:175`（只感知组合文件，感知不到旁边的 skill / asset 编辑）。
- **切换（重选 preset）**：仅空白会话（未产生消息/工具调用）可切换；已提交的切换追加 `agent-preset/selected` 事件并发出 `tools/change`：`PKG/README.zh.md:81`、`PKG/lib/types/index.d.ts:361-369`、错误码 `agent-preset/locked` `PKG/lib/types/types.d.ts:47-51`。客户端入口 `CLIENT/lib/client.js:1356`（`remote.agentPresets.select(session.id, staged)`）。
- **preset 目录「卸载」= 删除目录**：
  - 只允许删 `trust === 'user'` 且路径位于「第一个 user 根」之下：`PKG/lib/invariant.js:589-597`；`writableRoot` = `roots.find(r => r.trust === 'user')`：`:481-485`。
  - shipped（trust system）**拒绝删除**：`:590`。
  - 正在该 preset 上运行的会话不受影响（组合在创建时读取，之后不再读文件）：`PKG/lib/types/authoring.d.ts:60-70`。
  - 已知限制：只配了自己的可写根却保留 `includeUserRoot` 时，harness home 下的 preset「可发现、可挂载、删不掉」：`PKG/README.zh.md:173`。
- **升级安装时 shipped preset 是否被覆盖**：**是**。「An upgrade overwrites that install」`PKG/presets/cordis/skills/editing-cordis-compositions/SKILL.md:12`；`PKG/presets/cordis/agent.cordis.yml:28`（该目录属于部署，升级会覆盖它，且损坏 `cordis` 会连带禁用 preset 创作本身）。另外：
  - 用户根下的**副本永不随升级更新**，本层也没有「standard 加一处改动」的 patch 语义：`PKG/README.zh.md:179`。
  - 第三方等价行为（推导）：位于**被配置 root**（dsh 安装之外，例如第三方包目录或 `~/company-presets`）的 preset 不会被 dsh 升级覆盖；但若该目录就在第三方 npm 包内，则会被该包自身的安装/升级覆盖 —— 本层不提供任何版本合并或 patch 语义（`PKG/README.zh.md:179` 的「副本是会漂移的快照」同样适用于此）。**该等价行为未在代码中直接断言，标为推导。**

---

## D. 自定义 preset 携带自己的 skill

### D.1 精确挂载行与目录约定

`PKG/presets/cordis/agent.cordis.yml:249-263`（唯一随附的「preset 自带 skill」实例）：

```yaml
# The composition-authoring skill travels with this preset rather than living
# in the user's skill root ... `baseUrl` is the preset's own directory, so the
# root resolves wherever the preset is installed.
- id: skill-filesystem
  name: '@deepseek-ai/dsh-skill-filesystem'
  config:
    customSkillDirs:
      - !!js "process.getBuiltinModule('node:url').fileURLToPath(new URL('skills/', baseUrl))"

- id: tool-skill
  name: '@deepseek-ai/dsh-tool-skill'
```

要点：

- `baseUrl` 在 `!!js` 表达式里可用，因为 Loader 用 `with (ctx)` 求值，而 `Include` 已把该 context 的 `baseUrl` 改写成**组合文件所在目录**：`LOADER/lib/index.js:289-300`、`:689`；分类规则 `PKG/lib/types/specifier.d.ts:22-26` 与注释 `:4-12`；文件内注释也确认这点：`PKG/presets/cordis/agent.cordis.yml:251-252`。
- `customSkillDirs` 是 `string[]`：`SKILLFS/lib/types/index.d.ts:27`；rank 300（在项目根 100/200 之后、用户根 400/500 之前）：`SKILLFS/README.zh.md:46-54`、`:71`。
- 这两行注册进**本 preset 自己的 skill 注册表层**，无需 realm；agent 的合并目录还会带上部署级（宿主）注册的 skill：`PKG/presets/cordis/agent.cordis.yml:253-255`；standard 里的同义注释 `PKG/presets/standard/agent.cordis.yml:79-83`。
- **standard 的 `skill-filesystem` 没有 `customSkillDirs`**（只用默认根）：`PKG/presets/standard/agent.cordis.yml:84-88`。也就是说「preset 自带 skill」是需要显式加 `customSkillDirs` 的能力，不是默认行为。
- 每个挂载代际都会新建一套 skill-filesystem（会带来活跃 watcher）：`PKG/README.zh.md:176`。

### D.2 目录约定与 `SKILL.md` frontmatter 要求

- 形态：被扫描根的**顶层**目录 bundle `<name>/SKILL.md`，或平铺文件 `<name>.md`；刻意不支持嵌套 `**/SKILL.md`：`SKILLFS/README.zh.md:36`、`:108`。
- frontmatter：**必填 `name` 与 `description`**；可选 `whenToUse`、`metadata`、`disable-model-invocation`、`user-invocable`：`SKILLFS/README.zh.md:36`。
- `name` 必须是 kebab-case：`SKILLFS/README.zh.md:108`。
- 两个调用键按严格布尔语法解析，非法拼写会让整个 skill 连同警告被丢弃：`SKILLFS/README.zh.md:38`。
- 实例：`PKG/presets/cordis/skills/editing-cordis-compositions/SKILL.md:1-4`（`name: editing-cordis-compositions` + 长 description）、`PKG/presets/cordis/skills/cordis-plugin-development/SKILL.md:1-4`。
- 附带资源（`references`/`scripts`/`assets`）下的编辑不会触发刷新；`SKILL.md` 的新增/改名/删除/变更才触发：`SKILLFS/README.zh.md:79`、`:112`。
- **preset 自带的 skill 不参与 preset 健康检查**：stamp 只看 `agent.cordis.yml`（`PKG/README.zh.md:175`），因此编辑 skill 后要让新会话看到变化，需重启进程或改动组合文件本身。

---

## E. preset 能注册什么；什么必须做成独立 cordis 插件包

### E.1 preset 可以注册的（有随附实例）

| 能力 | 结论 | 证据 |
|---|---|---|
| 工具（tool） | **可以** | 组合里的 `ctx.tools` / `ctx.systemPrompt` 注册会落到该 agent 的层并随其回卷：`PKG/lib/types/mount.d.ts:5-9`；实例：`PKG/presets/standard/agent.cordis.yml:45-51`（tool-bash / tool-pwsh）、`:57-63`（tool-fs / tool-fs-search）、`:236-255`（tool-ask-user / tool-todo / tool-web / present） |
| 人用命令（command） | **可以** | `PKG/presets/standard/agent.cordis.yml:92-96`（注释：goal 的「human command and model-facing tool register into this preset's scoped layers」+ `command-goal` 行）；`:148`（`command-compact`） |
| 系统提示词段落 / persona | **可以** | `PKG/presets/standard/agent.cordis.yml:22-34`；`:28`（`suffix`/`prefix` 模板） |
| 会话级服务（provider） | **可以，但必须在带 `isolate` 的 group 里** | `PKG/presets/standard/agent.cordis.yml:11-18`（「A service row here MUST sit inside a group carrying an `isolate` realm」）；拒绝逻辑见 F 节 |
| preset 自带本地插件文件 | **可以** | 行 `name` 以 `.` 开头时相对 preset 目录解析：`PKG/lib/types/specifier.d.ts:22-26`；mount 的 import 覆盖对 `preset` 类走 `super.import`（即组合目录为基准）：`PKG/lib/invariant.js:665-669` |
| `cordis:group` / `isolate` | **可以** | 四个随附 preset 全部使用：`standard:105-109,138-143,169-173`、`minimal:21-26`、`cordis:93-100`、`ptc:19-25`（注释说明 `true` = entry-local realm，字符串标签是「join REALMS」而非池化实例） |

### E.2 preset **不能**注册的：浏览器客户端 UI 行

结论：**preset 无法贡献客户端 UI（浏览器 bundle）**。证据链（两步，结论标注为推导）：

1. 客户端浏览器 bundle 的启动图由 host 半侧**扫描 `ctx.loader.entries()`** 中声明了 `dsh.client` 的包组成：`<DSH_INSTALL>\node_modules\@deepseek-ai\dsh-client-modules\lib\index.js:475`（`for (const entry of ctx.loader.entries()) this.dirty.add(entry.options.name)`）、`:777`（同一扫描）、模块 JSDoc `:67-68`；`dsh.client` 的声明字段见 `MANIFEST/lib/types/types.d.ts:38-52`（`platform` / `inject` / `immediately` / `external`）。
2. preset 的子树是**直接 plug 的**，因此不存在于 `ctx.loader.entries()`：`PKG/lib/types/mount.d.ts:9-10`（「a directly-plugged subtree is absent from `ctx.loader.entries()` and no boot audit covers it」）；实现层同义说明 `PKG/lib/invariant.js:615-620`（「A subtree plugged directly (rather than created as a loader entry) never links itself to an `Entry`」）。

⇒ 一个 preset 行不会出现在客户端模块扫描里，因此**不能**注册 UI 槽位/设置分区/主题等浏览器能力。客户端界面必须做成独立包并挂在**宿主组合**（范例：`WEBAPP-PATCH:331-334` 插入 `ui-agent-preset` 行，注释「The agent-preset row in General settings」）。
（这是由上述两条已读代码推出的结论，**未做运行时验证**，标为推导。）

好处：新模式的插件行仍会在既有客户端表面可见 —— 设置→插件清单页按 preset 展示组合行（`.../PluginInventorySettingsTab.d.ts:4`、`.../lib/client.js:245,660-661`），无需新写浏览器代码。

### E.3 判断依据：什么「必须」做成独立 cordis 插件包

来自随附注释与文档的判据（可直接引用为设计规则）：

- **判据 1：host 行 `inject` 的服务不能来自 preset。** injection 在任何 session 存在之前就解析完成，没有 agent 可以按 agent 取实例；`serviceForAgent` 明确不支持该用法：`PKG/lib/types/mount.d.ts:86-94`。实例：`shell-env` 必须留宿主（`PKG/presets/standard/agent.cordis.yml:38-44`）、`tokenMeter` 留宿主（`:131-137`）、`subagents` 注册表与其后端留宿主而 preset 只贡献委派工具（`:160-164`）、`web` 服务留宿主只把 `tool-web` 放 preset（`:246-252`）。
- **判据 2：有 agent 平面之外的消费者 ⇒ 归宿主。** `subagents` 的注册表要回答宿主 api-proxy 的跨会话查询，且 provider 名只能注册一次 —— per-session 副本会同时饿死宿主行并在第二个会话冲突：`PKG/presets/cordis/skills/editing-cordis-compositions/SKILL.md:24`；`WEBAPP-PATCH:436-441`。
- **判据 3：浏览器 UI ⇒ 宿主（见 E.2）。**
- **判据 4：行必须提供进程级单例、或会被宿主其它行 `ctx.get` 读取的服务** ⇒ 归宿主；只被 realm 内兄弟行读取、且没有外部读者时才可以放进 preset 的 entry-local realm：`WEBAPP-PATCH:374-382`（jobs 注册表的判据说明）、`PKG/presets/standard/agent.cordis.yml:66-74`。
- **实践含义**：一个新的「模式」若只是「换一组工具/提示词/压缩策略/skill」，做成 preset 足够；若要做成**新工具插件的实现包**，则以 npm 包形式安装到 harness（preset 行按裸包名引用，从 harness base 解析：`PKG/lib/types/specifier.d.ts:32-36`）或作为 preset 目录内的相对文件。要新增**客户端 UI**，必须另做 `dsh.client` 包并挂在宿主组合。

---

## F. 校验、不变式与常见挂载失败原因

### F.1 发现阶段的健康检查（不做 import）

判据来源 `PKG/lib/types/discovery.js:210-246`（`compositionProblem`），逐项给出 broken 原因：

| 情形 | 结果/原因文本 | 证据 |
|---|---|---|
| `agent.cordis.yml` 缺失 | broken：`the composition file agent.cordis.yml is missing — the directory still occupies the id; delete it or restore the file` | `PKG/lib/types/discovery.js:297-299` |
| 文件读不了 | `the composition file agent.cordis.yml cannot be read` | `:215-219` |
| YAML 非法（用 Loader 自己的 `entryListSchema`，只取首行） | `the composition is not valid YAML: ...` | `:220-230` |
| 顶层不是行列表 / 行缺 `name` | `entryListProblem` 的文本（见 A.4） | `:231-233`、`:72-94` |
| 某个会启动的行其模块解析不到 | `row "X" names a plugin that cannot be resolved: <name>`（多行时逐条列出） | `:237-245` |
| 目录名不匹配 `PRESET_ID` | 不是 broken，而是**跳过**（不占 id、不显示） | `:292-294`、`:270-274` |
| `disabled` 为真值的行 | 不参与可解析性检查 | `:187-188` |
| `disabled` 是 `!!js` 表达式 | 对象恒真 ⇒ 跳过（避免把可用 preset 误报 broken） | `:169-172`、`README.zh.md:178` |

- 健康检查**从不 import**：`PKG/lib/types/discovery.d.ts:16-20`、`PKG/README.zh.md:178`。因此「入口文件缺失的包、apply 时抛错的插件、永远等待某服务的插件」都留到第一个会话才失败。
- broken 的行**保留在 roster**（不隐藏、不跳过），并在所有挂载路径上被提前拒绝：`PKG/lib/types/preset.d.ts:31-37`、`PKG/README.zh.md:102`；`resolve()` 允许解析 broken 行（删除/查看需要），挂载走 `resolveMountable` 拒绝：`PKG/lib/types/index.d.ts:150-171`。
- 客户端对 broken 行的处理：渲染为标记卡片，正文与复制被禁用；自定义行的位置与删除动作保留：`CLIENT/README.zh.md:32`。

### F.2 挂载阶段的守卫（`mountPreset`）

三条硬性拒绝 + 一条包装，实现 `PKG/lib/invariant.js:904-937`：

1. **无 scope 的目标** → `refusing to mount preset "X" into an unscoped context; its registrations would apply to every agent in the process`：`:905`。
2. **未达到可用状态的行** → `N row(s) did not activate:` 逐行列出；单行的具体原因是「仍在等待组合从未提供的服务」（`<id> (<name>): waiting for <services>`）：`:917-918`、`:838-854`。
3. **把服务发布进 root realm 的行** → `row(s) published process-global service(s) [<names>]; a preset service must sit behind an \`isolate\` realm or move to the host composition`：`:919-920`；泄漏检测原理（用 root realm 的符号比对实现所属 fiber）：`:760-774`、`PKG/lib/types/mount.d.ts:43-54`。
4. 任何失败都被包成 `RemoteError('agent-preset/invalid')`，消息里带**组合文件的绝对路径**，并保留 cause：`:927-936`；`AggregateError` 的多个失败行会被展开成嵌套列表，避免只报「loader entries failed to apply」：`:869-893`。

### F.3 不变式伴生插件（`lib/invariant.js`）

- 入口与依赖：`PKG/lib/invariant.js:1805-1809`（`PACKAGE_NAME`、`name = "agent-presets-invariant"`、`inject = ["invariants"]`）、注册 `apply`：`:1839`；声明同 `PKG/lib/types/invariant.d.ts:7-15`。
- 不变式 1：**每次服务通知时复查泄漏** —— 因为「从定时器或异步续体发布的服务」会绕过一次性挂载审计：`:1819-1826`、`PKG/README.zh.md:129`。注意该伴生插件属于开发组合，shipped host 不加载它：`PKG/lib/invariant.js:702-706`（`mounts` 注释：「`dsh-invariants` is a development composition — a shipped host never loads it」）。
- 不变式 2：`system-prompt/assemble` 时，若 roster 已组成而某 agent 未加入任何 preset，则 fail（其工具/提示词/skill 目录会退化为空的全局层）：`:1827-1832`。
- 非致命提示：roster 非空但 agent 发布时未加入 preset 会 `logger.warn`：`PKG/lib/index.js:1320-1324`。

### F.4 常见挂载失败原因清单（按症状 → 原因 → 证据）

| 症状 | 原因 | 证据 |
|---|---|---|
| roster 列出 broken，挂载被提前拒绝 | 缺组合文件 / YAML 非法 / 非行列表 / 行缺 `name` / 模块解析不到 | F.1 |
| 会话创建失败，报 `N row(s) did not activate` | 某行在等一个组合从未提供的服务 | `PKG/lib/invariant.js:917-918,838-854` |
| 会话创建失败，报 published process-global service | 提供服务的行没放在带 `isolate` 的 group 里（服务名泄漏到 root realm）；第二个发布同名服务的 preset 会相撞 | `PKG/lib/invariant.js:919-920`；`PKG/README.zh.md:129`；`PKG/presets/standard/agent.cordis.yml:11-18` |
| 同一 preset 内第二个同名服务注册即抛 | 同一 realm 符号下的第二次 `provide()` 抛错；**共享标签不会池化实例**（标签是 join realm） | `PKG/presets/standard/agent.cordis.yml:16-18`、`PKG/presets/ptc/agent.cordis.yml:22-25` |
| 复制被拒 | id 不符合 `^[a-z0-9][a-z0-9-]*$`（id 会成为目录名）、id 已被 roster 或磁盘占用（复制从不覆盖）、部署没有可写根 | `PKG/lib/invariant.js:542-551`、`:467-473`、`:481-485`；`PKG/README.zh.md:77` |
| preset 看得见、挂得上，但删不掉 | 不在「第一个 user 根」之下（例如配了自有可写根却保留 `includeUserRoot`） | `PKG/lib/invariant.js:589-597`；`PKG/README.zh.md:173` |
| 切换 preset 被拒 `agent-preset/locked` | 会话已产出内容（有消息或工具调用），组装在会话生命周期内固定 | `PKG/lib/types/types.d.ts:47-51`；`PKG/README.zh.md:81` |
| 未知 id `agent-preset/not-found` | 没有任何已配置根提供该 id（错误详情带 `available` 列表） | `PKG/lib/types/types.d.ts:32-36`；`PKG/lib/types/index.d.ts:150-160` |
| 启动即失败 | 未配 `default`（schema required）；或 roster 拿不到 `ctx.baseUrl`（必须挂在 Loader 下或给 context 设 base） | `PKG/lib/index.js:1241`、`:1297-1298` |
| 组合改动对老会话无效 | 代际以组合文件 stamp 为键，已加入会话保持原代际；skill/asset 编辑不触发新代际 | `PKG/lib/index.js:1770-1776,1806-1818`；`PKG/README.zh.md:100,175` |
| 升级后随附 preset 的本地副本不更新 | 副本是快照，本层无 patch 语义；shipped 安装本身会被升级覆盖 | `PKG/README.zh.md:179`；`SKILL.md:12` |

---

## G. 对新模式（插件开发）最相关的事实小结

1. **一个新模式的最小交付物就是一个目录**：`<root>/<id>/agent.cordis.yml`（顶层数组）+ 可选 `preset.yml`（name/description/order）+ 可选 `skills/`（`PKG/lib/types/discovery.js:35`、`PKG/lib/types/metadata.d.ts:20`、`PKG/presets/cordis/agent.cordis.yml:256-260`）。
2. **第三方落地路径只有配置 `roots`**：没有 manifest 字段、没有包内自动发现（B.4）；`roots` 可在 profile bundle patch 或用户 `cordis.patch.yml` 里设置，但**按 id 的 patch 会整段替换 config，必须重述 `default`**（`APPBOOT/README.zh.md:144`），且必须排在插入该行的 `@deepseek-ai/dsh-web-app` 层之后（`WEBAPP-PATCH:480-484`）。
3. **`order` 只能在同一个根内排序**，无法把新模式排到 shipped 之前（`PKG/lib/types/discovery.js:310-313,321-331`）；新模式的显示名与描述来自它自己的 `preset.yml`，不会自动本土化（`PKG/lib/types/display.js:22-28`）。
4. **模式可以给 agent 加工具、命令、提示词、skill**；**不能**加浏览器 UI（E.2）。要加 UI 必须另做 `dsh.client` 包并挂宿主组合。
5. **提供服务的行必须包在带 `isolate` 的 group 里**，否则该 preset 在第一次挂载时被拒（`PKG/lib/invariant.js:919-920`，`PKG/presets/standard/agent.cordis.yml:11-18`）。
6. **preset 文件是只读输入**：被挂载的子树把 `write()` 覆写为空操作，loader 的回写不会覆盖 preset 文件（`PKG/lib/invariant.js:676-692`、`PKG/README.zh.md:101`）。
7. **不确定/未证实项**：`code` preset 的缺失原因（见 A.2）；第三方包目录内的 preset 在包升级时的具体覆盖行为（无代码断言，标推导）；preset 行不可能贡献浏览器 bundle 的结论（两步证据推导，未实测）；`intercept` 字段在 preset 场景的可用性（Loader 支持该字段：`LOADER/lib/types/config/isolate.d.ts:5-7`，但随附 preset 未使用，未验证其在 preset 子树中的行为）。
