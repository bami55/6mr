"use strict";

require("dotenv").config();
const matchConfig = require(__dirname + "/../config/match.json");
const db = require(__dirname + "/../database/models/index.js");
const discord = require("discord.js");

/**
 * 募集開始
 */
exports.open = (client, message) => {
  openMatch(message);
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
 * 募集開始処理
 * @param {*} message
 */
async function openMatch(message) {
  const user = await db.users.findOne({
    where: { discord_id: message.author.id }
  });
  if (!user) {
    message.reply("先にユーザー登録してください");
    return;
  }

  const tier = await db.tiers.findOne({ where: { tier: user.tier } });
  if (!tier) {
    message.reply("ユーザーのTierが不正です");
    return;
  }

  const maxMatchId = await db.matches.max("match_id");

  // 試合データ登録
  db.matches
    .create({
      match_id: maxMatchId + 1,
      match_tier: tier.tier,
      status: matchConfig.status.open
    })
    .then(match => {
      // 募集メッセージ送信
      const role = message.guild.roles.get(tier.role_id);
      const embed = new discord.RichEmbed()
        .setColor("#0099ff")
        .setTitle(`${role.name}【${match.match_id}】`)
        .addField(matchConfig.embed.status, matchConfig.embed_status.open, true)
        .addField(matchConfig.embed.remaining, matchConfig.entry_size, true)
        .addField(matchConfig.embed.entry, matchConfig.entry_none);
      message.channel.send(embed).then(async message => {
        // 試合用Discord情報登録
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
        message.react(matchConfig.reaction_emoji);
      });
    })
    .catch(error => {
      console.error(error);
      message.reply("試合の登録中にエラーが発生しました");
    });
}

/**
 * 試合結果報告処理
 * @param {*} isWin
 * @param {*} message
 * @param {*} args
 */
async function report(isWin, message, args) {
  const command = isWin ? "!win" : "!lose";
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

  // 部屋削除
  const matchDiscordInfo = await db.match_discord_info.findOne({
    where: { match_id: matchId }
  });
  if (matchDiscordInfo) {
    const category = message.guild.channels.find(
      c => c.id === matchDiscordInfo.category_id
    );
    await category.children.forEach(async ch => {
      await ch.delete();
    });
    await category.delete();
  }

  message.reply(`【${matchId}】の試合結果を登録しました`);
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
  if (
    (isWin && findMatchUser.team === 1) ||
    (!isWin && findMatchUser.team === 0)
  ) {
    team = 1;
  }

  // 試合結果登録
  await db.match_results.upsert({
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
  const command = "!cancel";
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
  if (!message.member.hasPermission("ADMINISTRATOR")) {
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
