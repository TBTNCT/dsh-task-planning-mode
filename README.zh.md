# 「任务规划」模式 · DSH 插件

> 给 **DeepSeek Harness（DSH）** 加一个模式：**把「我想要的效果」问清楚，然后拆成可以一段一段执行的规划与提示词。**
> 它自己不动手实现——实现留给标准模式。

**语言**：[中文](README.zh.md) · [English](README.en.md)

---

## 一、这是什么，解决什么问题

面向**完全不了解目标行业、但明确知道自己想要什么效果**的人。

你脑子里有个想法（"我想做个挂机游戏""我想做个记账小工具"），但你说不出它该分成几步做、
第一步该写什么、要装什么工具、大概要花多少 token。于是你只能对着 AI 说一句"帮我做出来"，
然后拿到一堆互相矛盾的代码。

这个模式只做一件事：**先把你问清楚，再给你一份可以照着执行的施工图。**

它给你的东西：

| 产出 | 是什么 |
|---|---|
| 需求确认书 | 复述一遍"我理解你要做的"，让你在动手前先确认没跑偏 |
| `docs/工作流程/` 任务文件 | 每个任务一个文件，内含**可以整段复制**的提示词；一个任务 = 一次新对话 |
| `docs/优化提示词/01-通用规范.md` | 你这个项目自己的铁律，每个任务开工前必读 |
| `docs/优化提示词/执行进度.md` | 跨会话的唯一状态真相：做到哪、提交哈希、关键数据 |
| token 估算表 | 每个任务给低-高区间 + 是否触发 6000 万 / 2 亿阈值 |
| 使用顺序 | "先做哪个、后做哪个"，每条都带工作区内相对路径 |

---

## 二、它**不是**什么（先说清楚，省得白装）

- ❌ **不执行实现**。它不写业务代码、不装依赖、不改你项目里的任何文件——只写"规划与提示词"。
  实现要在**标准模式**的新对话里做。
- ❌ **不生成复杂美术**。立绘、场景图、动画、特效一律不承诺；要么你自己提供素材，要么降级成占位符（纯色块/文字标签）。
- ❌ **不能替你决定要什么**。它负责问对问题，答案得你给。
- ❌ **不能携带浏览器 UI**（**推导，未做运行时验证**：DSH 的 preset 机制只能给 agent 加工具/提示词/skill，
  加浏览器界面要另做一个客户端包并挂到宿主组合里）。
- ❌ **不是"一条命令装完"**。见下面的安装说明。

---

## 三、安装

> 安装前先看：**preset 的信任等级等价于 shell 访问**。装一个 preset = 允许它在你机器上组装任意工具组合。
> **只装你信任的来源。**

### 路线 A（推荐，本机实测可用）：用插件管理器装 bundle 包

适用 **DSH 0.2.x**（本机桌面端实测版本：宿主 `@deepseek-ai/dsh-desktop 0.2.0-rc.2`，
asar 内 `@deepseek-ai/dsh-web-app@0.2.1-alpha.1`）。本模式以 **bundle 包**形式分发。

在 DSH **桌面端**里：

1. 左侧栏点 **插件**。
2. 点 **添加插件**（或箭头菜单里的 **安装第三方插件**）。
3. 在包名输入框里粘贴**本仓库 `presets/task-planning-bundle/` 目录的绝对路径**。
   （对话框接受"包名（可带版本）、Git 地址、压缩包或本地绝对路径"，本地路径会直接读该目录的 `package.json`。）
4. 等界面读出包名 `dsh-task-planning-preset` 与版本号，点 **安装**，等 pnpm 跑完。
5. 点 **立即启用**（或回插件列表打开该组合包的开关）。
6. **新开一个会话**，模式选择器里应出现「**任务规划**」。

**用脚本做前置校验**（不会替你点界面，只检查环境并把要粘贴的路径打印出来）：

> ⚠️ **本节所有 `powershell -File` 命令都要在「仓库根目录」下运行。**
> `-File` 的相对路径是按**当前工作目录**解析的，不在仓库根会直接报
> 「`-File` 形式参数的实际参数 "install.ps1" 不存在」。先 `cd` 到本仓库根目录，或者用脚本的**绝对路径**。

