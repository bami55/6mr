"use strict";

const db = require(__dirname + "/../database/models/index.js");

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
  const cmd = isCreate ? "add" : "update";
  const paramsTitle = `!tier_${cmd} tierの数字 Tier名 レート最大値 レート中央値 レート最小値`;
  const example = `!tier_${cmd} 2 Tier2 5000 4000 3000`;
  const exampleMessage = `${paramsTitle}\n例\n${example}`;

  if (!message.member.hasPermission("ADMINISTRATOR")) {
    message.reply("管理者権限が必要です");
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
function setRole(isCreate, message, args, search) {
  const tierName = args[1];
  const newTier = {
    tier: args[0],
    role_id: null,
    max_rate: args[2],
    median_rate: args[3],
    min_rate: args[4]
  };

  if (isCreate) {
    // 役職作成
    message.guild
      .createRole({
        name: tierName
      })
      .then(role => {
        message.reply(`${tierName} の役職を作成しました`);
        newTier.role_id = role.id;

        // DB登録
        db.tiers
          .create(newTier)
          .then(() => {
            message.reply(`${tierName} を登録しました`);
          })
          .catch(error => {
            console.error(error);
            message.reply(`${tierName} の登録中にエラーが発生しました`);
          });
      })
      .catch(error => {
        console.error(error);
        message.reply(`${tierName} の役職作成中にエラーが発生しました`);
      });
  } else {
    // 役職更新
    const role = message.guild.roles.get(search.role_id);
    role
      .setName(tierName)
      .then(() => {
        // DB更新
        newTier.role_id = role.id;
        db.tiers
          .update(newTier, {
            where: {
              tier: newTier.tier
            }
          })
          .then(() => {
            message.reply(`${tierName} を更新しました`);
          })
          .catch(error => {
            console.error(error);
            message.reply(`${tierName} の更新中にエラーが発生しました`);
          });
      })
      .catch(error => {
        console.error(error);
        message.reply(`${tierName} の役職名設定中にエラーが発生しました`);
      });
  }
}

/**
 * Tier削除コマンド
 */
exports.delete = async (client, message, args) => {
  if (!message.member.hasPermission("ADMINISTRATOR")) {
    message.reply("管理者権限が必要です");
    return;
  }

  const paramsTitle = "!tier_delete tierの数字";
  const example = "!tier_delete 2";
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
  const role = message.guild.roles.get(search.role_id);
  const tierName = role.name;
  search
    .destroy()
    .then(() => {
      message.reply(`${tierName} を削除しました`);

      // 役職削除
      role
        .delete()
        .then(() => {
          message.reply(`${tierName} の役職を削除しました`);
        })
        .catch(error => {
          message.reply(`${tierName} の役職削除中にエラーが発生しました`);
        });
    })
    .catch(error => {
      console.error(error);
      message.reply(`${tierName} の削除中にエラーが発生しました`);
    });
};
