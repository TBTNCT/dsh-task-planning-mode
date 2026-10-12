# dsh-task-planning-mode

> 给 **DeepSeek Harness（DSH）** 加一个「任务规划」模式：
> **先把你要的效果问清楚，再拆成可以一段一段执行的规划与提示词。** 它自己不动手实现。

**语言 / Language**：**中文** · [English](README.en.md)

📖 **完整说明看 [README.zh.md](README.zh.md)** —— 安装（两条路线）、使用流程、产出示例、兼容性与已知限制、安全提示、许可。
英文版：[README.en.md](README.en.md)。

---

## 30 秒上手

| 步骤 | 做什么 |
|---|---|
| 1. 装 | DSH 0.2.x：桌面端 →「插件」→「添加插件」→ 粘贴 `presets/task-planning-bundle/` 的绝对路径 → 安装 → 立即启用。详见 [README.zh.md](README.zh.md) 第三节 |
| 2. 用 | 新开会话 → 模式选择器选「**任务规划**」→ 直接说你的想法 → 回答它的提问 → 说「**停，开始规划**」 |
| 3. 做 | 按产出里的 `docs/工作流程/00-总览与使用说明.md`，**一个任务一个新对话**，整段复制每个任务文件第三节的提示词 |

辅助脚本：`install.ps1`（校验环境 + 打印要粘贴的路径）、`uninstall.ps1`（卸载用户层副本，支持 `-WhatIf`）。

## 它不是什么

- ❌ 不执行实现（不写业务代码、不装依赖、不改你的项目文件）——实现留给**标准模式**
- ❌ 不生成复杂美术（立绘 / 场景 / 动画）
- ❌ 不能携带浏览器 UI（**推导，未做运行时验证**）
- ❌ 不是"一条命令装完"

## 产出长什么样

本仓库自带一个用它真跑出来的 Demo：[`demo/shelter-idle/`](demo/shelter-idle/)（末日避难所挂机）。
直接看 [`demo/shelter-idle/docs/工作流程/00-总览与使用说明.md`](demo/shelter-idle/docs/工作流程/00-总览与使用说明.md)。

---

## 当前状态

| 阶段 | 状态 |
|---|---|
| 需求澄清与规划（`docs/`） | ✅ 已完成 |
| 01 仓库地基与预设骨架 | ✅ 完成 |
| 02 工具集接线与实测 | ✅ 完成 |
| 03 token 估算器插件 | ✅ 完成 |
| 04 模式系统提示词正文 | ✅ 完成 |
| 05 文档格式模板与首次自测 | ✅ 完成 |
| 06 硬性约束验收与偏差修复（门） | ✅ 完成 |
| 07 Demo · 末日避难所挂机（门） | ⬜ 未开始 |
| 08 开源化与发布 | ✅ 完成（已发布：<https://github.com/TBTNCT/dsh-task-planning-mode> · `v1.0.0` Release） |
| 09（可选）npm 壳包 | ⬜ 未开始 |

进度以 [`docs/优化提示词/执行进度.md`](docs/优化提示词/执行进度.md) 为准。

## 从哪开始读

| 想干什么 | 打开 |
|---|---|
| **装来用**（使用者） | [`README.zh.md`](README.zh.md) |
| 了解整个开发流程、任务顺序与依赖 | [`docs/工作流程/00-总览与使用说明.md`](docs/工作流程/00-总览与使用说明.md) |
| 开工前必读的公共约束（铁律） | [`docs/优化提示词/01-通用规范.md`](docs/优化提示词/01-通用规范.md) |
| **开源前必读：个人信息零泄露规范** | [`docs/优化提示词/02-开源前隐私规范.md`](docs/优化提示词/02-开源前隐私规范.md) |
| 插件提示词（优先级最高） | [`docs/优化提示词/00-插件提示词-token估算器.md`](docs/优化提示词/00-插件提示词-token估算器.md) |
| 为什么能这么做（机制证据） | [`docs/调研/03-preset机制-新版.md`](docs/调研/03-preset机制-新版.md) |
| 文档格式规范从哪来 | [`docs/调研/04-规划文档格式.md`](docs/调研/04-规划文档格式.md) |
| 版本变更 | [`CHANGELOG.md`](CHANGELOG.md) |

## 目录结构

```text
presets/task-planning-bundle/  模式本体（0.2.x 交付物：cordis.patch.yml + PROMPT.md + plugins/ + skills/）
presets/task-planning/         0.1.x 旧机制留档（本机不生效，仅作对照）
tools/                         开源前隐私门禁（privacy-scan / privacy-sanitize / privacy-check）
install.ps1 / uninstall.ps1    安装与卸载脚本（不含任何个人绝对路径）
docs/工作流程/                 总览与每个任务的规划 + 可复制提示词
docs/优化提示词/               插件提示词（00）+ 通用规范（01）+ 开源前隐私规范（02）+ 执行进度台账
docs/调研/                     本机实测的机制调研报告（一手证据，含 file:line）
docs/验收报告/                 各任务的验收报告
docs/实施记录/                 原始证据留档（命令输出、探测结论、接线记录）
docs/经验/                     实战失误清单（现象 → 证据 → 根因 → 教训 → 对模式的约束建议）
demo/shelter-idle/             正式 Demo（模式跑出来的样例）
demo/_自测*/、demo/_验收/       内部验证产物：**不随仓库发布**（已 .gitignore，见 02-开源前隐私规范）
```

## 安全提示

- **preset 的信任等级等价于 shell 访问**：装一个 preset = 允许它在你机器上组装任意工具组合。**只装可信来源。**
- 本 bundle 自带 **1 个本地 JS 文件**（`plugins/token-estimator/index.js`，零第三方依赖，只用 `node:` 内置模块），装前建议自己读一遍。

## 许可

**MIT License** —— 可自由使用、修改、商用、再许可、售卖，唯一要求是保留版权声明与许可声明。
详见 [`LICENSE`](LICENSE)：`Copyright (c) 2026 这里有只小西琳`。

---

*本仓库的规划文档（`docs/`）与模式本体（`presets/task-planning-bundle/`）均已完成并通过硬约束验收；
当前处于「开源化与发布」阶段（任务 08）。*
