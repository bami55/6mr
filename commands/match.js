'use strict';

const db = require(__dirname + '/../database/models/index.js');

/**
 * 試合結果報告コマンド　勝利
 */
exports.report_win = (client, message, args) => {
  report(true, message, args)
};

/**
 * 試合結果報告コマンド　敗北
 */
exports.report_lose = (client, message, args) => {
  report(true, message, args)
};

/**
 * 試合結果報告処理
 * @param {*} isWin 
 * @param {*} message 
 * @param {*} args 
 */
function report (isWin, message, args) {

}