# 任务 09 验收报告 · npm 壳包（可选）

> 任务文件：`docs/工作流程/09-可选-npm壳包.md`
> 执行时间：2026-10-14
> 状态：⚠️ **机器侧全部完成；发布与"装完模式出现"待人工执行**（见 §六）
> 配套：`docs/实施记录/09-npm壳包评估.md`（评估）、`docs/实施记录/09-npm壳包实施.md`（命令与原始输出）

---

## 一、做了什么

**偏离计划之处（先说，因为它决定本任务的形态）**：任务书第三节的实现方案建立在 DSH **0.1.x** 的
"目录型 preset + `roots` 配置"上（"npm 包只是搬运工：复制目录到 `.agent-presets`"），
而本机跑的是 **0.2.x 声明式 preset**（bundle 补丁 + 插件管理器）。照原文实现会做出一个**装完不生效**的包。
因此按人工裁决（2026-10-14）**改走方案 (d)：发布既有的 bundle 包**，不新建 `package/` 壳包。
三处前提冲突的逐条对照见 `docs/实施记录/09-npm壳包评估.md` §1。

| # | 文件 | 动作 | 一句话作用 |
|---|---|---|---|
| 1 | `presets/task-planning-bundle/package.json` | 改 | `version` → `1.0.0`；加 `files` 白名单 + `repository`/`homepage`/`bugs` + `publishConfig.access: public`；**保留** `dsh.bundle.patch` |
| 2 | `presets/task-planning-bundle/LICENSE` | **新增** | MIT，与仓库根逐字一致（sha256 相同），让 npm 包自带许可 |
| 3 | `README.zh.md` | 改 | 安装章节重排为 A（npm）/ B（本地目录）/ C（0.1.x 旧机制）；新增"npm 包被下架后仍可装"；目录树补 `LICENSE` |
| 4 | `README.en.md` | 改 | 同上（英文对照） |
| 5 | `presets/task-planning-bundle/README.md` | 改 | 文件清单 + `files` 白名单说明；安装拆"路线 1 npm / 路线 2 本地目录"；更新说明补 npm 版本维护负担 |
| 6 | `presets/README.md` | 改 | 文件清单补 `LICENSE`，注明本目录＝ npm 包全部内容 |
| 7 | `docs/实施记录/09-npm壳包评估.md` | **新增** | 评估（任务书第一步）：三处前提冲突 + 三形态取舍 + 明确建议 |
| 8 | `docs/实施记录/09-npm壳包实施.md` | **新增** | 原始证据留档（命令 + 原始输出 + 人工步骤） |
| 9 | `docs/验收报告/09-npm包安装报告.md` | **新增** | 本文件 |
| 10 | `docs/优化提示词/执行进度.md`、`CHANGELOG.md` | 改 | 收尾四步 |

**未动**（范围围栏，铁律 1）：`install.ps1` / `uninstall.ps1`、`presets/task-planning/`（0.1.x 留档）、
`PROMPT.md`、`cordis.patch.yml`、`plugins/`、`skills/`、`tools/`。

---

## 二、验证结果

任务书第四节 5 条验收标准，逐条：

