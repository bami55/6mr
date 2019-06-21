'use strict';

const match_config = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');

exports.updateRating = async (guild, matchId) => {
  const result = await db.match_results.findOne({
    where: {
      match_id: matchId
    }
  });
  if (!result) return;

  const users = await db.match_users.findAll({
    where: {
      match_id: matchId
    }
  });
  if (!users) return;

  // ユーザー更新（Rate計算、Tier昇格・降格、役職付与）
  let reportUsers = [];
  for (let i = 0; i < users.length; i++) {
    reportUsers.push(await updateUser(guild, result, users[i]));
  }
}

/**
 * ユーザー更新
 * @param {*} guild 
 * @param {*} result 
 * @param {*} user 
 */
async function updateUser(guild, result, user) {
  const guildMember = await guild.fetchMember(user.discord_id);
  const userInfo = await db.users.findOne({ where: { discord_id: user.discord_id } });

  // 結果出力用
  let reportResult = {
    name: null,
    rate: null,
    tier: null
  };
  reportResult.name = guildMember.displayName;
  
  let updUser = Object.assign({}, userInfo);
  if (userInfo) {
    // レート計算
    if (result.win_team === user.team) {
      updUser.rate += match_config.rate.win;
      updUser.win += 1;
      updUser.streak += 1;
      reportResult.rate = `${updUser.rate} (+${match_config.rate.win})`;
    } else {
      updUser.rate -= match_config.rate.lose;
      updUser.lose += 1;
      updUser.streak = 0;
      reportResult.rate = `${updUser.rate} (-${match_config.rate.lose})`;
    }

    // Tierチェンジ
    const oldTier = getTierByRate(userInfo.rate);
    const newTier = getTierByRate(updUser.rate);
    const oldTierRole = await guild.roles.get(oldTier);
    const newTierRole = await guild.roles.get(newTier);
    if (newTier.tier !== oldTier.tier) {
      updUser.tier = newTier.tier;
      await guildMember.removeRole(oldTier.role_id);
      await guildMember.addRole(newTier.role_id);
      reportResult.tier = `${oldTierRole.name} -> ${newTierRole.name}`;
    } else {
      reportResult.tier = oldTierRole.name;
    }
  }
  return reportResult;
}

/**
 * レートに該当するTierを取得
 * @param {*} rate 
 */
async function getTierByRate(rate) {
  const tier = await db.tiers.findOne({
    where: {
      max_rate: {
        $lte: rate
      },
      min_rate: {
        $gte: rate
      }
    }
  });
  return tier;
}