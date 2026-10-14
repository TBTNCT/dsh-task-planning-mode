# 任务 09（可选）· npm 壳包评估（含最终裁决：不实施）

> 任务文件：`docs/工作流程/09-可选-npm壳包.md`
> 评估时间：2026-10-14　**评估者**：执行 AI（标准模式会话）
> 性质：**第一步只做评估**（任务书第三节要求"先评估再动手"）。
> 证据口径：凡本机命令读到的标「实测」并附原始输出；由多条证据推出而未运行验证的标「推导」。

---

## ⛔ 最终裁决（2026-10-14，人工）：**不实施**

评估落盘后，人工先裁决"按方案 (d) 实施"，机器侧改动完成并验证通过（2 个提交）；**随后人工改判：停掉本任务，不再发布**。
按该裁决，实施产物**已全部回滚**，本文件保留为决策记录。当前状态：

| 项 | 状态 |
|---|---|
| 评估（本文件） | ✅ 保留 —— 它记录了"任务书前提在 0.2.x 上不成立"这个结论，避免以后有人照任务书原文再踩一遍 |
| 实施（`package.json` 改动 / 包内 `LICENSE` / 四份 README 的 npm 路线 / `CHANGELOG` / 台账） | ↩️ **已回滚**（`git checkout 74fd5e8 -- <文件>`），bundle 版本回到 `0.1.0`，README 回到"路线 A＝装本地目录" |
| `docs/实施记录/09-npm壳包实施.md`、`docs/验收报告/09-npm包安装报告.md` | 🗑️ 已删除（它们记录的是不再采用的那条路） |
| npm 包 | **未发布**（本机 npm 始终未登录；未执行过 `npm publish`） |
| 仓库工作区 | 干净（无未提交改动） |

**对使用者的影响：无。** 安装路径仍是任务 08 已演练通过的那条：克隆仓库 → 插件管理器粘贴
`presets/task-planning-bundle/` 的绝对路径 → 安装 → 启用 → 重启 → 新开会话。

> 下面第 1–8 节是**裁决当时**的评估原文，保留不改（含"建议做 (d)"那一段），以便日后复核判断依据。
> 其中凡涉及"已实施"的时态描述，以本节为准。

---

---

## 0. 结论先说（一句话）

**任务书第三节的全部前提都建立在 DSH 0.1.x 的"目录型 preset + `roots` 配置"机制上，而本机跑的是 0.2.x 声明式 preset。
按原文实现（写一个含 `presets/` 目录 + 安装器的壳包）会做出一个装完不生效的包。**

**但"发布到 npm 让安装更省事"这件事在 0.2.x 上依然成立，而且比任务书设想的更简单**：
本仓库**已经有一个合法的 npm 包**（`presets/task-planning-bundle/`，包名 `dsh-task-planning-preset`），
它今天就能 `npm pack` 出一个干净的 tgz。发布它，用户只需在插件管理器的输入框里打**一个包名**，
不再需要克隆仓库、也不需要粘贴本机绝对路径。

**建议：做，但做法换成「发布既有 bundle 包」，不新建壳包。**

---

## 1. 与任务书的三处前提冲突（必须先裁决，否则后面全是白做）

| # | 任务书的写法 | 本机实际（实测） | 后果 |
|---|---|---|---|
| C1 | 「npm 包**不可能**做到装完 DSH 就认识这个模式」「只有**复制到 `.agent-presets`** 或**给 agent-presets 行配 `roots`** 两条路能生效」 | 0.2.x **不扫描任何目录**；第三方 preset 的官方落地方式是 **bundle 包 + 插件管理器安装**（`dsh.bundle.patch` 字段） | 「壳包 = 数据包 + 复制到 `.agent-presets`」这个设计**在本机完全不生效**；`.agent-presets` 那份是死数据 |
| C2 | 「`package.json` 的 `dsh` 字段**没有 preset 声明能力**，所以不写任何 `dsh` 字段（写了也没意义）」 | `dsh.bundle.patch` 在 0.2.x **正是** preset 的落地机制：补丁层 `insert` 一行 `@deepseek-ai/dsh-agent-preset` | 若照原文**去掉** `dsh.bundle.patch`，包会被插件管理器判为 `not-a-bundle`，**装不了** |
| C3 | 「用 `roots` 配置片段（需用户改 profile patch 并重启，且要重述 `default`）」 | `roots` 属于 0.1.x；0.2.x 的 registry **不接受 preset 路径** | 文档里的 `roots` 示例只能当 0.1.x 历史资料，**不能作为本包的安装指引** |

