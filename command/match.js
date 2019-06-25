'use strict';

require('dotenv').config();
const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const discord = require('discord.js');
const rating = require(__dirname + '/../util/rating.js');
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
  report(true, message, args);
};

/**
 * 試合結果報告コマンド　敗北
 */
exports.reportLose = (client, message, args) => {
  report(false, message, args);
};

/**
 * 試合キャンセルコマンド
 */
exports.cancel = (client, message, args) => {
  cancelMatch(message, args);
};

/**
 * 試合結果報告処理
 * @param {*} isWin
 * @param {*} message
 * @param {*} args
 */
async function report(isWin, message, args) {
  const command = isWin ? '!win' : '!lose';
  const paramsTitle = `!${command} 試合ID`;
  const example = `${command} 1024`;
  const exampleMessage = `${paramsTitle}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`試合IDを指定してください\n${exampleMessage}`);
    return;
  }

  const matchId = args[0];
  const findMatch = await db.matches.findOne({ where: { match_id: matchId } });
  if (!findMatch) {
    message.reply(`【${matchId}】は存在しません`);
    return;
  } else if (findMatch.status !== matchConfig.status.in_progress) {
    message.reply(`【${matchId}】は進行中ではありません`);
    return;
  }

  const findMatchUser = await db.match_users.findOne({
    where: {
      match_id: matchId,
      discord_id: message.author.id
    }
  });
  if (!findMatchUser) {
    message.reply(`【${matchId}】にエントリーしていません`);
    return;
  }

  // DB登録
  await saveResult(isWin, findMatch, findMatchUser);

  // レーティング更新
  await rating.updateRating(message.guild, matchId);

  // 部屋削除
  await deleteMatchChannel(message.guild, matchId);

  message.reply(`【${matchId}】の試合結果を登録しました`);
}

/**
 * 部屋削除
 * @param {*} guild
 * @param {*} matchId
 */
async function deleteMatchChannel(guild, matchId) {
  const matchDiscordInfo = await db.match_discord_info.findOne({
    where: { match_id: matchId }
  });
  if (matchDiscordInfo) {
    const category = guild.channels.find(c => c.id === matchDiscordInfo.category_id);
    if (category) {
      await category.children.forEach(async ch => await ch.delete());
      await category.delete();
    }
  }
}

/**
 * 結果をDBに保存
 * @param {*} isWin
 * @param {*} findMatch
 * @param {*} findMatchUser
 */
async function saveResult(isWin, findMatch, findMatchUser) {
  // 試合ステータス変更
  let updMatch = {
    match_id: findMatch.match_id,
    match_tier: findMatch.tier,
    status: matchConfig.status.closed
  };
  await db.matches.update(updMatch, {
    where: {
      match_id: findMatch.match_id
    }
  });

  let team = 0;
  if ((isWin && findMatchUser.team === 1) || (!isWin && findMatchUser.team === 0)) {
    team = 1;
  }

  // 試合結果登録
  await db.match_results.create({
    match_id: findMatch.match_id,
    win_team: team,
    match_date: Date.now()
  });
}

/**
 * 試合キャンセル
 * @param {*} message
 * @param {*} args
 */
async function cancelMatch(message, args) {
  const command = '!cancel';
  const paramsTitle = `!${command} 試合ID`;
  const example = `${command} 1024`;
  const exampleMessage = `${paramsTitle}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`試合IDを指定してください\n${exampleMessage}`);
    return;
  }

  const matchId = args[0];
  const findMatch = await db.matches.findOne({ where: { match_id: matchId } });
  if (!findMatch) {
    message.reply(`【${matchId}】は存在しません`);
    return;
  } else if (findMatch.status === matchConfig.status.closed) {
    message.reply(`【${matchId}】はすでに終了しています`);
    return;
  }

  // 管理者権限を持っていないユーザーは自分のエントリー試合のみキャンセルできる
  if (!message.member.hasPermission('ADMINISTRATOR')) {
    const containUser = await db.match_users.findOne({
      where: {
        match_id: matchId,
        discord_id: message.author.id
      }
    });
    if (!containUser) {
      message.reply(`【${matchId}】にエントリーしていません`);
      return;
    }
  }

  // 部屋削除
  await deleteMatchChannel(message.guild, matchId);

  // 試合ステータス変更
  let updMatch = {
    match_id: matchId,
    match_tier: findMatch.tier,
    status: matchConfig.status.cancel
  };
  await db.matches.update(updMatch, {
    where: {
      match_id: matchId
    }
  });

  message.reply(`【${matchId}】をキャンセルしました`);
}
