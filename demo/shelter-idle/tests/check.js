// 自检脚本：只用 Node 内置 assert，不引入任何第三方包、不用任何测试框架。
// 运行方式：在本工作区根目录执行 node tests/check.js
// 全绿时最后一行是「CHECK SUMMARY 通过 6 / 失败 0」，退出码 0；有失败则退出码 1。

const assert = require('assert');
const { createInitialState } = require('../src/state');
const { advanceOneDay, popCap } = require('../src/rules');

let passed = 0;
let failed = 0;

// 跑一项检查：通过就记一笔，失败就把原因（原始报错信息）打印出来，不中断后面的检查
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`${name}：通过`);
  } catch (err) {
    failed += 1;
    console.log(`${name}：失败`);
    console.log(`    原因：${err.message}`);
  }
}

// ① 初始状态等于 01-通用规范.md §4.1 的开局值
check('① 初始状态等于 §4.1 的开局值', () => {
  const state = createInitialState();
  assert.strictEqual(state.day, 1, '开局天数应为 1');
  assert.strictEqual(state.pop, 3, '开局人口应为 3');
  assert.strictEqual(state.food, 40, '开局食物应为 40');
  assert.strictEqual(state.power, 10, '开局电力应为 10');
  assert.deepStrictEqual(
    state.rooms,
    { dorm: 0, farm: 0, generator: 0, medical: 0 },
    '四个房间等级应全为 0'
  );
  assert.deepStrictEqual(state.log, [], '开局日志应为空数组');
});

// ② 连续推进 3 天，天数等于 4
check('② 连续推进 3 天，天数等于 4', () => {
  const state = createInitialState();
  advanceOneDay(state);
  advanceOneDay(state);
  advanceOneDay(state);
  assert.strictEqual(state.day, 4, '推进 3 次后天数应为 4');
});

// ③ 农场等级 0 时推进一天，食物必然减少 3（人口 3 的消耗）
check('③ 农场等级 0 时推进一天，食物减少 3', () => {
  const state = createInitialState();
  const foodBefore = state.food;
  advanceOneDay(state);
  assert.strictEqual(state.rooms.farm, 0, '本项检查的前提是水培农场等级为 0');
  assert.strictEqual(foodBefore - state.food, 3, '3 人各吃 1 食物，食物应恰好减少 3');
  assert.strictEqual(state.food, 37, '食物应从 40 减到 37');
});

// ④ 缺电日农场产出减半：临时把 power 设为 0、农场等级设为 2，推进一天，检查食物增量
check('④ 缺电日农场产出减半', () => {
  const state = createInitialState();
  state.power = 0;
  state.rooms.farm = 2;
  const foodBefore = state.food;
  const popBefore = state.pop;
  const dayLines = advanceOneDay(state);
  // 农场 2 级本应产 14 食物，缺电日减半为 7；再扣掉 3 人吃饭的 3 食物 → 净变化 = 7 - 人口
  assert.strictEqual(state.power, 0, '耗电扣成负数后电力应被扣到 0');
  assert.strictEqual(
    state.food - foodBefore,
    7 - popBefore,
    '缺电日农场产出应为 7（14 减半），食物净变化 = 7 - 人口'
  );
  assert.ok(
    dayLines.some((line) => line.includes('缺电')),
    '本日日志里应写明「缺电」'
  );
});

// ⑤ 食物不足时会饿死，但至少保留 1 人
check('⑤ 食物不足时会饿死，但至少保留 1 人', () => {
  const state = createInitialState();
  state.food = 0;
  state.pop = 5;
  advanceOneDay(state);
  assert.ok(state.pop >= 1, `饿死后人口应至少保留 1 人，实际为 ${state.pop}`);
  assert.strictEqual(state.pop, 1, '5 人、缺口 5，最多饿死 4 人，应剩下 1 人');
  assert.strictEqual(state.food, 0, '饿死后食物应清零');
});

// ⑥ 人口上限公式 3 + 宿舍等级 × 3
check('⑥ 人口上限公式 3 + 宿舍等级 × 3', () => {
  const state = createInitialState();
  assert.strictEqual(popCap(state), 3, '宿舍 0 级时人口上限应为 3');
  state.rooms.dorm = 1;
  assert.strictEqual(popCap(state), 6, '宿舍 1 级时人口上限应为 6');
  state.rooms.dorm = 2;
  assert.strictEqual(popCap(state), 9, '宿舍 2 级时人口上限应为 9');
  state.rooms.dorm = 3;
  assert.strictEqual(popCap(state), 12, '宿舍 3 级时人口上限应为 12');
});

console.log('');
console.log(`CHECK SUMMARY 通过 ${passed} / 失败 ${failed}`);

if (failed > 0) {
  process.exitCode = 1;
}
