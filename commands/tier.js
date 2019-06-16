'use strict';

const db = require(__dirname + '/../database/models/index.js');

/*
 * Tier登録コマンド
 */
exports.create = (client, message, args) => {
  createOrUpdate(true, message, args)
};

/*
 * Tier更新コマンド
 */
exports.update = (client, message, args) => {
  createOrUpdate(false, message, args)
};

/*
 * Tier登録・更新処理
 */
async function createOrUpdate(isCreate, message, args) {
  const cmd = isCreate ? 'add' : 'update';
  const params_title = `!tier_${cmd} tierの数字 Tier名 レート最大値 レート中央値 レート最小値`;
  const example = `!tier_${cmd} 2 Tier2 5000 4000 3000`;
  const example_message = `${params_title}\n例\n${example}`;

  if (!message.member.hasPermission('ADMINISTRATOR')) {
    message.reply('管理者権限が必要です');
    return;
  }
  
  if (!args) {
    message.reply(`Tierの各パラメータを指定してください\n${example_message}`);
    return;
  }

  if (args.length !== 5) {
    message.reply(`Tierのパラメータ数が一致しません\n※Tier名等に空白文字を入れないでください\n${example_message}`);
    return;
  }

  const search = await db.tiers.findOne({ where: {tier: args[0]}});
  if (isCreate && search) {
    message.reply(`${args[0]} はすでに登録されています`);
    return;
  } else if (!isCreate && !search) {
    message.reply(`${args[0]} は登録されていません`);
    return;
  }

  const new_tier = {
    tier: args[0],
    tier_name: args[1],
    max_rate: args[2],
    median_rate: args[3],
    min_rate: args[4],
  };

  if (isCreate) {
    db.tiers.create(new_tier)
    .then(() => {
      message.reply(`${new_tier.tier_name} を登録しました`);
    })
    .catch(error => {
      console.error(error);
      message.reply(`${new_tier.tier_name} の登録中にエラーが発生しました`);
    });
  } else {
    db.tiers.update(new_tier, {
      where: {
        tier: new_tier.tier
      }
    })
    .then(() => {
      message.reply(`${new_tier.tier_name} を更新しました`);
    })
    .catch(error => {
      console.error(error);
      message.reply(`${new_tier.tier_name} の更新中にエラーが発生しました`);
    });
  }
}

// Tier削除コマンド
exports.delete = async (client, message, args) => {

  if (!message.member.hasPermission('ADMINISTRATOR')) {
    message.reply('管理者権限が必要です');
    return;
  }
  
  const params_title = '!tier_delete tierの数字';
  const example = '!tier_delete 2';
  const example_message = `${params_title}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`Tierを指定してください\n${example_message}`);
    return;
  }

  const search = await db.tiers.findOne({ where: {tier: args[0]}});
  if (!search) {
    message.reply(`${args[0]} は登録されていません`);
    return;
  }

  search.destroy()
  .then(() => {
    message.reply(`${search.tier_name} を削除しました`);
  })
  .catch(error => {
    console.error(error);
    message.reply(`${search.tier_name} の削除中にエラーが発生しました`);
  });
};
