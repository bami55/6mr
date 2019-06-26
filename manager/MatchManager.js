'use strict';

const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const rating = require(__dirname + '/../util/rating.js');
const Util = require(__dirname + '/../util/util.js');
const discord = require('discord.js');

class MatchManager {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
   * 募集開始処理
   * @param {*} message
   */
  static async openMatch(message) {
    const tier = await db.tiers.findOne({ where: { entry_ch_id: message.channel.id } });
    if (!tier) {
      message.reply('エントリーチャンネルで入力してください');
      return;
    }

    const user = await db.users.findOne({
      where: { discord_id: message.author.id }
    });
    if (!user) {
      message.reply('先にユーザー登録してください');
      return;
    }

    // 試合データ作成
    createOpenMatch(message.channel, tier);
  }

  /**
   * 試合結果報告処理
   * @param {*} isWin
   * @param {*} message
   * @param {*} args
   */
  static async report(isWin, message, args) {
    const tier = await db.tiers.findOne({ where: { result_ch_id: message.channel.id } });
    if (!tier) {
      message.reply('試合結果チャンネルで入力してください');
      return;
    }

    const command = isWin ? '!win' : '!lose';
    const exampleMessage = `${command} 試合ID\n例\n${command} 1024`;

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
    rating.updateRating(message.guild, matchId);

    // 部屋削除
    deleteMatchChannel(message.guild, matchId);

    message.reply(`【${matchId}】の試合結果を登録しました`);
  }

  /**
   * 試合キャンセル
   * @param {*} message
   * @param {*} args
   */
  static async cancelMatch(message, args) {
    const tier = await db.tiers.findOne({ where: { result_ch_id: message.channel.id } });
    if (!tier) {
      message.reply('試合結果チャンネルで入力してください');
      return;
    }

    const command = '!cancel';
    const exampleMessage = `${command} 試合ID\n例\n${command} 1024`;

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

    // 募集終了
    const matchDiscordInfo = await db.match_discord_info.findOne({ where: { match_id: matchId } });
    const guild = message.guild;
    const entryChannel = guild.channels.get(tier.entry_ch_id);
    const entryMessage = await entryChannel.fetchMessage(matchDiscordInfo.message_id);
    const embed = entryMessage.embeds.shift();
    const new_embed = new discord.RichEmbed(embed);
    const fieldTitle = matchConfig.embed_field_title.entry;
    const fieldValue = matchConfig.embed_field_value.entry;
    let new_field_status = new_embed.fields.find(f => f.name === fieldTitle.status);
    new_field_status.value = fieldValue.status.closed;
    new_embed.color = parseInt(matchConfig.embed_color.closed.replace(/#/gi, ''), 16);
    entryMessage.edit(new_embed);

    // 部屋削除
    deleteMatchChannel(message.guild, matchId);

    // 試合ステータス変更
    let updMatch = {
      match_id: matchId,
      match_tier: findMatch.tier,
      status: matchConfig.status.cancel
    };
    db.matches.update(updMatch, {
      where: {
        match_id: matchId
      }
    });

    message.reply(`【${matchId}】をキャンセルしました`);
  }
}

/**
 * 試合データ作成
 * @param {*} channel
 * @param {*} tier
 */
async function createOpenMatch(channel, tier) {
  // 試合データ登録
  const maxMatchId = await db.matches.max('match_id');
  const match = await db.matches.create({
    match_id: maxMatchId + 1,
    match_tier: tier.tier,
    status: matchConfig.status.open
  });

  // 募集メッセージ作成
  const role = channel.guild.roles.get(tier.role_id);
  const fieldTitle = matchConfig.embed_field_title.entry;
  const fieldValue = matchConfig.embed_field_value.entry;
  const embed = new discord.RichEmbed()
    .setColor(matchConfig.embed_color.entry)
    .setTitle(`${role.name}【${match.match_id}】`)
    .addField(fieldTitle.status, fieldValue.status.open, true)
    .addField(fieldTitle.remaining, fieldValue.remaining.entry_size, true)
    .addField(fieldTitle.entry, fieldValue.entry.entry_none);

  // 募集メッセージ送信
  const message = await channel.send(embed);

  // エントリー用のリアクションをつけておく
  message.react(matchConfig.reaction_emoji);

  // 試合用Discord情報登録
  db.match_discord_info.create({
    match_id: match.match_id,
    message_id: message.id
  });
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
  if (matchDiscordInfo) Util.deleteCategory(guild, matchDiscordInfo.category_id);
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

module.exports = MatchManager;
