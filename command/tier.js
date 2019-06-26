'use strict';

const db = require(__dirname + '/../database/models/index.js');
const Util = require(__dirname + '/../util/Util.js');

/**
 * Tier登録コマンド
 */
exports.create = (client, message, args) => {
  createOrUpdate(true, message, args);
};

/**
 * Tier更新コマンド
 */
exports.update = (client, message, args) => {
  createOrUpdate(false, message, args);
};

/**
 * Tier登録・更新処理
 * @param {*} isCreate
 * @param {*} message
 * @param {*} args
 */
async function createOrUpdate(isCreate, message, args) {
  const cmd = isCreate ? 'add' : 'update';
  const paramsTitle = `!tier_${cmd} tierの数字 Tier名 レート最大値 レート中央値 レート最小値`;
  const example = `!tier_${cmd} 2 Tier2 5000 4000 3000`;
  const exampleMessage = `${paramsTitle}\n例\n${example}`;

  if (!message.member.hasPermission('ADMINISTRATOR')) {
    message.reply('管理者権限が必要です');
    return;
  }

  if (!args) {
    message.reply(`Tierの各パラメータを指定してください\n${exampleMessage}`);
    return;
  }

  if (args.length !== 5) {
    message.reply(
      `Tierのパラメータ数が一致しません\n※Tier名等に空白文字を入れないでください\n${exampleMessage}`
    );
    return;
  }

  const tierId = args[0];
  const search = await db.tiers.findOne({ where: { tier: tierId } });
  if (isCreate && search) {
    message.reply(`${tierId} はすでに登録されています`);
    return;
  } else if (!isCreate && !search) {
    message.reply(`${tierId} は登録されていません`);
    return;
  }

  // 役職設定
  setRole(isCreate, message, args, search);
}

/**
 * 役職設定
 * @param {*} isCreate
 * @param {*} message
 * @param {*} args [0]:Tier, [1]:Tier名, [2]:レート最大値, [3]:レート中央値, [4]:レート最小値
 * @param {*} search
 */
async function setRole(isCreate, message, args, search) {
  const guild = message.guild;
  const tierId = args[0];
  const tierName = args[1];
  const newTier = {
    tier: tierId,
    max_rate: args[2],
    init_rate: args[3],
    min_rate: args[4]
  };

  if (isCreate) {
    // 役職作成
    const role = await guild.createRole({ name: tierName });

    // チャンネル作成
    const categoryChannel = await guild.createChannel(`${role.name}`, {
      type: 'category',
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['VIEW_CHANNEL']
        },
        {
          id: role.id,
          allow: ['VIEW_CHANNEL']
        }
      ]
    });
    const [entryChannel, resultChannel] = await Promise.all([
      Util.createChannelInCategory(categoryChannel, 'エントリー', 'text'),
      Util.createChannelInCategory(categoryChannel, '試合結果', 'text')
    ]);

    // カテゴリチャンネルの並びをTierの位置に移動する
    categoryChannel.setPosition(tierId);

    // DB登録
    newTier.role_id = role.id;
    newTier.category_id = categoryChannel.id;
    newTier.entry_ch_id = entryChannel.id;
    newTier.result_ch_id = resultChannel.id;
    await db.tiers.create(newTier);
    message.reply(`${tierName} を登録しました`);
  } else {
    // 役職名更新
    const role = guild.roles.get(search.role_id);
    role.setName(tierName);

    // チャンネル名更新
    const tier = await db.tiers.findOne({ where: { tier: tierId } });
    const categoryChannel = guild.channels.get(tier.category_id);
    categoryChannel.setName(tierName);

    // DB更新
    newTier.role_id = role.id;
    await db.tiers.update(newTier, { where: { tier: newTier.tier } });
    message.reply(`${tierName} を更新しました`);
  }
}

/**
 * Tier削除コマンド
 */
exports.delete = async (client, message, args) => {
  if (!message.member.hasPermission('ADMINISTRATOR')) {
    message.reply('管理者権限が必要です');
    return;
  }

  const paramsTitle = '!tier_delete tierの数字';
  const example = '!tier_delete 2';
  const exampleMessage = `${paramsTitle}\n例\n${example}`;

  if (!args || args.length === 0) {
    message.reply(`Tierを指定してください\n${exampleMessage}`);
    return;
  }

  const search = await db.tiers.findOne({ where: { tier: args[0] } });
  if (!search) {
    message.reply(`${args[0]} は登録されていません`);
    return;
  }

  // DB削除
  const guild = message.guild;
  const role = guild.roles.get(search.role_id);
  const tierName = role.name;
  search.destroy();

  // チャンネル削除
  Util.deleteCategory(guild, search.category_id);

  // 役職削除
  await role.delete();
  message.reply(`${tierName} を削除しました`);
};
