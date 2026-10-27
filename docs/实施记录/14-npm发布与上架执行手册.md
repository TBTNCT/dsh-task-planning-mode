# 实施记录 14：npm 发布与市场上架（PowerShell 执行版）

> 日期：2026-10-27
> 触发：使用者问「缺的三个字段怎么解决」+「要用 PowerShell 执行，先检查本机版本」。
> 本文只记录**已实测的事实**与**待人工执行的命令**，不代替任何人工步骤的结果。

---

## 一、本机环境（实测）

| 项 | 值 | 取法 |
|---|---|---|
| PowerShell | **5.1.26100.9711（Desktop 版）** | `$PSVersionTable.PSVersion.ToString()` |
| powershell.exe | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` | `Get-Command powershell` |
| Node | v24.20.0 | `node --version` |
| npm | 11.19.0 | `npm --version` |
| npm 入口 | `E:\npm.ps1` | `Get-Command npm` |
| npm registry | `https://registry.npmjs.org/` | `npm config get registry` |
| 用户 .npmrc | 存在 | `Test-Path $env:USERPROFILE\.npmrc` |

> **PS 5.1 的两个已知坑**（本仓库铁律 8 已记录）：
> ① 脚本文件必须存成 **UTF-8 with BOM**，否则中文按 GBK 解码会语法错误；
> ② 需要无 BOM 写文件时用 `[System.IO.File]::WriteAllText(...)`。本文给出的命令都是**单行/少量命令**，可直接粘贴进控制台，不涉及脚本文件编码问题。

---

## 二、三个缺失字段怎么解决的（已改完并实测）

### 2.1 改了什么

`presets/task-planning-bundle/package.json`：

| 字段 | 改前 | 改后 | 为什么 |
|---|---|---|---|
| `version` | `0.1.0` | **`1.2.0`** | 与仓库 tag `v1.2.0` / Release 对齐。npm 版本号发布后不可改不可覆盖，首版就该对齐 |
| `repository` | 无 | `{type, url, directory}` | 市场的 `scripts/probe-npm.mjs` 会核对「包 manifest 的 repository 是否指回收录仓库」，**不匹配就判定未发布**（`npm: null`）→ 下载量、npm 来源、更新检测全丢 |
| `engines.dsh` | 无 | `">=0.2.0-0 <0.3.0-0"` | 市场索引 **format 1 要求每个版本都声明**（`publishFields` 从 npm manifest 读它写进索引）。缺了就只能走纯 GitHub 来源 |
| `files` | 无 | `["PROMPT.md","cordis.patch.yml","plugins/","skills/"]` | 默认规则当前刚好只含 6 个文件，但**不稳定**；显式白名单把打包内容钉死 |

### 2.2 `engines.dsh` 为什么必须带 `-0`

`node-semver` 只有在**某个比较符与该版本 major.minor.patch 元组完全一致、且自身带预发布标签**时，
才放行预发布版本。实测（在 `<DSH_SRC>` 下用仓库自带 `semver` 跑）：

```
range= >=0.2.0-0 <0.3.0-0
  0.1.5-rc.2     -> false
  0.2.0          -> true
  0.2.1-alpha.1  -> true
  0.2.1-rc.2     -> true
  0.2.5          -> true
  0.3.0          -> false
```

本机运行时是 `app-boot@0.2.1-rc.2`（证据：`<DSH_SRC>/packages/boot/app-boot/package.json`），
所以**不能**写成 `>=0.2.0 <0.3.0`（那样 `0.2.1-rc.2` 会被静默排除，装的时候报不兼容）。

### 2.3 实测验证（全部跑过）

```
npm pack --dry-run  → files=6  size=45420  unpacked=120508
  PROMPT.md                          40045
  README.md                          10699
  cordis.patch.yml                   17405
  package.json                         767
  plugins/token-estimator/index.js   23961
  skills/planning-templates/SKILL.md 27670

npm pack（真打）    → dsh-task-planning-preset-1.2.0.tgz
隔离目录 npm install → added 1 package in 362ms
按 DSH 的解析方式复核（createRequire + baseUrl=profile 目录）：
  PROMPT.md      -> node_modules/dsh-task-planning-preset/PROMPT.md   哨兵 v10 ✅
  package.json   -> .../package.json                                  ✅
  skills/        -> .../skills/planning-templates/SKILL.md 存在 ✅
  插件行          -> 解析 OK ✅
```

**结论：包内容正确，安装后 `cordis.patch.yml` 里那两条 `!!js` 按包名解析的路径全部成立，
插件代码一行都不用改。**

---

## 三、PowerShell 执行步骤（人工）

> 以下命令**只能由使用者本人执行**（`npm login` 要浏览器授权 / 输密码，按铁律 11 不能代做）。
> 全部是 PowerShell 5.1 可直接粘贴的写法，**不要**存成 .ps1 再跑（除非存成带 BOM）。

### 第 0 步：确认环境（只读，先跑这个）

```powershell
$PSVersionTable.PSVersion.ToString()
node --version
npm --version
npm config get registry
npm whoami
```

