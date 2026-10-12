// 终端显示：本文件只负责把状态和日志「拼成要打印的文本」，不打印、不改数据、不写文件。
// 三个 render 函数都返回字符串，由 src/game.js 统一 console.log 出去，方便单独测试。
// 界面约定（01-通用规范.md §7.2）：只用 = - | 和中文数字，禁止 emoji、彩色控制符、方框绘制字符。

const { ROOM_KEYS, ROOM_NAMES } = require('./state');
const { popCap } = require('./rules');

// 状态面板宽度固定 40 个半角字符，中文按 2 个半角算
const WIDTH = 40;

// 日志最多显示 10 行
const MAX_LOG_LINES = 10;

// 单个字符占几个半角宽度：中日韩文字与全角标点算 2，其余算 1。
function charWidth(ch) {
  const code = ch.codePointAt(0);
  const isWide =
    (code >= 0x1100 && code <= 0x115f) ||
    code === 0x2329 ||
    code === 0x232a ||
    (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6);
  return isWide ? 2 : 1;
}

// 一行文本占几个半角宽度（中文按 2 算）
function displayWidth(text) {
  let width = 0;
  for (const ch of text) {
    width += charWidth(ch);
  }
  return width;
}

// 把若干字段拼成一行：优先用 4 个空格分组（和样式样例一致），
// 整行超过 40 个半角宽就依次收紧到 2 个空格、1 个空格，保证不超宽。
function joinFields(fields) {
  for (const gap of ['    ', '  ', ' ']) {
    const line = ' ' + fields.join(gap);
    if (displayWidth(line) <= WIDTH) {
      return line;
    }
  }
  return ' ' + fields.join(' ');
}

// 状态面板：分隔线 + 标题 + 资源行 + 房间行。
// 末尾不画分隔线，交给 renderMenu 的开头那条「-」，这样「面板 / 日志 / 菜单」的顺序都好看。
function renderStatus(state) {
  const lines = [];
  lines.push('='.repeat(WIDTH));
  lines.push(` 末日避难所 · 第 ${state.day} 天`);
  lines.push('='.repeat(WIDTH));
  lines.push(
    joinFields([`人口 ${state.pop}/${popCap(state)}`, `食物 ${state.food}`, `电力 ${state.power}`])
  );
  lines.push(
    joinFields(ROOM_KEYS.map((key) => `${ROOM_NAMES[key]} L${state.rooms[key]}`))
  );
  return lines.join('\n');
}

// 编号菜单：分隔线 + 三个选项 + 底边。
// 参数 state 现在用不到，保留是为了任务 02 起菜单要随房间状态变化时接口不变。
function renderMenu(state) {
  return [
    '-'.repeat(WIDTH),
    ' 1. 推进一天',
    ' 2. 查看最近 10 条日志',
    ' 3. 退出',
    '='.repeat(WIDTH),
  ].join('\n');
}

// 日志：最多显示最后 10 行；一行都没有时给一句中文提示，避免出现空白。
function renderLog(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return '（暂无日志）';
  }
  return lines.slice(-MAX_LOG_LINES).join('\n');
}

module.exports = {
  WIDTH,
  MAX_LOG_LINES,
  displayWidth,
  renderStatus,
  renderMenu,
  renderLog,
};
