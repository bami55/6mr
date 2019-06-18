'use strict';

require('dotenv').config();
const db = require(__dirname + '/../database/models/index.js');
const discord = require('discord.js');

/**
 * 募集開始
 */
exports.open = async (client, message) => {
  const discord_id = message.author.id;
  const user = await db.users.findOne({ where: {discord_id: message.author.id}});
  if (!user) {
    message.reply('先にユーザー登録してください');
    return;
  }

  const tier = await db.tiers.findOne({ where: { tier: user.tier } });
  if (!tier) {
    message.reply('ユーザーのTierが不正です');
    return;
  }

  const max_match_id = await db.matches.max('match_id');

  db.matches.create({
    match_id: max_match_id + 1,
    match_tier: tier.tier,
    status: 0
  })
  .then(m => {
    const embed = new discord.RichEmbed()
      .setColor('#0099ff')
      .setTitle(process.env.RECRUIT_TITLE)
      .addField(process.env.RECRUIT_FIELD_ID, m.match_id, true)
      .addField(process.env.RECRUIT_FIELD_TIER, tier.tier_name, true)
      .addField(process.env.RECRUIT_FIELD_SIZE, process.env.RECRUIT_SIZE, true)
      .addField(process.env.RECRUIT_FIELD_STATUS, process.env.RECRUIT_START, true)
      .addField(process.env.RECRUIT_FIELD_ENTRY, process.env.ENTRY_NONE);
    message.channel.send(embed)
    .then(async message => {
      await db.match_discord_info.create({
        match_id: m.match_id,
        message_id: message.id,
        role_id: null,
        category_id: null,
        waiting_text_ch_id: null,
        waiting_voice_ch_id: null,
        team0_text_ch_id: null,
        team0_voice_ch_id: null,
        team1_text_ch_id: null,
        team1_voice_ch_id: null
      });
      message.react(process.env.RECRUIT_EMOJI);
    });
  })
  .catch(error => {
    console.error(error);
    message.reply('試合の登録中にエラーが発生しました');
  });
}

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
  report(false, message, args)
};

/**
 * 試合結果報告処理
 * @param {*} isWin 
 * @param {*} message 
 * @param {*} args 
 */
async function report (isWin, message, args) {
  const command = isWin ? '!win' : '!lose';
  const params_title = `!${command} 試合ID`;
  const example = `${command} 1024`;
  const example_message = `${params_title}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`試合IDを指定してください\n${example_message}`);
    return;
  }

  const findMatch = await db.matches.findOne({ where: {match_id: args[0]}});
  if (!findMatch) {
    message.reply(`試合ID : ${args[0]} は存在しません`);
    return;
  } else if (findMatch.status !== 2) {
    message.reply(`この試合は進行中ではありません`);
    return;
  }

  const findMatchUser = await db.match_users.findOne({
    where: {
      match_id: args[0],
      discord_id: message.author.id
    }
  });
  if (!findMatchUser) {
    message.reply(`試合ID : ${args[0]} にユーザー情報が存在しません`);
    return;
  }

  // 試合ステータス変更
  let upd_match = {
    match_id: findMatch.match_id,
    match_tier: findMatch.tier,
    status: 9
  };
  await db.matches.update(upd_match, {
    where: {
      match_id: findMatch.match_id
    }
  });
  
  let team = 0;
  if ((isWin && findMatchUser.team === 1) || (!isWin && findMatchUser.team === 0)) {
    team = 1;
  }
  console.log(`isWin ${isWin}`);
  console.log(`Team ${team}`);

  // 試合結果登録
  await db.match_results.upsert({
    match_id: findMatch.match_id,
    win_team: team,
    match_date: Date.now()
  });

  // 部屋削除
  // 役職削除

  message.reply('結果登録を完了しました');
}