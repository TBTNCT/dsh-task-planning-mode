/**
 * token-estimator —— 「任务规划」模式自带的本地工具插件（纯 ESM，零第三方依赖）
 *
 * 提供两个工具：
 *   - estimate_tokens：按可解释的静态公式给出 token 低-高区间，并判断是否触发
 *     「单对话 6000 万」阈值。
 *   - usage_report：优先读运行时计量（本会话已用 token），读不到时降级为静态对照。
 *
 * ── 为什么本文件只用 `node:` 内置模块、一个裸包都不 import ──────────────────────
 * 本插件随 bundle 包分发（`presets/task-planning-bundle/`）。该目录向上没有任何
 * `node_modules`（实测：`<PLUGINS_DIR>\…\task-planning-bundle` 到 `D:\` 全链无
 * node_modules），所以照抄官方包第一行的 `import { z } from 'zod'` 会直接
 * `ERR_MODULE_NOT_FOUND`（实测报错原文见 `docs/实施记录/03-token估算器实测.md` 的 E2 一节）。
 * 因此这里：Config / 工具注册所需的一切都内联，不 import 任何 `@deepseek-ai/*`、`zod`、`schemastery`。
 *
 * ── 为什么可以省掉 Config ──────────────────────────────────────────────────────
 * cordis 解析插件配置时是 `if (!runtime.Config) return config`（证据：
 * `%USERPROFILE%\.dsh\profiles\node_modules\@deepseek-ai\cordis\lib\index.js:956`），
 * 即**不导出 Config 就不做校验、原样透传**。本插件不需要配置，故不导出 Config。
 *
 * ── 为什么工具定义是"手写原始 JSON Schema"而不是用 defineTool ───────────────────
 * `defineTool` 来自 `@deepseek-ai/dsh-tools`（裸包，见上，不能 import）。它做的事只是把
 * 作者 DSL 编译成原始 JSON Schema 并包一层参数校验。宿主注册表真正要求的是
 * `definition.output = { schema, render }` 且 `schema` 落在"受支持的 JSON Schema 子集"内
 * （证据：`@deepseek-ai/dsh-tools\lib\index.js:2773-2782` 的 `register()`），
 * 因此这里直接手写该子集能接受的 schema。
 *
 * ── 静态估算算法（可解释，不是黑盒）────────────────────────────────────────────
 * 口径：**保守**。区间给低/高；"合计"按 `(低+高)/2 × 1.5`（1.5 = 重试/返工系数）。
 *
 *   1) 任务基准：`baseTokens = tasks × 700_000`
 *      —— 一个"中等任务"（含提问澄清、探索、产出文档、写报告）的经验基准。
 *   2) 读入侧：`readTokens = existingCodeLines × 8 + files × 600`
 *      —— 要读懂的既有代码按每行约 8 token；每个涉及文件的读取/检索开销约 600 token。
 *   3) 产出侧：`produceTokens = docChars × 1.2 + files × 1500`
 *      —— 中文规划文档按每字约 1.2 token（CJK 下"每 token 四字符"会严重低估）；每个产出文件约 1500 token。
 *   4) 复杂度乘子：前端 ×1.2、游戏逻辑 ×1.35、联网 ×1.15（可叠加）。
 *   5) 迭代乘子：`iterations / 3`（默认 3 轮 = 1.0）。
 *   6) `raw = (baseTokens + readTokens + produceTokens) × 复杂度 × 迭代`
 *      `低 = raw × 0.8`，`高 = raw × 2.5`。
 *
 * 标定：以本项目（8 个主任务的插件开发，约 40 文件 / 6 万字文档 / 5 千行既有代码）代入，
 * 得到约 4.6M – 14.5M，与 `docs/工作流程/00-总览与使用说明.md` 第八节的
 * 4.7M – 14.5M 同一量级（标定过程见实施记录）。
 *
 * ⚠️ 这是估算，不是承诺；数字来自上面的可解释公式，不来自任何被伪造的用量。
 */

import process from "node:process";

/** 宿主注册表用来标识本插件的行名（preset 里 `id` 由行自己写，这里只给插件名）。 */
export const name = "token-estimator";

