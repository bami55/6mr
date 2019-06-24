"use strict";

const matchConfig = require(__dirname + "/../config/match.json");
const db = require(__dirname + "/../database/models/index.js");
const Sequelize = require("sequelize");
const Op = Sequelize.Op;

exports.updateRating = async (guild, matchId) => {
  // 試合結果取得
  const result = await db.match_results.findOne({
    where: {
      match_id: matchId
    }
  });
  if (!result) return;

  // エントリー全ユーザー取得
  const users = await db.match_users.findAll({
    where: {
      match_id: matchId
    }
  });
  if (!users) return;

  // 報告用ユーザー取得
  let reportUsers = [];
  for (let i = 0; i < users.length; i++) {
    // ユーザー更新（Rate計算、Tier昇格・降格、役職付与）
    let reportUser = await updateUser(guild, result, users[i]);
    reportUsers.push(reportUser);
  }

  // TODO: 特定のチャンネルに試合結果、レート変動を出力する
};

/**
 * ユーザー更新
 * @param {*} guild
 * @param {*} result
 * @param {*} user
 */
async function updateUser(guild, result, user) {
  const guildMember = await guild.fetchMember(user.discord_id);
  const userInfo = await db.users.findOne({
    where: { discord_id: user.discord_id }
  });

  // 結果出力用
  let reportResult = {
    name: null,
    rate: null,
    tier: null
  };
  reportResult.name = guildMember.displayName;

  let updUser = {
    discord_id: userInfo.discord_id,
    tier: userInfo.tier,
    rate: userInfo.rate,
    win: userInfo.win,
    lose: userInfo.lose,
    streak: userInfo.streak
  };

  let isWin = result.win_team === user.team;

  if (userInfo) {
    // レート計算
    updUser = calcRating(isWin, updUser);

    console.log(updUser);

    // Tierチェンジ
    let resultChangeTier = await changeTier(
      guildMember,
      userInfo,
      updUser,
      reportResult
    );
    updUser = resultChangeTier.updUser;
    reportResult = resultChangeTier.reportResult;

    await db.users.update(updUser, {
      where: {
        discord_id: updUser.discord_id
      }
    });

    // レート変動出力
    if (isWin) {
      reportResult.rate = `${updUser.rate} (+${matchConfig.rate.win})`;
    } else {
      reportResult.rate = `${updUser.rate} (-${matchConfig.rate.lose})`;
    }
  }

  // 結果出力用データ返却
  return reportResult;
}

/**
 * レート計算
 * @param {*} isWin
 * @param {*} updUser
 */
function calcRating(isWin, updUser) {
  if (isWin) {
    updUser.rate += matchConfig.rate.win;
    updUser.win += 1;
    updUser.streak += 1;
  } else {
    updUser.rate -= matchConfig.rate.lose;
    updUser.lose += 1;
    updUser.streak = 0;
  }
  return updUser;
}

/**
 * Tierチェンジ（Tier昇格・降格、役職設定）
 * @param {*} guildMember
 * @param {*} userInfo
 * @param {*} updUser
 * @param {*} reportResult
 */
async function changeTier(guildMember, userInfo, updUser, reportResult) {
  // Tierデータ取得
  const oldTier = await getTierByRate(userInfo.rate);
  const newTier = await getTierByRate(updUser.rate);

  // Tier役職取得
  const oldTierRole = await guildMember.guild.roles.get(oldTier.role_id);
  const newTierRole = await guildMember.guild.roles.get(newTier.role_id);

  if (newTier.tier !== oldTier.tier) {
    // Tier変更
    updUser.tier = newTier.tier;
    updUser.rate = newTier.init_rate;
    await guildMember.removeRole(oldTierRole);
    await guildMember.addRole(newTierRole);
    reportResult.tier = `${oldTierRole.name} -> ${newTierRole.name}`;
  } else {
    // Tier維持
    reportResult.tier = oldTierRole.name;
  }
  return {
    updUser: updUser,
    reportResult: reportResult
  };
}

/**
 * レートに該当するTierを取得
 * @param {*} rate
 */
async function getTierByRate(rate) {
  const tier = await db.tiers.findOne({
    where: {
      max_rate: {
        [Op.gte]: rate
      },
      min_rate: {
        [Op.lte]: rate
      }
    }
  });
  return tier;
}
