'use strict';

const MatchManager = require(__dirname + '/../manager/MatchManager.js');

/**
 * 募集開始
 */
exports.open = (client, message) => {
  MatchManager.openMatch(message);
};

/**
 * 試合結果報告コマンド　勝利
 */
exports.reportWin = (client, message, args) => {
  MatchManager.report(true, message, args);
};

/**
 * 試合結果報告コマンド　敗北
 */
exports.reportLose = (client, message, args) => {
  MatchManager.report(false, message, args);
};

/**
 * 試合キャンセルコマンド
 */
exports.cancel = (client, message, args) => {
  MatchManager.cancelMatch(message, args);
};
