# task-planning-bundle · 「任务规划」模式的 DSH bundle 包（新版机制）

> **适用**：DSH 0.2.x（声明式 preset：`@deepseek-ai/dsh-agent-preset` + `@deepseek-ai/dsh-agent-preset-registry`）
> **不适用**：DSH 0.1.x 的目录机制（那套见 [`../task-planning/`](../task-planning/)，在本机运行版本上是死数据，见 [`../../docs/实施记录/01-预设机制冲突-运行时版本不符.md`](../../docs/实施记录/01-预设机制冲突-运行时版本不符.md)）
> **本包不含任何 JavaScript**：它只提供一份组合补丁，preset 的子插件全部来自 DSH 安装自带的包。

## 一、这个包做了什么

`cordis.patch.yml` 往 profile 的组合树里 `insert` 一行 `@deepseek-ai/dsh-agent-preset`，其 `config` 就是一个完整的 preset 声明：

| 字段 | 值 | 含义 |
|---|---|---|
| `id` | `task-planning` | 会话保存与选择器内部使用的 preset 标识符 |
| `name` | `任务规划` | 选择器/设置页显示名 |
| `description` | 把模糊想法问清楚并拆成可执行的规划与提示词，自己不动手实现。 | 显示说明 |
| `order` | `5` | 列表排序（越小越靠前） |
| `plugins` | persona + `tool-ask-user` + `tool-fs` + `tool-fs-search` + compaction 组 | 子插件行（任务 01 的最小集） |

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
6. 只从本仓库这一份安装；不要在别处 `pnpm add` 出一个副本，避免两份 patch 抢同一个 preset id。
