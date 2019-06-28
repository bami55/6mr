'use strict';

const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const discord = require('discord.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

const EntryManager = require(__dirname + '/../manager/EntryManager.js');

exports.updateRating = async (guild, matchId) => {
  // 試合結果取得
  const result = await db.match_results.findOne({
    where: {
      match_id: matchId
    }
  });
  if (!result) return;

  // エントリー全ユーザー取得
  const users = await EntryManager.getEntryUsers(matchId);
  if (!users) return;

  // 報告用ユーザー取得
  let reportUsers = [];
  for (let i = 0; i < users.length; i++) {
    // ユーザー更新（Rate計算、Tier昇格・降格、役職付与）
    let reportUser = await updateUser(guild, result, users[i]);
    reportUsers.push(reportUser);
  }

  // 試合結果出力
  outputMatchResult(guild, result, reportUsers);
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
    team: user.team,
    mention: `<@${user.discord_id}>`,
    rate: null,
    tier: null
  };

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
    const [calcUser, changeRate] = calcRating(isWin, updUser);
    updUser = calcUser;

    // Tierチェンジ
    let resultChangeTier = await changeTier(guildMember, userInfo, updUser, reportResult);
    updUser = resultChangeTier.updUser;
    reportResult = resultChangeTier.reportResult;

    db.users.update(updUser, {
      where: {
        discord_id: updUser.discord_id
      }
    });

    // レート変動出力
    if (isWin) {
      reportResult.rate = `${updUser.rate} (+${changeRate})`;
    } else {
      reportResult.rate = `${updUser.rate} (-${changeRate})`;
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
  let changeRate = 0;
  if (isWin) {
    changeRate = matchConfig.rate.win + updUser.streak * matchConfig.rate.streak;
    updUser.rate += changeRate;
    updUser.win += 1;
    updUser.streak += 1;
  } else {
    changeRate = matchConfig.rate.lose;
    updUser.rate -= changeRate;
    updUser.lose += 1;
    updUser.streak = 0;
  }
  return [updUser, changeRate];
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
    updUser.streak = 0;
    await guildMember.removeRole(oldTierRole);
    await guildMember.addRole(newTierRole);
    const updownEmoji =
      userInfo.rate < updUser.rate ? matchConfig.updown_emoji.up : matchConfig.updown_emoji.down;
    reportResult.tier = `${newTierRole.name} ${updownEmoji}`;
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

/**
 * 特定のチャンネルに試合結果、レート変動を出力する
 * @param {*} guild
 * @param {*} result
 */
async function outputMatchResult(guild, result, reportUsers) {
  const matchId = result.match_id;
  const matchFieldTitle = matchConfig.embed_field_title.match;
  let teamName = {
    blue: matchFieldTitle.team_blue,
    orange: matchFieldTitle.team_orange
  };
  let color = 0;

  if (result.win_team === matchConfig.team.blue) {
    color = matchConfig.embed_color.blue;
    teamName.blue = `${matchConfig.winner_emoji} ${teamName.blue}`;
  } else {
    color = matchConfig.embed_color.orange;
    teamName.orange = `${matchConfig.winner_emoji} ${teamName.orange}`;
  }

  const embed = new discord.RichEmbed().setColor(color).setTitle(`試合結果【${matchId}】`);
  const outputs = [
    {
      team: teamName.blue,
      user: reportUsers.filter(f => f.team === matchConfig.team.blue)
    },
    {
      team: teamName.orange,
      user: reportUsers.filter(f => f.team === matchConfig.team.orange)
    }
  ];
  outputs.forEach(op => {
    let players = [];
    op.user.forEach(user => {
      players.push(`${user.mention}\n${user.tier}\n${user.rate}`);
    });
    if (players.length === 0) players.push('-');
    embed.addField(op.team, `${players.join('\n\n')}`, true);
  });

  const match = await db.matches.findOne({ where: { match_id: matchId } });
  const tier = await db.tiers.findOne({ where: { tier: match.match_tier } });
  const channel = guild.channels.get(tier.result_ch_id);
  channel.send(embed);
}
