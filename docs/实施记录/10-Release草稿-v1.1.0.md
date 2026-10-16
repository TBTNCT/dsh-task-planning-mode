# v1.1.0 · 删除「单任务 2 亿 token」限额标准

> 本文件是 Release 正文草稿（仓库惯例：每版 Release 留一份成文，见 `07-Release草稿-v1.0.0.md`）。

**只删标准，不加功能。** 原来 `estimate_tokens` 判断两个阈值（单对话 6000 万 / 单任务 2 亿），
现在只剩**「单对话 6000 万」**一个。

---

## 本版内容

- **插件** `presets/task-planning-bundle/plugins/token-estimator/index.js`
  - 删掉 `TASK_LIMIT = 200_000_000` 常量、`triggers.taskLimit` 字段与相关判定文案；工具描述同步改。
  - ⚠️ **返回值里不再有 `taskLimit`**：若你有脚本读过这个字段，需要一起改。
- **系统提示词** `presets/task-planning-bundle/PROMPT.md`
  - 硬约束 ③、§七.2 三列结论、§七.7 样例表、§十五.3 去掉 2 亿口径。
  - §八 删掉「单次对话预估 > 2 亿 token → 必须告知并取得确认」整条。
  - §八.3「小项目主动说明」的判定改用「**可在一个对话内完成**」（不再引用两亿）。
  - §八 因删条重编号：估算表落盘 §八.6 → **§八.5**、拒绝立项 §八.7 → **§八.6**（正文互引同步改）。
  - 哨兵 `v8 → v9`。
- **文档**：`README.zh.md` / `README.en.md` 的「token 估算表」一行；
  `docs/优化提示词/00-插件提示词-token估算器.md` 的接口契约（含一行变更注记）。

**没动的**：6000 万阈值与「估算表必须落盘」要求保持不变；历史记录（`docs/实施记录/`、`docs/验收报告/`、
`docs/经验/`、`docs/工作流程/` 任务书）按当时口径保留，不追改。

---

## 升级（DSH 0.2.x，实测路径）

1. DSH 桌面端 → 左侧栏 **插件** → 卸载旧版「任务规划」（若直接重装覆盖亦可）
2. **添加插件** → 粘贴本仓库 `presets/task-planning-bundle` 的**绝对路径** → **安装** → **立即启用**
3. **完全重启桌面端**
4. 新开会话 → 模式选择器选「**任务规划**」→ 问「当前哨兵值是多少」，
   应逐字回答 `<!-- PROMPT-SENTINEL: v9 -->`

> 回答 `v8` 说明 persona 没重新读 `PROMPT.md`：确认补丁文件被「触碰」过再重启，
> 排错步骤见 `presets/task-planning-bundle/README.md`。
> 安装报 `ERR_PNPM_UNEXPECTED_STORE` 的修法也在同一份 README。

---

## 验证（发布者已跑）

| 项 | 结果 |
|---|---|
| `node --check plugins/token-estimator/index.js` | 通过 |
| 三组输入实跑 `estimate_tokens`（常规 / 超大需求 / 空 scale） | 返回**不含 `taskLimit`**；对声明输出 schema 校验通过 ×3 |
| `cordis.patch.yml` 解析 | 通过；与改前**结构逐字等价**（16 行插件 id 完整） |
| 隐私门 `node tools/privacy-scan.mjs` | **block 命中 0**（warn 759 处均为既有机器布局路径，未新增） |
| 把远端克隆回来复扫 | block 命中 **0**；`PROMPT.md` 首行哨兵 = `v9`；提交作者只剩中性身份 |
| 本次改动新增行专项审计 | block 0 / warn 0 / 无任何盘符路径 |

> **发布过程中的一次自伤命中（如实记录）**：本版发布记录的初稿里，把「家目录写法」那个字面量原样抄进了
> `CHANGELOG.md`，复扫时门禁又报了 1 处 —— 属于**记录文字自己引入**的命中。已改写为不带盘符的写法，
> 并用 `git commit --amend` + `git push --force-with-lease` 修正，tag 同步重建。细节见 `CHANGELOG.md`
> 的 `[1.1.0]` 发布记录。**教训：写发布记录时不要抄敏感字面量。**

---

## 许可

**MIT License** —— 可自由使用、修改、商用、再许可、售卖，唯一要求是保留版权声明与许可声明。

```
Copyright (c) 2026 这里有只小西琳
```

---

> 发布命令（由使用者本人执行，需先 `gh auth login`）：
> ```powershell
> gh release create v1.1.0 --title "v1.1.0 · 删除 2 亿 token 限额标准" --notes-file docs/实施记录/10-Release草稿-v1.1.0.md
> ```