预期：`5.1.26100.9711` / `v24.20.0` / `11.19.0` / `https://registry.npmjs.org/`。
最后一行现在报 `need auth`（**未登录**），正常，下一步解决。

### 第 1 步：登录 npm（需要你本人操作）

```powershell
npm login
```

- 会提示 `Username` / `Password` / `Email` / `Enter one-time password`（开了 2FA 才有）。
- 密码输入时**不显示字符**，正常。
- 完成后复核：`npm whoami` 应输出你的 npm 用户名。

> 国内网络若 `npm login` 超时，可临时换镜像登录不适用于发布——
> **发布必须打到官方源** `registry.npmjs.org`（镜像只读，不能 publish）。
> 若官方源连不上，先解决网络（代理），不要改 `registry` 去发布。

### 第 2 步：确认要发的包名没被占用

```powershell
npm view dsh-task-planning-preset version
```

预期 `E404`（= 没人占用，可以发）。**若这次返回了版本号，说明被别人占了，停下告诉我**，我们换 `@tbtnct/...` 的 scope 名。

### 第 3 步：发布前最后一次本地复核（只读）

```powershell
Set-Location 'D:\dsh\plugins\dsh-task-planning-mode\presets\task-planning-bundle'
npm pack --dry-run
```

预期看到 6 个文件。**若多于 6 个**，说明 `files` 白名单失效或有新文件，停下核对。

### 第 4 步：发布

```powershell
Set-Location 'D:\dsh\plugins\dsh-task-planning-mode\presets\task-planning-bundle'
npm publish --access public
```

⚠️ **必须在 `presets\task-planning-bundle` 目录里执行**（不是仓库根 —— 仓库根没有 `package.json`，
在根目录发出去的包不含 `cordis.patch.yml`，装上不生效）。

成功后打印类似：`+ dsh-task-planning-preset@1.2.0`。

### 第 5 步：发布后复核（只读）

```powershell
npm view dsh-task-planning-preset version
npm view dsh-task-planning-preset repository
npm view dsh-task-planning-preset engines
```

预期：`1.2.0` / `{ type: 'git', url: 'git+https://github.com/TBTNCT/dsh-task-planning-mode.git', directory: 'presets/task-planning-bundle' }` / `{ dsh: '>=0.2.0-0 <0.3.0-0' }`。

> **这一步最关键**：`repository` 必须能指回仓库，否则市场的 `probe-npm.mjs` 会判定未关联
> （`repoField.toLowerCase().includes(repo.toLowerCase())`）。

### 第 6 步：真机安装验证（可选但推荐）

```powershell
npm install -g npm-check-updates  # 不需要，跳过
```

装验证更简单的方式：DSH 插件页 → 添加插件 → 输入包名 `dsh-task-planning-preset` → 安装 → 重启 → 新会话问哨兵，应回 `v10`。

---

## 四、常见失败与修法

| 报错 | 原因 | 修法 |
|---|---|---|
| `E402 Payment Required` / `need auth` | 没登录 | 跑 `npm login` |
| `EPUBLISHCONFLICT` / `cannot publish over` | 该版本已存在（发过就不能重发） | 改 `version` 再发；**已发版本不可删除**（72 小时内可 `npm unpublish <pkg>@<ver>`，但别依赖它） |
| `E404` 但不是在 `npm view` | 包里没有 `dsh.bundle` 或目录错了 | 确认在 `presets\task-planning-bundle` 里执行 |
| `E403` scope 权限 | 用了别人的 scope | 改回无 scope 名 `dsh-task-planning-preset` |
| 发布成功但市场不显示 | `repository` 对不上，或索引还没重建 | 跑第 5 步核对 `repository`；索引由对方仓库夜间构建，有延迟 |

---

## 五、发 npm 到底带来什么（如实）

| 收益 | 是否成立 |
|---|---|
| 市场显示下载量 | ✅ 成立（`probe-npm.mjs` 读 `dist-tags.latest`） |
| `dshmarket` 更新检测走 npm 版本比对 | ✅ 成立 |
| **中国大陆用户安装不走 GitHub** | ✅ **成立，这条最实在** —— 今天本机 `github.com:443` 反复超时，npm 走镜像稳定得多 |
| 收录概率更高 | ❌ 不成立：对方明确写「发不发布都不影响收录」 |

---

## 六、本次已做 / 未做

| 项 | 状态 |
|---|---|
| 检查本机 PowerShell 版本（5.1.26100.9711） | ✅ |
| 补齐 `repository` / `engines.dsh` / `files` 三个字段 | ✅ 已改 `package.json` |
| `version` `0.1.0 → 1.2.0` | ✅ 已改（含 bundle README 的版本引用同步） |
| `npm pack` 内容验证（6 文件 / 45 KB） | ✅ |
| 隔离目录安装 + DSH 解析路径复核 | ✅ |
| `engines.dsh` 覆盖运行时版本验证 | ✅（`0.2.1-rc.2` → true） |
| `npm login` / `npm publish` | ⬜ **未做**（账号行为，需使用者本人执行） |
| 市场条目 PR（awesome-dsh-plugin） | ⬜ **未做**（见 `13-插件市场上架方案.md`） |
