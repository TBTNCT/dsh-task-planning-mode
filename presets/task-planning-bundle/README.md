# task-planning-bundle · 「任务规划」模式的 DSH bundle 包（新版机制）

> **适用**：DSH 0.2.x（声明式 preset：`@deepseek-ai/dsh-agent-preset` + `@deepseek-ai/dsh-agent-preset-registry`）
> **不适用**：DSH 0.1.x 的目录机制（那套见 [`../task-planning/`](../task-planning/)，在本机运行版本上是死数据，见 [`../../docs/实施记录/01-预设机制冲突-运行时版本不符.md`](../../docs/实施记录/01-预设机制冲突-运行时版本不符.md)）
> **本包自带 4 样东西**（其余 preset 子插件全部来自 DSH 安装自带的包）：
> ① `cordis.patch.yml`（组合补丁）；② `PROMPT.md`（模式系统提示词正文，任务 04，由 persona 行的 `!!js` 按包名读入）；
> ③ `plugins/token-estimator/`（本地工具插件，任务 03，零第三方依赖）；④ `skills/planning-templates/`（规划文档模板 skill，任务 05）。

## 〇、本包的文件清单

```text
task-planning-bundle/
├── package.json                          # dsh.bundle.patch → ./cordis.patch.yml；包名 dsh-task-planning-preset
├── cordis.patch.yml                      # insert 一行 @deepseek-ai/dsh-agent-preset（preset 本体）
├── PROMPT.md                             # 模式系统提示词正文（13 小节 + 12 条硬约束 + 4 组 25 条作业纪律）
├── plugins/token-estimator/index.js      # 本地工具：estimate_tokens / usage_report
├── skills/planning-templates/SKILL.md    # 规划文档模板：5 类文档的【必须】/【可选】章节 + 可复制骨架
└── README.md                             # 本文件
```

> 三处 `!!js` 走**同一条解析基准**（profile 的 `node_modules` 里有本包的 link，按包名解析）：
> persona 读 `PROMPT.md`、`skill-filesystem` 的 `customSkillDirs` 取 `skills/`、`token-estimator` 按包名子路径挂载。
> **都不要写相对路径** —— 补丁层行的 `baseUrl` 是 profile 配置目录，不是本目录（证据与实测见
> [`../../docs/实施记录/04-提示词接线实测.md`](../../docs/实施记录/04-提示词接线实测.md) §2 与
> [`../../docs/实施记录/05-模板接线记录.md`](../../docs/实施记录/05-模板接线记录.md) §2）。

## 一、这个包做了什么

`cordis.patch.yml` 往 profile 的组合树里 `insert` 一行 `@deepseek-ai/dsh-agent-preset`，其 `config` 就是一个完整的 preset 声明：

| 字段 | 值 | 含义 |
|---|---|---|
| `id` | `task-planning` | 会话保存与选择器内部使用的 preset 标识符 |
| `name` | `任务规划` | 选择器/设置页显示名 |
| `description` | 把模糊想法问清楚并拆成可执行的规划与提示词，自己不动手实现。 | 显示说明 |
| `order` | `5` | 列表排序（越小越靠前） |
| `plugins` | persona + `agent-instructions` + `time-context` + `tool-bash`/`tool-pwsh`（平台二选一）+ `tool-fs` + `tool-fs-search` + `tool-jobs` + `skill-filesystem` + `tool-skill` + `tool-ask-user` + `tool-todo` + `tool-web` + `present` + `token-estimator` + compaction 组 | 子插件行（**任务 02 的标准档**，任务 03 追加 `token-estimator`：现为**顶层 16 行 / 展开 19 行**；任务 01 的最小集是它的 5 行子集） |

字段名与约束来自本机运行的 `@deepseek-ai/dsh-agent-preset` 源码（`lib/index.js`）：

```js
static Config = z.object({
  id: z.string().required(),
  name: z.string(),
  description: z.string(),
  order: z.number(),
  plugins: z.array(z.any()).required()
});
```

