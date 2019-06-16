'use strict';

const db = require(__dirname + '/../database/models/index.js');
const message_util = require(__dirname + '/../utils/message_util.js');

// ユーザー登録
exports.create = async (client, message, commandArgs) => {
  const search = await db.users.findOne({ where: {discord_id: message.author.id}});
  if (search) {
    message.reply('すでに登録済みです');
    return;
  }

  if (!commandArgs) {
    message.reply('Tierを指定してください');
    return;
  }

  const tier = await db.tiers.findOne({ where: {tier: commandArgs[0]}});
  if (!tier) {
    message.reply('正しいTierを指定してください');
    return;
  }

  db.users.create({
    discord_id: message.author.id,
    tier: tier.tier
  })
  .then(() => {
    message.reply('登録しました');
  })
  .catch(error => {
    console.error(error);
    message.reply('エラーが発生しました');
  });
};

// ユーザー削除
exports.delete = async (client, message) => {
  if (!message.member.hasPermission('ADMINISTRATOR')) {
    message.reply('管理者権限が必要です');
    return;
  }

  const mention_members = message.mentions.members;
  if (!mention_members) {
    message.reply('削除するユーザーのメンションをつけてください');
    return;
  }

  mention_members.forEach(async member => {
    const search = await db.users.findOne({ where: {discord_id: member.id}});
    const user_name = member.displayName;
    if (!search) {
      message.reply(`${user_name} は登録されていません`);
      return;
    }
  
    search.destroy()
    .then(() => {
      message.reply(`${user_name} を削除しました`);
    })
    .catch(error => {
      console.error(error);
      message.reply(`${user_name} の削除中にエラーが発生しました`);
    });
  });
};