| # | 验收标准（抄任务文件） | 结果 | 证据 |
|---|---|---|---|
| 1 | `docs/实施记录/09-npm壳包评估.md` 存在，含三形态取舍与明确建议 | ✅ | 文件已落盘；§4 是"三形态 + 新增 (d)"的对照表（用户步骤数 / 失败模式 / 维护成本 / 本机可行性）；§8 是明确结论（建议做 (d)、不做 (b)） |
| 2 | 若实现：`npm pack` 产物在临时目录安装成功，**模式出现** | ⚠️ **机器侧 ✅ / 运行侧待人工** | **机器侧**：`npm pack` 出 `dsh-task-planning-preset-1.0.0.tgz`（43466 B，sha256 `AD0D…F7199`），解到隔离站点 `node_modules/dsh-task-planning-preset`，**PASS 16 / FAIL 0** —— 7 个文件与仓库源逐文件 sha256 一致；3 处 `!!js`（persona `PROMPT.md`、`customSkillDirs`、token-estimator 子路径 import）**全部解析到装出来的那份副本**，`PROMPT.md` 读到 14691 字符与仓库源逐字一致（`docs/实施记录/09-npm壳包实施.md` §4）。**运行侧**：发布 + 插件页安装 + 重启 + 新开会话，**必须人工**（铁律 11），步骤见 §六 |
| 3 | README 未出现"装完即可用"这类不实描述 | ✅ | 三份 README 均改为"路线 A/B/C"，并显式写"**装完不是'就完事了'**：省掉的只是克隆仓库 + 粘贴本机路径，安装→启用→重启→新开会话一步都少不了"（`README.zh.md` §三 路线 A 后注、`README.en.md` §3 Route A 后注、`presets/task-planning-bundle/README.md` §二）。全文检索"装完即可用"命中 0 |
| 4 | 包内无个人绝对路径与临时产物 | ✅ | `npm pack --dry-run` 终态清单 **7 项**：`LICENSE` / `PROMPT.md` / `README.md` / `cordis.patch.yml` / `package.json` / `plugins/token-estimator/index.js` / `skills/planning-templates/SKILL.md`；与 `git ls-files presets/task-planning-bundle` 一致（除新增 LICENSE）；无 `demo/`、无 `.tmp-*`；隐私门 block 命中 **0** |
| 5 | 发布前已把 `--dry-run` 清单交给使用者确认 | ⏳ **待人工确认** | 清单原文在 `docs/实施记录/09-npm壳包实施.md` §3（含 `shasum` / `integrity` / 每文件字节数）；**发布动作尚未执行**（本机 `npm whoami` → `ENEEDAUTH`），需使用者看过清单后自己 `npm login` + `npm publish` |

任务书第三节"硬性要求"逐条：

| # | 要求 | 结果 | 证据 |
|---|---|---|---|
| 1 | 不许宣称"装完即可用"，README 必须写真实步骤 | ✅ | 见上表第 3 行；README 明确列出"安装 → 启用 → **重启桌面端** → 新开会话"四步 |
| 2 | 包内不得含个人绝对路径、`demo/_自测/`、`demo/_验收/` | ✅ | 见上表第 4 行 |
| 3 | `postinstall` 若写用户目录，必须有跳过方式与显式告知 | ✅ **不适用（且是本次的关键结论）** | 本方案**没有 `postinstall`、不写任何用户目录**：0.2.x 的落地由插件管理器完成（`pnpm add` + 写 profile 的 `dsh.profile.bundles`），包本身不碰用户 home。评估文档 §3 说明为何"搬运工"逻辑已由 DSH 自己承担；§5.1 明确"不做 (b)" |
| 4 | 发布前必须先 `npm pack` 本地验证，并把 `--dry-run` 清单给使用者确认 | ⏳ 半完成 | 本地验证已完成（上表第 2 行机器侧）；清单已落盘（实施记录 §3）；**"交给使用者确认"这一步正由本报告完成，发布需人工点头** |
| 5 | 中文文档 + 英文 README 摘要；提交信息 `[任务09] npm壳包` | ✅ | 新增/修改的中文文档齐备；`README.en.md` 同步更新（英文摘要）；提交信息见 §三 提交哈希 |
| 6 | 最后告诉我：包明天被下架，用户还能不能装 | ✅ | **能。** README 新增专节（`README.zh.md` §三"如果这个 npm 包被下架了，还能装吗？"、`README.en.md` §3 同节）：npm 只是多出来的一条渠道，包内容与仓库 `presets/task-planning-bundle/` 是同一份 → 走**路线 B**（克隆仓库 + 粘贴绝对路径）；连仓库也访问不到就用任何本地副本。**不存在"只有 npm 一条路"的情况** |

---

## 三、关键数据

| 项 | 值 | 测量方式 |
|---|---|---|
| 包名 / 版本 | `dsh-task-planning-preset` / `1.0.0` | `package.json` |
| 包名是否被占用 | **未占用** | `npm view dsh-task-planning-preset version` → `404 Not Found`（发布前最后一次复核 2026-10-14） |
| 包内容 | **7 个文件**，43466 B（解包 114639 B） | `npm pack --dry-run --json` |
| tgz | `dsh-task-planning-preset-1.0.0.tgz`，sha256 `AD0D3D6D342D59C5ACB1CA504210BC7D4FC4BE28F57027A0765BC11B026F7199` | `npm pack` + `Get-FileHash` |
| 本地验证 | **PASS 16 / FAIL 0** | 隔离站点解包 + 3 处 `!!js` 复刻探针 |
| `PROMPT.md` | 14691 字符（包内与仓库源逐字一致） | 探针读取 + sha256 `4a2a4053…` |
| LICENSE 一致性 | 仓库根与包内 sha256 相同（`BD88051A…`） | `Get-FileHash` |
| 隐私门 | **block 命中 0**，warn 675（既有文档的仓库外路径，人工确认项） | `node tools/privacy-scan.mjs` → 退出码 0 |
| 本机 npm 登录状态 | **未登录**（`npm whoami` → `ENEEDAUTH`） | 原始输出见实施记录 §6.1 |

