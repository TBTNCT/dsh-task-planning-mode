# presets/ · 两套 preset 机制与两份交付物

> 结论先说：**本机（桌面端）跑的是新版机制，请用 `task-planning-bundle/`。**
> `task-planning/` 是旧机制的产物，在本机运行版本上不会被任何代码读取，只作历史留档。
> 完整证据与版本对照：`docs/实施记录/01-预设机制冲突-运行时版本不符.md`、`docs/调研/03-preset机制-新版.md`

| 目录 | 机制 | 适用 DSH 版本 | 在本机的状态 |
|---|---|---|---|
| [`task-planning-bundle/`](task-planning-bundle/) | **声明式 preset**：bundle 补丁插入一行 `@deepseek-ai/dsh-agent-preset`，`config.plugins` 内联工具行；用插件管理器装进 profile | **0.2.x（本机运行版本）** | ✅ 本任务的交付物，待人工安装 |
| [`task-planning/`](task-planning/) | **目录型 preset**：`<home>\.agent-presets\<id>\agent.cordis.yml` + `preset.yml`，整目录复制到用户层 | 0.1.x | ⚠️ 无效：新版 registry **不扫描目录**，已复制到 `%USERPROFILE%\.dsh\.agent-presets\task-planning\` 的那份是死数据 |

## 两个机制的关键差别（决定任务 02–09 怎么写）

| 维度 | 旧机制（0.1.x） | 新机制（0.2.x） |
|---|---|---|
| preset 的身份 | 一个目录，目录名 = preset id | 一行 `@deepseek-ai/dsh-agent-preset`，`config.id` = preset id |
| 工具/提示词清单 | `agent.cordis.yml`（顶层数组） | 该行 `config.plugins`（同样是插件行列表） |
| 显示元数据 | `preset.yml`（`name`/`description`/`order`） | `config.name`/`description`/`order` |
| 发现方式 | 扫描 shipped 根 + `<home>/.agent-presets` | 扫描**插件行**，**不扫描目录** |
| 新增 preset | 往用户层复制目录 | 写一个 **bundle 包**（`dsh.bundle.patch`），用**插件管理器**装进 profile |
| 本地 JS 插件（任务 03） | `name: './plugins/xxx'` 相对 preset 目录 | 需要随 bundle 包分发（bundle 自身的行）或装成独立包，**没有 preset 目录可依赖** |
| 删除 | 删目录 | 卸载组合包 |
| Web UI | 设置页可查看/复制 preset | 设置页**只读**；创建/修改走**创造模式**或外部 bundle |

## 文件清单

```text
presets/
├── README.md                       ← 本文件
├── task-planning-bundle/           ← 新版交付物（0.2.x）＝ npm 包 dsh-task-planning-preset 的全部内容
│   ├── package.json                #   dsh.bundle.patch → ./cordis.patch.yml；files 白名单（任务 09）
│   ├── cordis.patch.yml            #   insert: @deepseek-ai/dsh-agent-preset（task-planning）
│   ├── PROMPT.md                   #   模式系统提示词正文（任务 04）
│   ├── plugins/token-estimator/    #   本地工具插件：estimate_tokens / usage_report（任务 03）
│   ├── skills/planning-templates/  #   规划文档模板 skill：5 类骨架（任务 05）
│   ├── LICENSE                     #   MIT（与仓库根逐字一致，任务 09 随包分发）
│   └── README.md                   #   人工安装/卸载/更新步骤与硬约束
└── task-planning/                  ← 旧机制产物（0.1.x，本机无效）
    ├── preset.yml
    ├── agent.cordis.yml
    └── plugins/token-estimator/    #   空目录（任务 03 的落点随机制改到 bundle，此目录未使用）
```

## 为什么两份都留着

`task-planning/agent.cordis.yml` 里的行清单与 `task-planning-bundle/cordis.patch.yml` 的 `config.plugins`
**是同一套行**（persona / ask_user / fs / fs-search / compaction 组），保留它可以让读者对照"同一份能力在两种机制下
怎么写"，也保留了 0.1.x 用户的安装路径。若将来确认只支持 0.2.x，可在任务 08（开源化）时把旧目录移入 `docs/` 或删除。
