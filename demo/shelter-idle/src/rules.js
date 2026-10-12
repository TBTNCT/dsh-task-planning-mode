// 规则计算：本文件只放《末日避难所》的数值规则，不打印任何东西、不读写任何文件。
// 所有数字的唯一出处是 docs/优化提示词/01-通用规范.md §4.1，改动数字必须同步改那份文档。

// 人口上限 = 3 + 宿舍等级 × 3（§4.1）
function popCap(state) {
  return 3 + state.rooms.dorm * 3;
}

// 水培农场当天的食物产出：每级 7 食物；缺电日减半，向下取整（§4.1 第 3、4 步）。
function farmOutput(state, noPower) {
  const base = state.rooms.farm * 7;
  if (noPower) {
    return Math.floor(base / 2);
  }
  return base;
}

// 下一次人口增长是第几天：人口每 3 天增长一次，所以找「下一个能被 3 整除的天数」。
function nextGrowthDay(day) {
  return day + (3 - (day % 3));
}

// 推进一天：严格按 §4.1 的 8 步固定顺序结算，返回「本日日志数组」（字符串数组）。
// 参数 state 会被就地修改（引用传递），同时本日日志会追加到 state.log 末尾。
function advanceOneDay(state) {
  const lines = [];

  // 第 1 步：天数 +1
  state.day += 1;
  const day = state.day;
  // 统一给本日每一条日志加上「第 N 天：」前缀
  const say = (text) => lines.push(`第 ${day} 天：${text}`);

  say('新的一天开始了，避难所开始今日结算。');

  // 第 2 步：发电 —— 发电机每级每天产出 4 电力
  const powerGain = state.rooms.generator * 4;
  if (powerGain > 0) {
    const powerBefore = state.power;
    state.power += powerGain;
    say(`发电机产出 ${powerGain} 电力（电力 ${powerBefore} → ${state.power}）。`);
  } else {
    say('发电机等级为 0，今日没有电力产出。');
  }

  // 第 3 步：耗电 —— 先把电扣掉，扣成负数才算「缺电」（顺序不能反，反了会算错减半）
  const powerNeed = state.rooms.farm * 2 + state.rooms.medical * 1;
  let noPower = false;
  if (powerNeed > 0) {
    const powerBefore = state.power;
    state.power -= powerNeed;
    if (state.power < 0) {
      noPower = true;
      state.power = 0;
      say(`房间共需 ${powerNeed} 电力，电力不足，今日缺电（电力 ${powerBefore} → 0），水培农场产出减半。`);
    } else {
      say(`房间共消耗 ${powerNeed} 电力（电力 ${powerBefore} → ${state.power}）。`);
    }
  } else {
    say('没有需要用电的房间，今日不耗电。');
  }

  // 第 4 步：产食 —— 水培农场每级每天产出 7 食物，缺电日减半取整
  const foodGain = farmOutput(state, noPower);
  if (foodGain > 0) {
    const foodBefore = state.food;
    state.food += foodGain;
    say(`水培农场产出 ${foodGain} 食物（食物 ${foodBefore} → ${state.food}）。`);
  } else {
    say('水培农场等级为 0，今日没有食物产出。');
  }

  // 第 5 步：吃饭 —— 每人每天吃 1 食物；不够就饿死人，但至少保留 1 人；医疗室有概率救回 1 人
  const eaters = state.pop;
  state.food -= eaters;
  if (state.food < 0) {
    const gap = -state.food;
    // 至少保留 1 人：单日不会因为饥饿把避难所全灭
    const starved = Math.min(gap, state.pop - 1);
    const popBefore = state.pop;
    state.food = 0;
    state.pop -= starved;
    if (starved === 0) {
      say(`食物不足，缺口 ${gap}，但只剩 ${state.pop} 人，不能再饿死（人口保持 ${state.pop}），食物清零。`);
    } else {
      say(`食物不足，缺口 ${gap}，${starved} 人饿死（人口 ${popBefore} → ${state.pop}），食物清零。`);
    }

    // 医疗室减免：每级 15% 概率救回 1 人，每天最多救回 1 人
    const rescueChance = state.rooms.medical * 0.15;
    if (starved > 0 && Math.random() < rescueChance) {
      state.pop += 1;
      say(`医疗室抢救成功，救回 1 人（人口 ${state.pop - 1} → ${state.pop}）。`);
    } else if (state.rooms.medical > 0) {
      say('医疗室本次没能救回任何人。');
    }
  } else {
    say(`${eaters} 人吃饭消耗 ${eaters} 食物（食物 ${state.food + eaters} → ${state.food}）。`);
  }

  // 第 6 步：人口增长 —— 每 3 天一次，且食物 ≥ 10、人口未到上限
  const cap = popCap(state);
  if (state.day % 3 === 0 && state.food >= 10 && state.pop < cap) {
    const popBefore = state.pop;
    state.pop += 1;
    say(`人口增长日：食物充足，1 名幸存者加入（人口 ${popBefore} → ${state.pop}，上限 ${cap}）。`);
  } else if (state.day % 3 !== 0) {
    say(`人口无变化（人口每 3 天增长一次，下一次在第 ${nextGrowthDay(state.day)} 天）。`);
  } else if (state.food < 10) {
    say(`人口无变化（食物 ${state.food} 少于 10，今日不增长）。`);
  } else {
    say(`人口无变化（已达人口上限 ${cap} 人，升级宿舍才能继续增长）。`);
  }

  // 第 7 步：事件判定 —— 留空占位，任务 04（事件与通关结局）实现
  // 第 8 步：结局判定 —— 留空占位，任务 04（事件与通关结局）实现

  // 把本日日志追加进历史日志，方便菜单「2」回看
  for (const line of lines) {
    state.log.push(line);
  }

  return lines;
}

module.exports = {
  popCap,
  farmOutput,
  nextGrowthDay,
  advanceOneDay,
};