**改动的文件数**：新增 4（评估 / 实施记录 / 本报告 / `LICENSE`），修改 5（两份 README、bundle README、
`presets/README.md`、`package.json`），收尾 2（台账、CHANGELOG）。

---

## 四、遗留问题

| 问题 | 影响 | 建议处理时机 |
|---|---|---|
| **未发布**（需人工 `npm login` + `npm publish`） | README 已写"已发布"；若迟迟不发，用户按路线 A 会得到 `not-found` | 人工确认 §3 清单后立即执行 |
| **"装完模式出现"未经运行验证** | 只能证明"包内容对 + 解析路径对"，不能证明插件管理器从 registry 装完就生效 | 发布后按 §六 6.2 人工验收 |
| npm 版本与仓库版本可能漂移 | 改完文件忘了发版，npm 用户装到旧版 | 长期：每次发版走 CHANGELOG + `npm publish`（评估文档 §5.4） |
| `files` 白名单需人工同步 | 以后往 bundle 加文件却忘了加白名单 → npm 用户缺文件，本地路径用户不缺（两种安装方式内容不一致） | 下次改 bundle 时（实施记录 §7 第 2 条已写） |
| 任务 07（Demo 门）仍未完成 | 与本任务无技术依赖，但任务顺序上 09 在 07 之后 | 见台账第 07 行 |
| 隐私门 warn 675 处（仓库外绝对路径） | 门禁只卡 block；warn 属人工确认项，本次未新增 | 下一次开源前审计 |

---

## 五、给下一个任务的注意事项

1. **`dsh.bundle.patch` 不能删** —— 任务书原文"不写任何 `dsh` 字段"是 0.1.x 的结论，0.2.x 里它是 preset 的落地机制。
2. **npm 包根 = `presets/task-planning-bundle/`**，不是仓库根（仓库根**没有** `package.json`，也不该有）。
3. **`files` 白名单是包内容的唯一真相**；加文件必须同步加白名单。
4. **本机 npm 未登录**；发布是交互动作，AI 不代做（铁律 11）。
5. **`.ps1` 仍是 UTF-8 with BOM**（本任务未改脚本，别顺手"修"）。
6. **沙箱注意**：本机文件沙箱下子进程不能用管道捕获输出（`spawn EPERM`），
   且 `privacy-scan.mjs` 需要子进程调用 `git`；本次是在放宽沙箱（danger-full-access）下跑通的。
   这属于环境限制，不是脚本缺陷。

---

## 六、人工判定（由人填写）

### 6.1 待人工执行的两段（AI 不代填，铁律 11）

**A 段 · 发布**（先看 `docs/实施记录/09-npm壳包实施.md` §3 的 `--dry-run` 清单）

```powershell
npm login                                                     # 交互，只有你能做
npm view dsh-task-planning-preset version 2>&1                # 预期 404（未占用）
cd <仓库根>
npm publish .\presets\task-planning-bundle                    # 预期末尾：+ dsh-task-planning-preset@1.0.0
npm view dsh-task-planning-preset version                     # 预期：1.0.0
```

回填栏（原文照抄）：

```text
npm login 结果：
npm publish 输出：
npm view 输出：
执行人：           执行时间：
```

**B 段 · 安装验收**

```text
1) 桌面端 → 插件 → 添加插件 → 输入 dsh-task-planning-preset → 安装 → 立即启用
2) 重启桌面端
3) 新开会话 → 模式选择器里有没有「任务规划」？
4) 切进去问一句"你是什么模式"，看它是否先提问（本模式的开场行为）
```

回填栏（原文照抄，含任何红标/报错原文）：

```text
安装是否成功：
是否重启：
模式选择器是否出现「任务规划」：
是否有「加载失败」红标：
模式内首轮回复原文（截断到关键几行）：
执行人：           执行时间：
```

### 6.2 判定

- 判定：⬜ 通过 / ⬜ 返工
- 返工原因：