> 行 id（`preset-task-planning`）与 preset id（`config.id: task-planning`）是两回事：前者是 Loader 的编辑地址（按 id 写覆盖补丁用），后者才是模式的身份。

## 二、安装（**人工操作**，铁律 11/12：AI 不写 `profiles\`）

在 DSH **桌面端**里：

1. 左侧栏点 **插件**（`ui-plugin-manager` 页面）。
2. 点 **添加插件**（或箭头菜单里的 **安装第三方插件**）。
3. 在包名输入框里粘贴**本目录的绝对路径**：

   ```text
   <REPO>\presets\task-planning-bundle
   ```

   （安装对话框接受「包名（可带版本）、Git 地址、压缩包或本地绝对路径」，本地路径会直接读本目录的 `package.json`。）
4. 等 Host 读出 `dsh-task-planning-preset` 与版本 `0.1.0`，点 **安装**，等 pnpm 跑完。
5. 安装完成界面点 **立即启用**（或回插件列表打开该组合包的开关）。
6. **新开一个会话**，模式选择器里应出现「**任务规划**」。
   - 若没有：**重启桌面端**再新开会话（未启用 HMR 的 profile，组合变更保留到重启）。
   - 若显示「加载失败」：插件页会有该组合包的报错，把原文抄回报告（铁律 11）。

### ⚠️ 常见失败：`ERR_PNPM_UNEXPECTED_STORE`（本机已实测，修法已验证并**已应用**）

> **本机现状（2026-10-12 12:57）**：修法 1 **已经应用**（`<DSH_HOME>\profiles\desktop\pnpm-workspace.yaml`
> 已含 `storeDir: <DSH_HOME>\.pnpm-store`），并用自带 pnpm 11.7.0 与全局 12.3.4 双重复核通过
> （`store path` → `<DSH_HOME>\.pnpm-store\v11`）。本节留档：**若你再次看到这个报错**，说明那一行不在了，
> 按下面重新加回去即可。

现象原文：

```text
[ERR_PNPM_UNEXPECTED_STORE] Unexpected store location
The dependencies at "<DSH_HOME>\profiles\desktop\node_modules" are currently linked from the store at "<DSH_HOME>\.pnpm-store\v11".
pnpm now wants to use the store at "D:\.pnpm-store\v11" to link dependencies.
```

**原因**：profile 的 `node_modules` 是早先用 `<DSH_HOME>\.pnpm-store\v11` 装的；
而桌面端自带的 pnpm（实测 **11.7.0**，宿主用 Electron 当 node 跑 `resources\runtime\pnpm\bin\pnpm.mjs`）
在 profile 目录下解析出的是 `D:\.pnpm-store\v11` —— 只有 store **位置**不同，store 版本号相同。

**修法（二选一，都必须人工做：前者在 profile 目录，后者是全局配置，都属铁律 12 禁区）**

1. **推荐**：在 `<DSH_HOME>\profiles\desktop\pnpm-workspace.yaml` 末尾加一行（**必须是 camelCase 的 `storeDir`**）：

   ```yaml
   storeDir: <DSH_HOME>\.pnpm-store
   ```

   已用**自带 pnpm 11.7.0** 与**全局 pnpm 12.3.4** 双重复核：`pnpm store path` 均回到 `<DSH_HOME>\.pnpm-store\v11`。

2. 全局配置（一行命令；影响本机所有 pnpm 项目，但只是把 store 钉回 profile 已在用的那个）：

   ```powershell
   pnpm config set store-dir <DSH_HOME>\.pnpm-store --global
   ```

**已实测无效、不要再试的写法**：

- 项目 `.npmrc` 里写 `store-dir=…` 或 `storeDir=…`（pnpm 11.7.0 与 12.3.4 都忽略）；
- `pnpm-workspace.yaml` 里写 kebab 的 `store-dir: …`（忽略）。