```powershell
cd <本仓库根目录>
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**没出现怎么办**：先重启桌面端再新开会话（组合变更通常要重启才加载）；若插件页显示「加载失败」，
把报错原文抄下来再排查。安装报 `ERR_PNPM_UNEXPECTED_STORE` 的修法见
[`presets/task-planning-bundle/README.md`](presets/task-planning-bundle/README.md) 第二节。

### 路线 B（DSH 0.1.x 旧机制）：复制目录到用户层

> ⚠️ **本机实测：这条路在 DSH 0.2.x 上无效。** 0.2.x 的 preset 注册表**不扫描任何目录**，
> 复制过去的那份是死数据，永远不会出现在模式选择器里（证据：`docs/实施记录/01-预设机制冲突-运行时版本不符.md`）。
> 只有 0.1.x 需要这条。

```powershell
# 先 cd 到本仓库根目录（-File 的相对路径按当前目录解析）
cd <本仓库根目录>
# 把仓库里的旧机制目录复制到 DSH 用户层预设根
powershell -ExecutionPolicy Bypass -File .\install.ps1 -LegacyCopy
```

手动等价写法（Windows PowerShell）：

```powershell
$src = ".\presets\task-planning"
$dst = Join-Path $env:USERPROFILE ".dsh\.agent-presets\task-planning"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
Copy-Item -LiteralPath $src -Destination (Split-Path -Parent $dst) -Recurse -Force
```

目录名只能用**小写字母、数字、连字符**；`agent.cordis.yml` 顶层必须是**数组**。改完**新开会话**才生效。

#### 0.1.x 进阶：给 `agent-presets` 行配置 `roots`

在 profile 的 `cordis.patch.yml` 里给 `agent-presets` 那一行加 `roots: [{ path: <包内 presets 目录> }]`，
装一次就能跟随包更新。

> ⚠️ **必须重述 `default`**：按 id 的 patch 是**整段替换**，不是深合并。只写 `roots` 会把原来的
> `default: standard` 冲掉，结果是**所有模式一起消失**。
>
> **改错了怎么回滚**：把那一行的 `config` 改回原来的完整内容（至少要有 `default: standard`），
> 或者直接把 `cordis.patch.yml` 恢复成改动前的备份，然后**重启 DSH**。
> 0.1.x 的 `roots` 机制在 0.2.x 上**已不适用**（实测结论，见 `docs/调研/03-preset机制-新版.md`）。

### 卸载

```powershell
# 先 cd 到本仓库根目录（-File 的相对路径按当前目录解析）
cd <本仓库根目录>

# 只看看会删什么（不真删）
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -WhatIf

# 删掉用户层副本（先打印路径，再确认，最后才删）
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

用插件管理器装的 bundle 包，要在**桌面端 →「插件」→ 该组合包卡片 → 卸载**（这一步会改 profile，脚本不代做）。

---

## 四、怎么用（一次完整流程）

1. **新开一个会话**，在模式选择器里选「**任务规划**」。
2. **直接把你的想法说出来**，不用组织语言，也不用懂行话。
3. **回答它的提问**。它会用 `ask_user_question` 工具一次问 3–10 题，每题带选项和利弊；
   最多 6 轮，把 9 项需求清单填满。
4. 当你觉得"够了"，**说「停，开始规划」**（或"就这样，开始吧"）。
5. 它会先给你一份**需求确认书**，你确认后产出规划文件。
6. 拿到产出后：**打开 `docs/工作流程/00-总览与使用说明.md`，按它的顺序，一个任务一个新对话**去做。
   每个任务文件第三节的提示词，整段复制到新对话即可。

> 两条最容易被忽略的规矩：
> ① **一个任务 = 一次新对话**（上下文干净，结论稳定）；
> ② **每次新对话第一步是把工作区设成你的项目目录**（这样 AI 能自己读到 `docs/`，不用你手动拖文件）。

---

## 五、产出长什么样

本仓库自带一个**用它真跑出来的 Demo**：[`demo/shelter-idle/`](demo/shelter-idle/)（末日避难所挂机小游戏）。

可以直接看它的产出：

- [`demo/shelter-idle/docs/工作流程/00-总览与使用说明.md`](demo/shelter-idle/docs/工作流程/00-总览与使用说明.md) —— 总览与使用顺序
- [`demo/shelter-idle/docs/工作流程/01-游戏骨架与一天循环.md`](demo/shelter-idle/docs/工作流程/01-游戏骨架与一天循环.md) —— 一个任务文件（含可复制的提示词）
- [`demo/shelter-idle/docs/优化提示词/01-通用规范.md`](demo/shelter-idle/docs/优化提示词/01-通用规范.md) —— 该项目自己的铁律
- [`demo/shelter-idle/docs/优化提示词/执行进度.md`](demo/shelter-idle/docs/优化提示词/执行进度.md) —— 执行进度台账

> `demo/_自测/`、`demo/_验收/`、`notepad-app/` 是**内部验证产物**，已列入 `.gitignore`、不随仓库发布。

---

## 六、兼容性与实测环境

