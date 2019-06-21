'use strict';

require('dotenv').config();
const match_config = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const discord = require('discord.js');

/**
 * 募集開始
 */
exports.open = (client, message) => {
  openMatch(message);
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
 * 試合キャンセルコマンド
 */
exports.cancel = (client, message, args) => {
  cancelMatch(message, args)
};

/**
 * 募集開始処理
 * @param {*} message 
 */
async function openMatch(message) {
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
    status: match_config.status.open
  })
    .then(match => {
      const role = message.guild.roles.get(tier.role_id);
      const embed = new discord.RichEmbed()
        .setColor('#0099ff')
        .setTitle(`${role.name}【${match.match_id}】`)
        .addField(match_config.embed.status, match_config.embed_status.open, true)
        .addField(match_config.embed.remaining, match_config.entry_size, true)
        .addField(match_config.embed.entry, match_config.entry_none);
      message.channel.send(embed)
        .then(async message => {
          await db.match_discord_info.create({
            match_id: match.match_id,
            message_id: message.id,
            category_id: null,
            waiting_text_ch_id: null,
            waiting_voice_ch_id: null,
            team0_text_ch_id: null,
            team0_voice_ch_id: null,
            team1_text_ch_id: null,
            team1_voice_ch_id: null
          });
          message.react(match_config.reaction_emoji);
        });
    })
    .catch(error => {
      console.error(error);
      message.reply('試合の登録中にエラーが発生しました');
    });
}

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

  const match_id = args[0];
  const findMatch = await db.matches.findOne({ where: {match_id: match_id}});
  if (!findMatch) {
    message.reply(`【${match_id}】は存在しません`);
    return;
  } else if (findMatch.status !== match_config.status.in_progress) {
    message.reply(`【${match_id}】は進行中ではありません`);
    return;
  }

  const findMatchUser = await db.match_users.findOne({
    where: {
      match_id: match_id,
      discord_id: message.author.id
    }
  });
  if (!findMatchUser) {
    message.reply(`【${match_id}】にエントリーしていません`);
    return;
  }

  // DB登録
  await saveResult(isWin, findMatch, findMatchUser);
  
  // 部屋削除
  const match_discord_info = await db.match_discord_info.findOne({where: {match_id: match_id}});
  if (match_discord_info) {
    const category = message.guild.channels.find(c => c.id === match_discord_info.category_id);
    await category.children.forEach(async ch => {
      await ch.delete();
    });
    await category.delete();
  }

  message.reply(`【${match_id}】の試合結果を登録しました`);
}

/**
 * 結果をDBに保存
 * @param {*} isWin 
 * @param {*} findMatch 
 * @param {*} findMatchUser 
 */
async function saveResult(isWin, findMatch, findMatchUser) {
  // 試合ステータス変更
  let upd_match = {
    match_id: findMatch.match_id,
    match_tier: findMatch.tier,
    status: match_config.status.closed
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
}

async function cancelMatch(message, args) {
  const command = '!cancel';
  const params_title = `!${command} 試合ID`;
  const example = `${command} 1024`;
  const example_message = `${params_title}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`試合IDを指定してください\n${example_message}`);
    return;
  }

  const match_id = args[0];
  const findMatch = await db.matches.findOne({ where: {match_id: match_id}});
  if (!findMatch) {
    message.reply(`【${match_id}】は存在しません`);
    return;
  } else if (findMatch.status === match_config.status.closed) {
    message.reply(`【${match_id}】はすでに終了しています`);
    return;
  }

  if (!message.member.hasPermission('ADMINISTRATOR')) {
    const containUser = await db.match_users.findOne({
      where: {
        match_id: match_id,
        discord_id: message.author.id
      }
    });
    if (!containUser) {
      message.reply(`【${match_id}】にエントリーしていません`);
      return;
    }
  }

  // 試合ステータス変更
  let upd_match = {
    match_id: match_id,
    match_tier: findMatch.tier,
    status: match_config.status.cancel
  };
  await db.matches.update(upd_match, {
    where: {
      match_id: match_id
    }
  });

  message.reply(`【${match_id}】をキャンセルしました`);
}