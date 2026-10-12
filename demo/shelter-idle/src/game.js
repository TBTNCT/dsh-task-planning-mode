// 游戏入口：用 Node 内置 readline 做一个编号菜单循环。
// 运行方式：在本工作区根目录执行 node src/game.js
// 本文件只做「读入编号 → 调用功能 → 打印结果」，规则在 src/rules.js，显示在 src/ui.js。

const readline = require('readline');
const { createInitialState } = require('./state');
const { advanceOneDay } = require('./rules');
const { renderStatus, renderMenu, renderLog } = require('./ui');

// 全局唯一的游戏状态；advanceOneDay 直接改这个对象
const state = createInitialState();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 防止「退出」被打印两次（菜单 3 与输入流结束都可能触发收尾）
let exited = false;

// 打印状态面板
function printStatus() {
  console.log(renderStatus(state));
}

// 打印菜单并等待下一次输入
function showMenuAndAsk() {
  console.log(renderMenu(state));
  rl.question(' 请输入编号：', handleChoice);
}

// 收尾：打印告别语并关闭输入流；进程会以退出码 0 自然结束
function quit() {
  if (exited) {
    return;
  }
  exited = true;
  console.log('游戏结束，再见。');
  rl.close();
}

// 处理一次输入：只有 1 / 2 / 3 是合法编号，其余一律提示后重画菜单，绝不崩溃、绝不退出
function handleChoice(rawInput) {
  const input = String(rawInput).trim();

  if (input === '1') {
    // 推进一天：结算后重画面板，并在面板下面打印本日日志
    const dayLines = advanceOneDay(state);
    printStatus();
    console.log(renderLog(dayLines));
    showMenuAndAsk();
    return;
  }

  if (input === '2') {
    // 只看日志：打印最近 10 条（renderLog 内部已按 10 行截断）
    console.log(renderLog(state.log));
    showMenuAndAsk();
    return;
  }

  if (input === '3') {
    quit();
    return;
  }

  console.log('请输入 1-3 之间的编号');
  showMenuAndAsk();
}

// 输入流结束时（例如用管道喂完输入、或手工按了 Ctrl+Z 再回车）也按正常退出收尾
rl.on('close', () => {
  if (!exited) {
    exited = true;
    console.log('游戏结束，再见。');
  }
});

// 开局：先画面板，再画菜单
printStatus();
showMenuAndAsk();
