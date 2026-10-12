// 状态定义：本文件只回答两个问题 ——「游戏状态长什么样」和「怎么造一个开局状态」。
// 这里不放任何规则计算（规则在 src/rules.js），也不放任何终端显示（显示在 src/ui.js）。

// 四个房间的英文键与中文名，顺序固定为：宿舍 / 水培农场 / 发电机 / 医疗室。
// 数组顺序就是界面上从左到右的显示顺序，后续任务升级房间时也按这个顺序遍历。
const ROOM_KEYS = ['dorm', 'farm', 'generator', 'medical'];

const ROOM_NAMES = {
  dorm: '宿舍',
  farm: '水培农场',
  generator: '发电机',
  medical: '医疗室',
};

// 造一个全新的开局状态，数值严格照 01-通用规范.md §4.1：
// 第 1 天、人口 3、食物 40、电力 10、四个房间等级全部为 0（= 未建造）、日志为空。
function createInitialState() {
  return {
    day: 1, // 当前天数
    pop: 3, // 当前人口
    food: 40, // 食物存量
    power: 10, // 电力存量
    rooms: {
      // 四个房间的等级，0 表示还没建造
      dorm: 0,
      farm: 0,
      generator: 0,
      medical: 0,
    },
    log: [], // 历史日志：字符串数组，按时间先后排列，最新的在最后
  };
}

module.exports = {
  ROOM_KEYS,
  ROOM_NAMES,
  createInitialState,
};