/**
 * 只声明 `tools`：本插件**必须**能注册工具。
 * `sessionProjections` / `tokenMeter` 是"运行时计量"的可选来源，**故意不放进 inject**——
 * 否则它们缺席时整个 fiber 会挂起，连静态估算都注册不上（降级就无从谈起）。
 * 运行时按 `ctx.get(...)` 取，取不到就走静态轨。
 */
export const inject = ["tools"];

// ── 阈值与公式常量（改这里就等于改算法，注释里的量纲必须同步）──────────────────

/** 单对话上限：6000 万 token，超过必须二次拆分。 */
const CONVERSATION_LIMIT = 60_000_000;
// 注：曾有的「单任务 2 亿」上限已按使用者要求删除，不再是判断标准；
// 若今后要恢复，须同时改回 PROMPT.md 的硬约束 ③ 与 §七/§八/§十五（口径必须一处不留地同步）。

const BASE_TOKENS_PER_TASK = 700_000;
const READ_TOKENS_PER_CODE_LINE = 8;
const READ_TOKENS_PER_FILE = 600;
const PRODUCE_TOKENS_PER_DOC_CHAR = 1.2;
const PRODUCE_TOKENS_PER_FILE = 1500;
const LOW_FACTOR = 0.8;
const HIGH_FACTOR = 2.5;
/** 保守口径的重试/返工系数：合计 = (低+高)/2 × 1.5。 */
const RETRY_FACTOR = 1.5;
/** 默认迭代轮数（一次对话内平均改稿/返工轮数）。 */
const DEFAULT_ITERATIONS = 3;

/** 规模参数的默认值：调用方不传 scale 时用它，保证工具永远有输出。 */
const DEFAULT_SCALE = {
  tasks: 1,
  files: 3,
  docChars: 4000,
  existingCodeLines: 0,
  iterations: DEFAULT_ITERATIONS,
  hasFrontend: false,
  hasGameLogic: false,
  hasNetwork: false,
};

/** 是否强制走静态轨（降级路径验证用；不读不写任何 profile 文件）。 */
function forcedStatic() {
  return String(process.env.TOKEN_ESTIMATOR_FORCE_STATIC || "") === "1";
}

/** 取正整数，非法值回落到默认值——估算器不该因为参数脏就中断对话。 */
function intOr(value, fallback, min = 0) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.round(n);
  return i < min ? min : i;
}

/** 取正数（浮点），非法值回落默认值。 */
function numOr(value, fallback, min = 0) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n < min ? min : n;
}

/** 归一化规模参数：缺失字段一律用默认值补齐。 */
function normalizeScale(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    tasks: intOr(s.tasks, DEFAULT_SCALE.tasks, 1),
    files: intOr(s.files, DEFAULT_SCALE.files, 0),
    docChars: intOr(s.docChars, DEFAULT_SCALE.docChars, 0),
    existingCodeLines: intOr(s.existingCodeLines, DEFAULT_SCALE.existingCodeLines, 0),
    iterations: numOr(s.iterations, DEFAULT_SCALE.iterations, 1),
    hasFrontend: s.hasFrontend === true,
    hasGameLogic: s.hasGameLogic === true,
    hasNetwork: s.hasNetwork === true,
  };
}

