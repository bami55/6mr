'use strict';

const db = require(__dirname + '/../database/models/index.js');

// ユーザー登録
exports.create = async (client, message) => {
  const search = await db.users.findOne({ where: {discord_id: message.author.id}});
  if (search) {
    message.reply('すでに登録済みです');
    return;
  }

  db.users.create({
    discord_id: message.author.id,
    tier: 4
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
  const search = await db.users.findOne({ where: {discord_id: message.author.id}});
  if (!search) {
    message.reply('登録されていません');
    return;
  }

  search.destroy()
  .then(() => {
    message.reply('削除しました');
  })
  .catch(error => {
    console.error(error);
    message.reply('エラーが発生しました');
  });
};