证据（均为本仓库已有留档，未新增探测）：
- `docs/调研/03-preset机制-新版.md` §A/§B/§F（0.2.x 不扫目录、声明式 preset 的 schema、旧新机制对照表）；
- `docs/实施记录/01-预设机制冲突-运行时版本不符.md`（任务 01 实测：复制到用户层后模式选择器里没有它）；
- `docs/优化提示词/执行进度.md` 第 01 行：人工 13:20 确认"新模式已出现"走的是 **A1 路线（bundle + 插件管理器）**。

> 任务书自己也写了「现实与规划冲突 → 停下来交人工裁决」（`docs/优化提示词/01-通用规范.md` 铁律 7）。
> **本文第 1 节就是这次冲突的上报**；第 5 节的建议是 AI 给出的方案，最终由人工裁决。

---

## 2. 一个关键事实：本仓库**已经有**一个合法的 npm 包

`presets/task-planning-bundle/` 的 `package.json` 满足 npm 发布的全部必要条件，而且它的文件构成刚好就是"壳包"想要的那份数据：

| 项 | 实测值 |
|---|---|
| 包名 | `dsh-task-planning-preset` |
| 版本 | `0.1.0`（发布前建议对齐项目版本，见 §4.1） |
| 名字是否被占 | **未被占用**（`npm view dsh-task-planning-preset` → `404 Not Found`） |
| 仓库根有 `package.json` 吗 | **没有**（所以 npm 包根只能是 bundle 目录，不可能把整个仓库发成一个包） |

`npm pack --dry-run` 原始输出（**实测**，本机 `E:\node.exe` / npm 11.19.0，`--cache` 指向临时目录以避开沙箱）：

```text
> npm pack --dry-run --json --cache %TEMP%\dsh-npm-cache-09
[ { "id": "dsh-task-planning-preset@0.1.0", "name": "dsh-task-planning-preset", "version": "0.1.0",
    "size": 41621, "unpackedSize": 110867, "filename": "dsh-task-planning-preset-0.1.0.tgz",
    "files": [
      { "path": "PROMPT.md",                          "size": 34920 },
      { "path": "README.md",                          "size": 10538 },
      { "path": "cordis.patch.yml",                   "size": 15900 },
      { "path": "package.json",                       "size": 460 },
      { "path": "plugins/token-estimator/index.js",   "size": 24213 },
      { "path": "skills/planning-templates/SKILL.md", "size": 24836 } ],
    "entryCount": 6, "bundled": [] } ]
```

逐条对照任务书第三节"硬性要求 2"（包内不得含个人绝对路径、`demo/_自测/`、`demo/_验收/` 等临时产物）：

| 要求 | 实测 |
|---|---|
| 无个人绝对路径 | ✅ 6 个文件全部是内容文件，且这些文件在任务 08 已过隐私门（`docs/验收报告/08-开源前泄露审计报告.md`，block 命中 0） |
| 无 `demo/_自测/`、`demo/_验收/` | ✅ 一个都没有（它们本来就在 `presets/` 之外，且已被 `.gitignore` 取消跟踪） |
| 文件清单与 git 跟踪一致 | ✅ `git ls-files presets/task-planning-bundle` 返回的就是这 6 个，**不多不少** |

**结论**：任务书要的"数据包"不用新造 —— 它已经存在，且已经打包干净。