/** 把 token 数格式化成人类可读量级（估算报告里用）。 */
function fmt(n) {
  const v = Math.round(n);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

/**
 * 静态估算核心。返回结构化结果，供工具返回值与 `usage_report` 的静态对照共用。
 * @param {string} stage - 阶段名/描述。
 * @param {object} scaleRaw - 规模参数（可为空）。
 * @returns {object} 低/高/合计、阈值判断、依据与免责声明。
 */
function estimate(stage, scaleRaw) {
  const scale = normalizeScale(scaleRaw);

  const baseTokens = scale.tasks * BASE_TOKENS_PER_TASK;
  const readTokens = scale.existingCodeLines * READ_TOKENS_PER_CODE_LINE + scale.files * READ_TOKENS_PER_FILE;
  const produceTokens = scale.docChars * PRODUCE_TOKENS_PER_DOC_CHAR + scale.files * PRODUCE_TOKENS_PER_FILE;

  let complexity = 1;
  const complexityParts = [];
  if (scale.hasFrontend) {
    complexity *= 1.2;
    complexityParts.push("含前端 ×1.2");
  }
  if (scale.hasGameLogic) {
    complexity *= 1.35;
    complexityParts.push("含游戏逻辑 ×1.35");
  }
  if (scale.hasNetwork) {
    complexity *= 1.15;
    complexityParts.push("含联网 ×1.15");
  }
  const iterationFactor = scale.iterations / DEFAULT_ITERATIONS;
  const multiplier = complexity * iterationFactor;

  const raw = (baseTokens + readTokens + produceTokens) * multiplier;
  const low = Math.round(raw * LOW_FACTOR);
  const high = Math.round(raw * HIGH_FACTOR);
  const total = Math.round(((low + high) / 2) * RETRY_FACTOR);

  const conversationLimit = total > CONVERSATION_LIMIT;

  const verdicts = [];
  verdicts.push(
    conversationLimit
      ? `⚠️ 触发「单对话 ${fmt(CONVERSATION_LIMIT)}」阈值：必须二次拆分后再执行。`
      : `未触发「单对话 ${fmt(CONVERSATION_LIMIT)}」阈值。`,
  );

  const basis = [
    `阶段：${stage}`,
    `规模：子任务 ${scale.tasks} 个 / 文件 ${scale.files} 个 / 文档 ${scale.docChars} 字 / 需读既有代码 ${scale.existingCodeLines} 行`,
    `任务基准：${scale.tasks} × ${BASE_TOKENS_PER_TASK} = ${baseTokens} token`,
    `读入侧：${scale.existingCodeLines} 行 × ${READ_TOKENS_PER_CODE_LINE} + ${scale.files} 文件 × ${READ_TOKENS_PER_FILE} = ${readTokens} token`,
    `产出侧：${scale.docChars} 字 × ${PRODUCE_TOKENS_PER_DOC_CHAR} + ${scale.files} 文件 × ${PRODUCE_TOKENS_PER_FILE} = ${produceTokens} token`,
    `乘子：复杂度 ×${complexity.toFixed(3)}${complexityParts.length ? `（${complexityParts.join("，")}）` : ""} × 迭代 ${scale.iterations}/${DEFAULT_ITERATIONS} = ×${multiplier.toFixed(3)}`,
    `区间系数：低 ×${LOW_FACTOR} / 高 ×${HIGH_FACTOR}；合计 = (低+高)/2 × 重试系数 ${RETRY_FACTOR}`,
  ];

  return {
    stage,
    low,
    high,
    total,
    breakdown: {
      baseTokens,
      readTokens,
      produceTokens,
      multiplier: Number(multiplier.toFixed(3)),
      retryFactor: RETRY_FACTOR,
    },
    triggers: {
      conversationLimit,
    },
    verdicts,
    basis,
    disclaimer: "这是估算，不是承诺：数字来自可解释的静态公式，实际用量随对话轮次与返工次数变化。",
  };
}

// ── 运行时计量（可选，任何失败都不抛错）────────────────────────────────────────

/**
 * 探测运行时计量。返回 `{ available, source, used, detail, reason }`。
 * 顺序：① sessionProjections 的 tokenUsage（完整持久日志口径，最接近"本会话已用"）
 *       ② tokenMeter.measure(session)（当前请求与表面压力）
 * 两者都取不到 → available:false + 原因（**不是失败**）。
 * @param {object} ctx - 插件上下文。
 * @param {object} session - 当前会话（来自 exec.agent.session，可能为 undefined）。
 * @returns {object} 计量结果或降级原因。
 */
function readRuntimeUsage(ctx, session) {
  const reasons = [];

  // ① sessionProjections.snapshot(session).values.tokenUsage
  //    证据：@deepseek-ai/dsh-session-projection README.zh.md「注册与读取」一节
  //    （snapshot(session) → { asOfSeq, values }）；tokenUsage 字段见
  //    @deepseek-ai/dsh-token-meter/lib/types/usage-projection.d.ts:12-29。
  try {
    const sp = ctx && typeof ctx.get === "function" ? ctx.get("sessionProjections") : undefined;
    if (sp && typeof sp.snapshot === "function" && session) {
      const snap = sp.snapshot(session);
      const values = snap && snap.values ? snap.values : undefined;
      const usage = values ? values.tokenUsage : undefined;
      if (usage && typeof usage === "object") {
        const uncached = intOr(usage.uncachedInputTokens, 0, 0);
        const output = intOr(usage.outputTokens, 0, 0);
        const cacheRead = intOr(usage.cacheReadTokens, 0, 0);
        const cacheWrite = intOr(usage.cacheWriteTokens, 0, 0);
        return {
          available: true,
          source: "sessionProjections.tokenUsage（完整持久日志口径）",
          used: uncached + output,
          detail: {
            uncachedInputTokens: uncached,
            outputTokens: output,
            cacheReadTokens: cacheRead,
            cacheWriteTokens: cacheWrite,
          },
          asOfSeq: intOr(snap.asOfSeq, -1, -1),
          reason: "",
        };
      }
      reasons.push("sessionProjections 可用但未提供 tokenUsage 单元");
    } else {
      reasons.push(sp ? "缺少当前会话句柄" : "sessionProjections 服务不可见");
    }
  } catch (err) {
    reasons.push(`读取 sessionProjections 失败：${err && err.message ? err.message : String(err)}`);
  }

  // ② tokenMeter.measure(session) → { totalTokens, surfaceTokens }
  //    证据：@deepseek-ai/dsh-token-meter/README.zh.md「测量压力」一节。
  try {
    const tm = ctx && typeof ctx.get === "function" ? ctx.get("tokenMeter") : undefined;
    if (tm && typeof tm.measure === "function" && session) {
      const m = tm.measure(session);
      if (m && typeof m === "object") {
        const total = intOr(m.totalTokens, -1, -1);
        const surface = intOr(m.surfaceTokens, -1, -1);
        if (total >= 0) {
          return {
            available: true,
            source: "tokenMeter.measure()（当前请求与表面压力）",
            used: total,
            detail: { totalTokens: total, surfaceTokens: surface },
            asOfSeq: -1,
            reason: "",
          };
        }
      }
      reasons.push("tokenMeter.measure() 未返回 totalTokens");
    } else {
      reasons.push(tm ? "缺少当前会话句柄" : "tokenMeter 服务不可见");
    }
  } catch (err) {
    reasons.push(`调用 tokenMeter.measure() 失败：${err && err.message ? err.message : String(err)}`);
  }

  return {
    available: false,
    source: "",
    used: -1,
    detail: null,
    asOfSeq: -1,
    reason: reasons.join("；") || "运行时计量不可用",
  };
}

// ── 工具定义（手写原始 JSON Schema，落在受支持子集内）────────────────────────────

/** 受支持子集里的一个 object 节点（所有字段必填）。 */
function obj(properties) {
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

const ESTIMATE_TOKENS_TOOL = {
  name: "estimate_tokens",
  description:
    "按可解释的静态公式估算一个阶段/任务的 token 消耗：给出低-高区间与保守合计，并判断是否触发" +
    "「单对话 6000 万」阈值。用于把「拍脑袋估 token」换成有依据的区间估算。" +
    "这是估算不是承诺。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      stage: { type: "string", description: "阶段名或阶段描述，例如「工具集接线与实测」。" },
      scale: {
        type: "object",
        additionalProperties: false,
        properties: {
          tasks: { type: "integer", description: "该阶段包含的子任务数（默认 1）。" },
          files: { type: "integer", description: "预计新增/修改的文件数（默认 3）。" },
          docChars: { type: "integer", description: "预计产出文档的字数（默认 4000）。" },
          existingCodeLines: { type: "integer", description: "需要阅读的既有代码行数（默认 0）。" },
          iterations: { type: "number", description: "平均迭代/返工轮数（默认 3）。" },
          hasFrontend: { type: "boolean", description: "是否含前端（乘子 ×1.2）。" },
          hasGameLogic: { type: "boolean", description: "是否含游戏逻辑（乘子 ×1.35）。" },
          hasNetwork: { type: "boolean", description: "是否含联网（乘子 ×1.15）。" },
        },
      },
    },
    required: ["stage"],
  },
  output: {
    schema: obj({
      stage: { type: "string" },
      low: { type: "integer" },
      high: { type: "integer" },
      total: { type: "integer" },
      breakdown: obj({
        baseTokens: { type: "integer" },
        readTokens: { type: "integer" },
        produceTokens: { type: "integer" },
        multiplier: { type: "number" },
        retryFactor: { type: "number" },
      }),
      triggers: obj({
        conversationLimit: { type: "boolean" },
      }),
      verdicts: { type: "array", items: { type: "string" } },
      basis: { type: "array", items: { type: "string" } },
      disclaimer: { type: "string" },
    }),
    render: (_args, value) => {
      const lines = [
        `【token 估算 · ${value.stage}】`,
        `低估算：${fmt(value.low)}（${value.low}） ｜ 高估算：${fmt(value.high)}（${value.high}）`,
        `保守合计：${fmt(value.total)}（${value.total}，= (低+高)/2 × ${value.breakdown.retryFactor}）`,
        "",
        "阈值判断：",
        ...value.verdicts.map((v) => `  - ${v}`),
        "",
        "估算依据：",
        ...value.basis.map((b) => `  - ${b}`),
        "",
        value.disclaimer,
      ];
      return [{ type: "text", text: lines.join("\n") }];
    },
  },
  execute(args) {
    const stage = typeof args.stage === "string" && args.stage.trim() ? args.stage.trim() : "（未命名阶段）";
    return Promise.resolve(estimate(stage, args.scale));
  },
};