**失败是安全回滚的**：本机实测，安装失败后 profile 的 `package.json` 里 `dependencies` 与 `dsh.profile.bundles`
都没有残留（pnpm 的失败流程会恢复 `package.json` 与 `pnpm-lock.yaml`）。修好后再回到第二节第 2 步重试安装。

> 命令行等价形式（本机没有全局 `dsh` 命令，仅作参考）：`dsh plugin --profile desktop add <本目录绝对路径>`

## 三、卸载与更新

- **卸载**：插件页 → 该组合包卡片 → 卸载（会从 `dsh.profile.bundles` 移除并 `pnpm remove`；AI 不代做）。
- **更新**：改完 `cordis.patch.yml` 后重新安装（官方说明：插件安装后暂不支持自动更新，升级需先卸载再装新版）。
  本地路径安装时，改动通常随**重启桌面端**加载，但以插件页显示的状态为准。

## 四、改这个包时的硬约束（与任务书一致）

1. **不给 `persona` 设 `complete: true`** —— 否则 DSH 的工具指引与运行上下文会全部丢失。
2. **服务类行必须放在带 `isolate` 的 `cordis:group` 里**；同一 realm 里同名服务只能注册一次。
3. `config.plugins` 里每行的 `id` 必须唯一；group 行的子行写在它的 `config` 列表里。
4. preset 的服务提供方与其消费方要共享**同一个 realm**（本包的 `compaction` / `toolResultPruner`）。
5. 行引用的包名必须存在于 DSH 安装（`asar/dsh/node_modules/...`）或 profile 的依赖里，否则该声明加载失败。
6. **必填 config 字段必须给全（本机实测踩过的坑）**：0.2.x 把若干 0.1.5 时代可选的字段改成了必填，
   例如 `@deepseek-ai/dsh-tool-fs-search` 的 **`sampleOverCapGlobResults`**（`z.boolean().required()`）。
   少一个必填字段 → **整个 preset「加载失败」**：设置页「自定义」分组里能看到卡片但带「加载失败」红标，
   而**模式选择器里完全看不到它**（选择器只列健康 preset）。
   改完务必跑校验脚本。三支校验当时都是**临时产物**（跑完即删，不随仓库发布），源码留档在各任务的
   实施记录与验收报告里，可按需照抄重建（用本机任意 Node ≥ 20 跑即可）：

   - **bundle 校验**：从安装树里逐个包提取 schema 的 `.required()` 字段核对，并与打包版 `standard.patch.yml` 对照；
   - **清单校验**（任务 02 起）：核"该挂的 14 行都挂了 / 禁用的 11 个包一个都没挂 / 只有 compaction 带 isolate /
     三个裁剪阈值 / `!!js` 原文"；
   - **skill 校验**（任务 05 起）：核"`customSkillDirs` 的 `!!js` 在真实 `baseUrl` 下求值到本包的 `skills/` +
     运行方自带 provider 能发现并加载 `planning-templates` + 骨架关键特征齐全"；
     （脚本源码留档在 [`../../docs/实施记录/05-模板接线记录.md`](../../docs/实施记录/05-模板接线记录.md) §5）

   三支都跑，全 PASS 才算文件级通过（**文件级通过 ≠ 能用**：运行方口径的判据是"重启后新开会话里模式正常且工具可见"，见 `docs/实施记录/02-工具实测表.md` §4.0）。
7. 改完 `cordis.patch.yml` 后**重启桌面端**即可（`link:` 安装就地读文件，不需要重新安装）。
   注意：**只改 `PROMPT.md` 或只改 `skills/` 下的文件不会生效** —— preset 的重组代际只看**补丁文件**的 mtime+size，
   而 `!!js` 只在挂载激活时求值一次。改完提示词或 skill 后，务必**同时触碰 `cordis.patch.yml`**（改动其中一行注释即可）。
8. 只从本仓库这一份安装；不要在别处 `pnpm add` 出一个副本，避免两份 patch 抢同一个 preset id。