| 项 | 值 |
|---|---|
| DSH 桌面端宿主 | `@deepseek-ai/dsh-desktop 0.2.0-rc.2`；asar 内 `@deepseek-ai/dsh-web-app@0.2.1-alpha.1` |
| profile 依赖树 | `@deepseek-ai/* 0.1.5-rc.2`（本机 desktop profile 实测） |
| 操作系统 | Windows（Windows PowerShell **5.1**，不是 7） |
| Node.js | v24.20.0 |
| 实测方式 | 装进 desktop profile → 重启桌面端 → 新开会话 → 模式选择器出现「任务规划」→ 模式内工具逐个实测 |

**未在 macOS / Linux 实测。** 本模式依赖的 shell 工具行按平台二选一（`tool-pwsh` / `tool-bash`），
理论上跨平台可用，但**没有实测过**，请按"未验证"对待。

---

## 七、已知限制

1. **不能携带浏览器 UI**——**推导，未做运行时验证**（见第二节）。
2. **用户自建 preset 在模式列表里的精确排序语义是推导**，未在本机枚举验证；
   本模式给自己设了 `order: 5`。
3. **装完通常要重启桌面端**才在模式选择器里出现（是否启用 HMR 未实测）。
4. **升级要手动**：插件安装后暂不支持自动更新，升级需先卸载再装新版。
5. 模式提示词体积偏大（`PROMPT.md` 14691 字符 / 8664 汉字），**每个请求都要加载**；精简列入后续版本。
6. **本模式只做规划**。想让它直接实现，它只会拒绝你——这是设计，不是 bug。

---

## 八、安全提示（重要，别跳过）

- **preset 的信任等级等价于 shell 访问。** 一个 preset 就是一份"组装"：它可以挂载任意工具、
  注入任意系统提示词、随包携带任意本地代码。**从不可信来源拿 preset，等于让对方在你机器上执行任意组合。**
- 本仓库的 bundle 包**自带 1 个本地 JS 文件**（`plugins/token-estimator/index.js`，token 估算器），
  纯 ESM、**零第三方依赖**、只 import `node:` 内置模块。**装之前建议自己读一遍**（530 行，中文注释）。
- 本模式**不会**写你工作区之外的文件；产物边界写死在提示词的硬约束 ⑪ 里。
- **开源前隐私门**：本仓库附带一套隐私/凭据扫描工具（`tools/privacy-*`），
  规范见 [`docs/优化提示词/02-开源前隐私规范.md`](docs/优化提示词/02-开源前隐私规范.md)。
  这条规范也是模式硬约束 ⑫：**用它规划的项目只要要开源，开源前必须保证个人信息零泄露。**

---

## 九、许可与致谢

**MIT License** —— 可以自由使用、修改、商用、再许可、售卖，唯一要求是保留版权声明与许可声明。
详见 [`LICENSE`](LICENSE)。

```
Copyright (c) 2026 这里有只小西琳
```

> 署名形态说明：本项目采用**个人署名（笔名）**。开源规范允许署名，也允许不署名——
> 见 [`docs/优化提示词/02-开源前隐私规范.md`](docs/优化提示词/02-开源前隐私规范.md) §一：
> **个人签名允许但不强制**。

致谢：

- 感谢 **DeepSeek Harness（DSH）** 提供 preset 机制与插件工具链。
- 本项目的机制结论全部来自本机解包源码的实测，证据留档在 [`docs/调研/`](docs/调研/)。
- `demo/shelter-idle/` 的规划文档格式参考了公开的规划文档实践。

---

## 十、仓库结构与文档语言

```text
presets/task-planning-bundle/   模式本体（0.2.x 交付物）：cordis.patch.yml + PROMPT.md + plugins/ + skills/
presets/task-planning/          0.1.x 旧机制留档（本机不生效，仅作对照）
tools/                          开源前隐私门禁：privacy-scan / privacy-sanitize / privacy-check
install.ps1 / uninstall.ps1     安装与卸载脚本（不含任何个人绝对路径）
docs/工作流程/                   本插件自己的开发任务书 + 总览与使用说明
docs/优化提示词/                 插件提示词（00）+ 通用规范（01）+ 开源前隐私规范（02）+ 执行进度台账
docs/调研/                       机制调研（一手证据，含 file:line）
docs/实施记录/                   原始证据留档（命令输出、探测结论、接线记录）
docs/验收报告/                   各任务的验收报告
docs/经验/                       实战失误清单（现象 → 证据 → 根因 → 教训 → 对模式的约束建议）
demo/shelter-idle/              正式 Demo：用本模式跑出来的样例
CHANGELOG.md                    版本变更
```

**文档语言：中文为主，附英文对照 README。** `docs/` 下的规划与调研文档全部是中文；
`presets/task-planning-bundle/PROMPT.md`（模式系统提示词）也是中文——它面向中文使用者。

---

*本项目的开发过程本身就是"任务规划"模式的一次实践：`docs/` 里那套任务书，就是这个模式规划出来的。*
