'use strict';

require('dotenv').config();
const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
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
    const user = await db.users.findOne({
      where: { discord_id: message.author.id }
    });
    if (!user) {
      message.reply('先にユーザー登録してください');
      return;
    }

    const tier = await db.tiers.findOne({ where: { tier: user.tier } });
    if (!tier) {
      message.reply('ユーザーのTierが不正です');
      return;
    }

    // 試合データ作成
    createOpenMatch(message.channel, tier);
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

module.exports = MatchManager;
