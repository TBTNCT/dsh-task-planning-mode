# Task Planning Mode — a DeepSeek Harness (DSH) plugin

> Adds a mode to **DeepSeek Harness (DSH)** that **asks the right questions first, then turns your idea into
> a step-by-step plan with copy-paste prompts.** It does not implement anything — implementation happens in the
> standard mode.

**Language**: [中文](README.zh.md) · [English](README.en.md)

---

## 1. What it is, and what problem it solves

It is for people who **know exactly what they want but know nothing about the field they are stepping into**.

You have an idea ("I want an idle game", "I want a small expense tracker"), but you cannot say how it should be
broken into steps, what to do first, which tools to install, or roughly how many tokens it will cost. So you tell
an AI "just build it for me" and get back a pile of contradictory code.

This mode does exactly one thing: **it interrogates you until the idea is clear, then hands you a blueprint you
can actually follow.**

What you get:

| Output | What it is |
|---|---|
| Requirements confirmation | A read-back of "here is what I understand you want", so you can catch misunderstandings before any work starts |
| `docs/工作流程/` task files | One file per task, each containing a **copy-paste-ready prompt**; one task = one new conversation |
| `docs/优化提示词/01-通用规范.md` | Your project's own ground rules, read before every task |
| `docs/优化提示词/执行进度.md` | The single source of truth across sessions: status, commit hash, key numbers |
| Token estimate table | Per-task low/high range, plus whether it crosses the 60M threshold |
| Execution order | "Do this first, then that", every step with a workspace-relative path |

> Note: the mode's own prompts and generated documents are written in **Chinese**. The mode is designed for
> Chinese-speaking users; this English README describes it for everyone else.

---

## 2. What it is **not** (read this before installing)

- ❌ **It does not implement anything.** No business code, no dependency installs, no edits to your project files —
  it only writes planning documents and prompts. Implementation happens in **standard mode**, in a new conversation.
- ❌ **It does not generate complex art.** No character art, scene images, animations, or effects. You either supply
  assets yourself, or the plan falls back to placeholders (solid colour blocks, text labels).
- ❌ **It cannot decide what you want.** It asks good questions; you supply the answers.
- ❌ **It cannot ship a browser UI.** (**Derived from the preset mechanism, not verified at runtime**: a DSH preset can
  contribute tools, prompts and skills to an agent, but a browser UI requires a separate client package wired into the
  host composition.)
- ❌ **It is not a one-command install.** See below.

---

## 3. Installation

> Before you install: **a preset's trust level is equivalent to shell access.** Installing one means allowing it to
> assemble arbitrary tool compositions on your machine. **Only install presets from sources you trust.**

### Route A (recommended, verified on the maintainer's machine): install the bundle via the plugin manager

For **DSH 0.2.x** (measured host version: `@deepseek-ai/dsh-desktop 0.2.0-rc.2`, with
`@deepseek-ai/dsh-web-app@0.2.1-alpha.1` inside the asar). This mode ships as a **bundle package**.

In the DSH **desktop app**:

1. Click **Plugins** in the left sidebar.
2. Click **Add plugin** (or **Install third-party plugin** in the arrow menu).
3. Paste the **absolute path of this repository's `presets/task-planning-bundle/` directory** into the package field.
   (The dialog accepts a package name with optional version, a Git URL, an archive, or a local absolute path;
   a local path reads that directory's `package.json` directly.)
4. Wait until the UI shows package `dsh-task-planning-preset` and its version, click **Install**, and let pnpm finish.
5. Click **Enable now** (or flip the switch for that bundle in the plugin list).
6. **Open a new session.** "任务规划" (Task Planning) should appear in the mode selector.

**Pre-flight helper** (it will not click the UI for you — it only checks the environment and prints the path to paste):

> ⚠️ **Every `powershell -File` command in this section must be run from the repository root.**
> `-File` resolves a relative path against the **current working directory**; anywhere else you get
> `The argument "install.ps1" for the -File parameter does not exist`. Either `cd` to the repository root
> first, or pass the script's **absolute path**.

```powershell
cd <repository root>
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**If the mode does not appear**: restart the desktop app, then open a new session (composition changes usually need a
restart). If the plugin page says "load failed", copy the raw error text before troubleshooting. For the
`ERR_PNPM_UNEXPECTED_STORE` install error, see section 2 of
[`presets/task-planning-bundle/README.md`](presets/task-planning-bundle/README.md).

### Route B (DSH 0.1.x legacy mechanism): copy the directory into the user layer

> ⚠️ **Measured: this route does not work on DSH 0.2.x.** The 0.2.x preset registry **does not scan any directory**,
> so a copy placed there is dead data that will never show up in the mode selector
> (evidence: `docs/实施记录/01-预设机制冲突-运行时版本不符.md`). Only 0.1.x needs this route.

```powershell
# cd to the repository root first (-File resolves relative paths against the current directory)
cd <repository root>
powershell -ExecutionPolicy Bypass -File .\install.ps1 -LegacyCopy
```

Manual equivalent (Windows PowerShell):

```powershell
$src = ".\presets\task-planning"
$dst = Join-Path $env:USERPROFILE ".dsh\.agent-presets\task-planning"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
Copy-Item -LiteralPath $src -Destination (Split-Path -Parent $dst) -Recurse -Force
```

The directory name may only contain lowercase letters, digits and hyphens, and `agent.cordis.yml` must be a **top-level
array**. Changes take effect in a **new session**.

#### 0.1.x advanced: add `roots` to the `agent-presets` row

In the profile's `cordis.patch.yml`, add `roots: [{ path: <presets dir inside the package> }]` to the
`agent-presets` row so the preset follows package updates automatically.

> ⚠️ **You must restate `default`.** A patch addressed by id **replaces the whole config**, it does not deep-merge.
> Writing only `roots` wipes the original `default: standard` — and **every mode disappears**.
>
> **How to roll back**: restore the row's `config` to its previous full content (it must contain at least
> `default: standard`), or restore `cordis.patch.yml` from your backup, then **restart DSH**.
> The 0.1.x `roots` mechanism **no longer applies on 0.2.x** (measured — see `docs/调研/03-preset机制-新版.md`).

### Uninstalling

```powershell
# cd to the repository root first (-File resolves relative paths against the current directory)
cd <repository root>

# Dry run: show what would be deleted
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 -WhatIf

# Removes the user-layer copy (prints the path, asks for confirmation, then deletes)
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
```

For a bundle installed through the plugin manager, uninstall it in **desktop app → Plugins → that bundle's card →
Uninstall** (that step writes to the profile, so the script deliberately does not do it).

---

## 4. How to use it (one full run)

1. **Open a new session** and pick "任务规划" in the mode selector.
2. **Just describe your idea** in plain words. No jargon, no structure required.
3. **Answer its questions.** It uses the `ask_user_question` tool to ask 3–10 questions at a time, each with options
   and trade-offs, up to 6 rounds, until the 9-item requirements checklist is full.
4. When you have had enough, **say "停，开始规划"** ("stop, start planning").
5. It first gives you a **requirements confirmation**; once you confirm, it produces the planning documents.
6. Then: **open `docs/工作流程/00-总览与使用说明.md` and follow its order — one task per new conversation.**
   Copy the prompt from section 3 of each task file into the new conversation.

> Two rules people skip most often:
> ① **one task = one new conversation** (clean context, stable results);
> ② **the first step of every new conversation is setting the workspace to your project directory** so the AI can
> read `docs/` on its own instead of you dragging files in.

---

## 5. What the output looks like

This repository ships a **real demo produced by the mode**: [`demo/shelter-idle/`](demo/shelter-idle/)
(a small post-apocalyptic shelter idle game).

Look at its output directly:

- [`demo/shelter-idle/docs/工作流程/00-总览与使用说明.md`](demo/shelter-idle/docs/工作流程/00-总览与使用说明.md) — overview and execution order
- [`demo/shelter-idle/docs/工作流程/01-游戏骨架与一天循环.md`](demo/shelter-idle/docs/工作流程/01-游戏骨架与一天循环.md) — one task file, with its copy-paste prompt
- [`demo/shelter-idle/docs/优化提示词/01-通用规范.md`](demo/shelter-idle/docs/优化提示词/01-通用规范.md) — that project's own ground rules
- [`demo/shelter-idle/docs/优化提示词/执行进度.md`](demo/shelter-idle/docs/优化提示词/执行进度.md) — its progress ledger

> `demo/_自测/`, `demo/_验收/` and `notepad-app/` are **internal validation artifacts**; they are listed in
> `.gitignore` and are not published with the repository.

---

## 6. Compatibility and measured environment

| Item | Value |
|---|---|
| DSH desktop host | `@deepseek-ai/dsh-desktop 0.2.0-rc.2`; `@deepseek-ai/dsh-web-app@0.2.1-alpha.1` inside the asar |
| Profile dependency tree | `@deepseek-ai/* 0.1.5-rc.2` (measured on the maintainer's desktop profile) |
| OS | Windows (Windows PowerShell **5.1**, not 7) |
| Node.js | v24.20.0 |
| How it was verified | Installed into the desktop profile → restarted the desktop app → opened a new session → "任务规划" appeared in the mode selector → each tool inside the mode tested individually |

**Not tested on macOS or Linux.** The shell tool row is platform-switched (`tool-pwsh` / `tool-bash`), so it should
work in principle — but it has **not been verified**; treat it as unverified.

---

## 7. Known limitations

1. **No browser UI** — **derived from the mechanism, not verified at runtime** (see section 2).
2. **The exact ordering semantics of user presets in the mode list are derived**, not enumerated on this machine;
   this mode sets `order: 5` for itself.
3. **A restart of the desktop app is usually required** before the mode shows up (whether HMR is enabled was not measured).
4. **Upgrades are manual**: installed plugins do not auto-update; uninstall the old version and install the new one.
5. The mode's system prompt is large (`PROMPT.md`, 14691 characters / 8664 CJK characters) and is **loaded on every
   request**; trimming it is planned for a later version.
6. **The mode only plans.** If you ask it to implement something, it will refuse — that is the design, not a bug.

---

## 8. Security notes (important — do not skip)

- **A preset's trust level is equivalent to shell access.** A preset is a composition: it can mount arbitrary tools,
  inject arbitrary system prompts, and ship arbitrary local code. **Taking a preset from an untrusted source means
  letting that source run arbitrary compositions on your machine.**
- This repository's bundle ships **exactly one local JavaScript file**
  (`plugins/token-estimator/index.js`, the token estimator): plain ESM, **zero third-party dependencies**, importing
  only `node:` built-ins. **Read it before installing** (530 lines, commented in Chinese).
- The mode **never writes outside your workspace**; that boundary is hard-coded as constraint ⑪ in its prompt.
- **Pre-open-source privacy gate**: this repository ships a privacy/credential scanner (`tools/privacy-*`).
  The rule is documented in [`docs/优化提示词/02-开源前隐私规范.md`](docs/优化提示词/02-开源前隐私规范.md) and is
  also hard constraint ⑫ of the mode: **any project planned with it that will be open-sourced must not leak personal
  information before release.**

---

## 9. License and acknowledgements

**MIT License** — free to use, modify, commercialise, sublicense and sell; the only requirement is keeping the
copyright and license notice. See [`LICENSE`](LICENSE).

```
Copyright (c) 2026 这里有只小西琳
```

> On signing: this project uses a **personal (pen-name) attribution**. Open-source norms allow attribution and also
> allow omitting it — see [`docs/优化提示词/02-开源前隐私规范.md`](docs/优化提示词/02-开源前隐私规范.md) §1:
> **a personal signature is allowed but never required.**

Acknowledgements:

- Thanks to **DeepSeek Harness (DSH)** for the preset mechanism and plugin toolchain.
- Every mechanism claim in this project comes from unpacking and reading the locally installed source; the evidence is
  archived under [`docs/调研/`](docs/调研/).
- The document layout used by `demo/shelter-idle/` follows widely used planning-document practices.

---

## 10. Repository layout and document language

```text
presets/task-planning-bundle/   The mode itself (0.2.x deliverable): cordis.patch.yml + PROMPT.md + plugins/ + skills/
presets/task-planning/          0.1.x legacy mechanism, kept for reference (does not work on 0.2.x)
tools/                          Pre-open-source privacy gate: privacy-scan / privacy-sanitize / privacy-check
install.ps1 / uninstall.ps1     Install and uninstall scripts (contain no personal absolute paths)
docs/工作流程/                   This plugin's own development task documents + overview
docs/优化提示词/                 Plugin prompt (00) + ground rules (01) + privacy spec (02) + progress ledger
docs/调研/                       Mechanism research (first-hand evidence with file:line)
docs/实施记录/                   Raw evidence archive (command output, probe results, wiring records)
docs/验收报告/                   Acceptance reports per task
docs/经验/                       Post-mortems (symptom → evidence → root cause → lesson → suggested constraint)
demo/shelter-idle/              The official demo: a project produced by this mode
CHANGELOG.md                    Version history
```

**Document language: Chinese first, with this English README alongside.** Everything under `docs/` and the mode's
system prompt (`presets/task-planning-bundle/PROMPT.md`) is written in Chinese, because the mode targets
Chinese-speaking users.

---

*This project was itself developed using the Task Planning mode: the task documents under `docs/` were planned by it.*