---

## 3. 为什么这个包**不需要**任何安装器（壳包的"搬运工"逻辑已由 DSH 自己做）

任务书设想的壳包需要 `postinstall` 或安装器，是因为 0.1.x 的 preset 必须**落到某个目录**。
0.2.x 的落地方式完全不同，而且**不需要往用户 home 写任何文件**：

1. 包声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`（**已有**，`presets/task-planning-bundle/package.json:14-18`）；
2. 插件管理器把包装进 profile（`pnpm add` + 写 `dsh.profile.bundles`）——**这一步是 DSH 自己做的**；
3. 启动时 `loadProfileDirectory` 读出该 bundle 的 patch，`composeEntries` 应用到 profile 组合树
   （证据：`docs/实施记录/04-提示词接线实测.md` §2.2，`dsh-app-boot/lib/index.js:845-870`）。

因此：

- ❌ **不需要 `postinstall`** → 任务书"硬性要求 3"（写用户目录必须能跳过 + 显式告知）与"常见问题"里的
  `--ignore-scripts` 风险，**在本方案下都不存在**（因为根本不写用户目录）；
- ❌ **不需要安装器脚本**（`-DshHome` 参数化那一条落空）→ 现有的 `install.ps1` 已经在做"校验 + 打印要粘贴的路径"，
  它属于任务 08 的交付物，任务 09 **不必改它**（顶多加一句 npm 安装的提示，见 §5.3）；
- ❌ **不需要 `roots` 配置片段** → 那是 0.1.x 的机制（C3）。

**包内的 3 处 `!!js` 已经为"从 registry 安装"准备好了**：它们全部**按包名解析**，不含任何绝对路径：

```text
presets/task-planning-bundle/cordis.patch.yml:63   resolve('dsh-task-planning-preset/PROMPT.md')
presets/task-planning-bundle/cordis.patch.yml:134  resolve('dsh-task-planning-preset/package.json') → dirname + 'skills'
（插件行）                                          name: dsh-task-planning-preset/plugins/token-estimator/index.js
```

「本机 `link:` 安装」与「registry 安装」在 profile 的 `node_modules` 里都是**同一个包名的目录项**，
所以这三条路径在两种安装方式下走的是同一套解析基准（推导，未运行验证 —— 这一点在 §5.2 的本地验证里用 `npm i <tgz>` 复核）。

---

## 4. 三（+1）种形态的取舍

> 任务书要求的三种：**(a)** 纯数据包 + README 手动复制；**(b)** 数据包 + `postinstall` 自动复制；
> **(c)** 数据包 + `roots` 配置片段。**三者在 0.2.x 上都不成立**（§1），因此把 (a) 按新机制重述为 (a′)，
> 并补一个任务书没设想到的 (d)。

| 形态 | 用户步骤数 | 失败模式 | 维护成本 | 本机可行性 |
|---|---|---|---|---|
| **(a) 纯数据包 + README 指引手动复制**（任务书原文） | 3–4 步（下载 → 找到目录 → 复制到 `.agent-presets` → 重启） | **必然失败**：0.2.x 不扫目录，模式永不出现；用户会以为"包坏了" | 低，但**维护的是一个不生效的东西** | ❌ 不成立 |
| **(a′) 纯数据包 + README 指引用插件管理器装本地路径**（现状，任务 08 已交付） | **4 步**：① 克隆/下载仓库 ② 打开插件页 ③ 粘贴 `<仓库>\presets\task-planning-bundle` ④ 安装 → 启用 → 新开会话 | 路径拼错 / 用了相对路径（插件管理器**拒绝相对路径**，见下）；仓库未克隆；pnpm store 报错 | 低 | ✅ 已验证（任务 08 演练 A 段通过） |
| **(b) 数据包 + `postinstall` 自动复制** | 与 (a) 同（复制本身无效） | **双重风险**：既写用户 home（有争议行为、需告知与跳过），又**依然不生效**；且 0.2.x 的 profile 用 pnpm，`postinstall` 在 pnpm 11 下会被 `allowBuilds` 拦下（本机 `~/.npmrc` 已有 `allow-scripts=…` 白名单） | 最高（要维护脚本 + 兼容 pnpm 脚本拦截） | ❌ 不成立，且**明确不建议** |
| **(c) 数据包 + `roots` 配置片段** | 5+ 步（改 profile patch → **重述 `default`** → 重启） | 漏写 `default` → **所有模式一起消失**（旧文档 `docs/调研/01-preset机制.md` §B.4 已实测该坑）；且 0.2.x **根本不读 `roots`** | 高（每台机器手改 patch，升级会漂移） | ❌ 不成立 |
| **(d) 发布既有 bundle 包到 npm，用插件管理器按包名安装**（**新增方案**） | **2 步**：① 插件页输入 `dsh-task-planning-preset`（或 `@版本`）② 安装 → 启用 → 新开会话 | 包名打错（管理器会报 `not-found`）；registry 不通（可退镜像）；**不涉及任何本机路径** | 中：每次发版要 `npm publish` + 版本号纪律（见 §5.1） | ✅ 机制上可行（§3 + 插件管理器源码），**本地可验证部分见 §5.2** |

补充证据（插件管理器对 spec 的接受范围，**实测**：从 `app.asar` 读出的
`@deepseek-ai/dsh-plugin-manager/lib/types/install-spec.js`）：

- 接受的形式：**registry 包名（可带 `@版本`）** / `github:` 等 git 简写 / git URL / **本地绝对路径** / **`.tgz` 压缩包**（本地或 http(s)）；
- **相对路径被显式拒绝**：`throw invalid(spec, 'a local path must be absolute')` —— 这条正是 (a′) 的失败模式来源；
- registry spec 会在 `pnpm` 运行**之前**先做一次兼容性检查（peer / 版本），本地路径直接读 `package.json`，
  而 **git 与 tarball spec 必须先把包抓下来**才能判定（`README.zh.md`：「git 或 tarball spec 必须先抓取，因此在安装后才判定」）。
  → 这也是选 **(d) registry** 而不是"发个 tgz 让人下载"的理由：**失败更早、更省事**。

### 4.1 一个额外好处：(d) 能顺手修掉任务书硬性要求 4 的一个"半成品"

任务书硬性要求 4 是「发布前必须先 `npm pack` 本地验证，并把 `--dry-run` 文件清单给我确认」。
`npm pack --dry-run` 的输出就是 §2 那张表 —— **本方案下这份清单天然稳定**（6 个文件，无构建产物、无脚本、无依赖），
所以"包内容漂移"这个风险几乎为零。为了把"几乎"变成"确定"，建议补一个 `files` 白名单（见 §5.1）。

---

## 5. 建议（做，但按 (d) 做）

### 5.1 若要实施，最小改动清单（**预计只动 2 个文件**）

| # | 动作 | 文件 | 理由 |
|---|---|---|---|
| 1 | 补 `files` 白名单（`PROMPT.md` / `cordis.patch.yml` / `plugins/` / `skills/` / `README.md` / `LICENSE`） | `presets/task-planning-bundle/package.json` | 现状靠"目录里没有垃圾"成立；白名单把任务书硬性要求 2 变成**机制保证**，以后误放临时文件也不会进包 |
| 2 | 补 `repository` / `homepage` / `bugs` / `publishConfig` / `engines`（不含个人绝对路径） | 同上 | npm 页面可点回 GitHub；`engines` 让不满足 Node 版本的环境**早失败** |
| 3 | 版本号 `0.1.0` → 对齐项目（`1.0.0` 或 `1.1.0`） | 同上 | 与 `CHANGELOG.md` / GitHub Release `v1.0.0` 对齐，避免"npm 上是 0.1.0、仓库里是 1.0.0"的困惑 |
| 4 | 包内加 `LICENSE`（从仓库根复制） | `presets/task-planning-bundle/LICENSE` | npm 包应自带许可；仓库根已有 MIT |
| 5 | README 增补"路线 A′：从 npm 安装（一个包名）"，并**明确写清装完的真实步骤** | `README.zh.md` / `README.en.md` / `presets/task-planning-bundle/README.md` | 任务书硬性要求 1：**不许写"装完即可用"** |
| 6 | 实施记录 / 验收报告 / 台账 / CHANGELOG | `docs/实施记录/09-*.md`、`docs/验收报告/09-*.md`、`docs/优化提示词/执行进度.md`、`CHANGELOG.md` | 收尾四步 |

**不建议做的**：新建 `package/` 目录或第二个 `package.json`。理由：那会出现**两份内容相同的包**，
而本仓库的 3 处 `!!js`、`install.ps1`、`presets/README.md`、`README.zh.md` 全都指向 bundle 目录；
再加一份只会制造"哪份是真的"这个新坑（任务书原文"或仓库根的发布用清单"给了这个自由度，此处不用它）。

### 5.2 可机器验证的部分（AI 能做）

1. `npm pack` → 在**临时目录** `npm i <tgz>`（不进 profile，不碰用户环境，符合经验 F3 的教训）；
2. 在装好的副本上**复刻 3 处 `!!js` 的解析**，断言它们解析到**装出来的那份**（而不是仓库里那份）：
   - `resolve('dsh-task-planning-preset/PROMPT.md')` → 该副本的 `PROMPT.md`，内容与仓库逐字一致；
   - `resolve('dsh-task-planning-preset/package.json')` → `dirname + 'skills'` 存在且含 `planning-templates/SKILL.md`；
   - `dsh-task-planning-preset/plugins/token-estimator/index.js` 可被 `import()` 成功；
3. 复跑任务 02/05 留下的三支校验（bundle 校验 / 清单校验 / skill 校验）与 `node tools/privacy-scan.mjs`（block 命中 0）；
4. `npm publish --dry-run`（**不真发**）确认最终清单。

### 5.3 必须人工执行的部分（铁律 11，AI 不代填）

1. **npm 登录**：本机当前**未登录**（实测 `npm whoami` → `ENEEDAUTH`；`~/.npmrc` 里只有 `allow-scripts`，无 token）。
   登录是交互动作，**只能由使用者本人做**；
2. **真发布**：`npm publish`（需使用者确认）——按任务书要求，发布前先看 §5.2 的清单与 `--dry-run` 输出；
3. **装完是否真的出现模式**：插件页输入包名 → 安装 → 启用 → **重启桌面端** → 新开会话看选择器。
   这一步 AI 碰不到 UI，**必须人工执行并回填原始输出**（回填到 `docs/验收报告/09-npm包安装报告.md`）。

### 5.4 维护成本（诚实说）

| 项 | 成本 |
|---|---|
| 每次发版 | `npm version` + `npm publish`（约 1 分钟），但**要记得发**——否则 npm 上是旧版，用户装到旧的会以为是 bug |
| 双份真相 | npm 上的版本 vs 仓库 tag 必须人工对齐；本方案下**代码只有一份**（就是 bundle 目录），所以只有"版本号"要同步，没有内容同步 |
| 撤回/下架 | npm 允许 `npm unpublish`（有 72 小时限制）或 `npm deprecate`；**即使包被下架，路线 A（克隆仓库 + 插件管理器装本地路径）一直有效** —— 这正是任务书硬性要求 6 的答案 |

---

## 6. 任务书硬性要求 6 的直接回答

> 「如果这个包明天被下架，用户还能不能装？」

**能。** 两条互不依赖的路径：

1. **npm 下架** → 用户改用路线 A（任务 08 已交付、已演练通过）：`git clone` 仓库 → 插件管理器里粘贴
   `presets/task-planning-bundle` 的绝对路径 → 安装。**这条路今天就在 README 里，且本机实测通过**；
2. **连 GitHub 也访问不了** → 从任何一份本地副本（zip / 他人转发的目录）走同一条"粘贴绝对路径"安装。

**不存在"只有 npm 一条路"的情况** —— 因为 npm 包只是**同一份 bundle 目录**的一个分发渠道，不是新的落地机制。

---

## 7. 遗留与不确定项（如实标注）

| # | 事项 | 状态 |
|---|---|---|
| 1 | registry 安装（`pnpm add dsh-task-planning-preset`）后，3 处 `!!js` 是否解析到**同一份**装出来的副本 | **推导**（本机只有 `link:` 安装的实测证据）；§5.2 的 `npm i <tgz>` 实验可把这条从"推导"升级为"实测" |
| 2 | 插件管理器从 registry 装**非官方 DSH 包**是否需要额外信任/构建批准 | **未实测**；本包无 `postinstall`、无依赖，理论上不触发 `pendingBuilds` |
| 3 | npm 上的包名最终叫什么（`dsh-task-planning-preset` 还是带 scope 的 `@xxx/…`） | **等人工裁决**；scoped 包必须 `--access public`（否则 402） |
| 4 | 是否真的发布 | **等人工裁决**（任务书第三节明确"发布（需我确认）"） |
| 5 | 任务 07（Demo 门）尚未完成 | 与本任务**无技术依赖**，但按 `docs/工作流程/00-总览与使用说明.md` 的任务顺序，09 排在 07/08 之后；07 的状态见 `docs/优化提示词/执行进度.md` |

---

## 8. 评估结论

> **注**：以下为裁决当时的结论原文（人工先据此裁决"实施"，随后改判"不实施"，见文首「最终裁决」）。

1. **任务书第三节的实现方案（0.1.x 壳包）在本机运行版本上不成立**，照做会产出无效包 —— 冲突已上报（§1）；
2. **但"发到 npm 省一步"这个目标在 0.2.x 上可行，而且几乎零新增代码**：发布既有的 `dsh-task-planning-bundle`；
3. **建议做法 (d)**：`npm pack` 本地验证 → 人工确认清单 → 人工登录并 `npm publish` → 人工按包名安装验收；
4. **不做 (b)（`postinstall`）**：既无效，又触碰"自动写用户 home"的争议行为，还要对付 pnpm 的脚本拦截；
5. **`roots` 那段（c）** 只作为 0.1.x 历史资料保留，**不进安装指引**。

---

## 9. 本次不实施的理由（人工裁决，2026-10-14）

人工在实施完成后改判停止，理由与影响如下（如实记录，供日后决定"要不要再捡起来"时参考）：

1. **收益有限**：npm 只省掉"克隆仓库 + 粘贴绝对路径"这一步；**安装 → 启用 → 重启 → 新开会话**这几步一步都省不掉
   （见 §3）。而代价是长期维护负担（§5.4：每次改 bundle 都要记得发版，否则 npm 用户装到旧版）。
2. **多一条会漂移的真相**：npm 上的版本 vs 仓库里的文件必须人工对齐；本项目已有 GitHub Release + tag 这条线。
3. **本任务的定位本来就是可选**：任务书自己写了"可以跳过这个任务，不影响任何已交付能力"，
   且"只有当使用者群体确实习惯 npm、且你愿意长期维护发布流程时才值得"。
4. **能力零损失**：安装路径仍是任务 08 已演练通过的"装本地目录"（`docs/验收报告/08-安装演练报告.md`）。

**结论：本任务关闭，状态记为「⏸️ 不做（可选任务，人工裁决）」。**
若将来重新考虑，本文 §5.1 的最小改动清单与 §5.2 的机器验证方法可直接复用 ——
机器侧曾完整跑通一次：`npm pack` 出 7 个文件 / 43466 B，与仓库源逐文件 sha256 一致，
隔离站点复刻 3 处 `!!js` 解析 **PASS 16 / FAIL 0**（原始输出随实施产物一并回滚，方法见 §5.2）。