/**
 * 构造 `usage_report` 工具定义。
 *
 * 注意：**必须闭包捕获插件上下文 `ctx`**，不能在 `execute` 里用 `this`——
 * 宿主是以 `definition.execute(args, exec)` 调用的，`this` 是工具定义对象而不是插件 ctx，
 * 用 `this` 会拿不到 `ctx.get`，运行时计量会被误判为不可用（本文件早先版本的真实 bug）。
 * @param {object} ctx - 插件上下文（用于 `ctx.get('sessionProjections' | 'tokenMeter')`）。
 * @returns {object} 可注册的工具定义。
 */
function createUsageReportTool(ctx) {
  return {
  name: "usage_report",
  description:
    "报告本会话（或指定会话/任务）已使用的 token：优先读运行时计量，读不到时明确说明原因并给静态估算对照。" +
    "读不到运行时计量不算失败，工具一定返回可用信息，绝不中断对话。",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      sessionId: { type: "string", description: "会话 id（可选；本版本只报告当前会话）。" },
      taskId: { type: "string", description: "任务编号（可选；用于标注报告范围）。" },
      scale: {
        type: "object",
        additionalProperties: false,
        properties: {
          tasks: { type: "integer", description: "静态对照用的子任务数。" },
          files: { type: "integer", description: "静态对照用的文件数。" },
          docChars: { type: "integer", description: "静态对照用的文档字数。" },
          existingCodeLines: { type: "integer", description: "静态对照用的既有代码行数。" },
        },
      },
    },
    required: [],
  },
  output: {
    schema: obj({
      scope: { type: "string" },
      available: { type: "boolean" },
      runtimeSource: { type: "string" },
      usedTokens: { type: "integer" },
      staticLow: { type: "integer" },
      staticHigh: { type: "integer" },
      staticTotal: { type: "integer" },
      comparison: { type: "string" },
      advice: { type: "string" },
      notes: { type: "array", items: { type: "string" } },
    }),
    render: (_args, value) => {
      const lines = [`【token 用量报告 · ${value.scope}】`];
      if (value.available) {
        lines.push(`运行时计量：可用（${value.runtimeSource}）`);
        lines.push(`本会话已用：${fmt(value.usedTokens)}（${value.usedTokens} token）`);
      } else {
        lines.push("运行时计量：不可用");
      }
      lines.push(`静态估算对照：低 ${fmt(value.staticLow)} ～ 高 ${fmt(value.staticHigh)}（保守合计 ${fmt(value.staticTotal)}）`);
      lines.push(`对照结论：${value.comparison}`);
      lines.push(`建议：${value.advice}`);
      if (value.notes.length > 0) {
        lines.push("");
        lines.push("备注：");
        for (const n of value.notes) lines.push(`  - ${n}`);
      }
      return [{ type: "text", text: lines.join("\n") }];
    },
  },
  execute(args, exec) {
    const sessionId = typeof args.sessionId === "string" && args.sessionId ? args.sessionId : "";
    const taskId = typeof args.taskId === "string" && args.taskId ? args.taskId : "";
    const scopeParts = [];
    scopeParts.push(taskId ? `任务 ${taskId}` : "当前会话");
    if (sessionId) scopeParts.push(`sessionId=${sessionId}`);
    const scope = scopeParts.join(" · ");

    const notes = [];
    const session = exec && exec.agent && exec.agent.session ? exec.agent.session : undefined;
    if (sessionId) {
      notes.push("本版本只报告当前会话：sessionId 参数仅用于标注，不会去读其它会话的日志。");
    }

    // 静态对照：用调用方给的规模（或默认值）算一份区间。
    const staticResult = estimate(taskId ? `任务 ${taskId}` : "当前会话", args.scale);

    // 运行时计量（可被环境变量强制关闭，用于验证降级路径）。
    let runtime;
    if (forcedStatic()) {
      runtime = { available: false, source: "", used: -1, reason: "TOKEN_ESTIMATOR_FORCE_STATIC=1：已强制走静态轨" };
    } else {
      runtime = readRuntimeUsage(ctx, session);
    }

    let comparison;
    let advice;
    if (runtime.available) {
      if (runtime.used <= staticResult.high) {
        comparison = `已用 ${fmt(runtime.used)} 仍在静态高估算 ${fmt(staticResult.high)} 之内。`;
      } else {
        comparison = `已用 ${fmt(runtime.used)} 已超过静态高估算 ${fmt(staticResult.high)}，说明实际返工/探索比预估更多。`;
      }
      if (runtime.used > CONVERSATION_LIMIT) {
        advice = `已用超过单对话 ${fmt(CONVERSATION_LIMIT)} 阈值：必须二次拆分。`;
      } else if (runtime.used > staticResult.high) {
        advice = "用量已高于静态高估算，建议先收尾当前阶段、把剩余工作拆到新对话。";
      } else {
        advice = "用量在预估区间内，可继续当前阶段。";
      }
      if (runtime.detail && typeof runtime.detail.cacheReadTokens === "number") {
        notes.push(
          `明细：未缓存输入 ${runtime.detail.uncachedInputTokens} / 输出 ${runtime.detail.outputTokens}` +
            ` / 缓存读 ${runtime.detail.cacheReadTokens} / 缓存写 ${runtime.detail.cacheWriteTokens}（缓存读写不计入"已用"）。`,
        );
      }
      if (runtime.asOfSeq >= 0) notes.push(`数据切点 asOfSeq=${runtime.asOfSeq}。`);
    } else {
      comparison = "无法对照：运行时计量不可用，以下只有静态估算。";
      advice = "静态估算偏保守；若连续多个阶段实际用量都高于静态高估算，请在实施记录里反馈以便校准公式。";
      notes.push(`运行时计量不可用（原因）：${runtime.reason}`);
    }

    notes.push("本报告不伪造任何用量：数字要么来自运行时计量（附来源），要么来自上面可解释的静态公式。");

    return Promise.resolve({
      scope,
      available: runtime.available,
      runtimeSource: runtime.source || "无",
      usedTokens: runtime.available ? runtime.used : 0,
      staticLow: staticResult.low,
      staticHigh: staticResult.high,
      staticTotal: staticResult.total,
      comparison,
      advice,
      notes,
    });
  },
  };
}

/**
 * 插件入口：注册两个工具。
 * @param {object} ctx - 带 `tools` 注册表的插件上下文。
 */
export function apply(ctx) {
  ctx.tools.register(ESTIMATE_TOKENS_TOOL);
  ctx.tools.register(createUsageReportTool(ctx));
}
