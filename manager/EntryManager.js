'use strict';

require('dotenv').config();
const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = matchConfig.reaction_emoji;
const _event_type_add = 'MESSAGE_REACTION_ADD';

const discord = require('discord.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

class EntryManager {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
   * エントリー処理
   * @param {*} client
   * @param {*} type
   * @param {*} data
   */
  static async entry(client, type, data) {
    // bot or 指定絵文字以外は中断
    const user = client.users.get(data.user_id);
    const guild = client.guilds.get(data.guild_id);
    if (user.bot) return;
    if (data.emoji.name !== _recruit_emoji) return;
    if (!guild) return;

    // 募集中の試合用Discord情報取得
    const matchDiscordInfo = await this.getOpenMatchDiscordInfo(data.message_id);
    if (!matchDiscordInfo) return;

    const channel = await client.channels.get(data.channel_id);
    const message = await channel.fetchMessage(data.message_id);
    const match = await db.matches.findOne({
      where: { match_id: matchDiscordInfo.match_id }
    });

    // エントリーチェック
    const reaction = message.reactions.find(r => r.emoji.name === data.emoji.name);
    if (type === _event_type_add) {
      // エントリー不可ならリアクション削除
      const isEnabled = await entryEnabled(channel, user, match, match.match_tier);
      if (!isEnabled) {
        if (reaction) await reaction.remove(user);
        return;
      }
    }

    // リアクションユーザー全取得
    let entryUsers = await getReactionUsers(guild, reaction);

    // リアクションユーザーのDB登録
    await updateMatchUsers(match.match_id, entryUsers.id);

    // Embed Field 設定
    const embed = message.embeds.shift();
    if (!embed) return;

    const new_embed = new discord.RichEmbed(embed);

    // Embed Field エントリー一覧
    let field_entry = new_embed.fields.find(f => f.name === matchConfig.embed_field.entry);
    if (entryUsers.name.length === 0) {
      field_entry.value = matchConfig.entry_none;
    } else {
      field_entry.value = entryUsers.name.join('\n');
    }

    // Embed Field 残り人数
    const entrySize = matchConfig.entry_size;
    const remaining = entrySize - entryUsers.name.length;
    let field_remaining = new_embed.fields.find(f => f.name === matchConfig.embed_field.remaining);
    field_remaining.value = remaining;

    // 募集人数に達した場合
    if (remaining <= 0) {
      let new_field_status = new_embed.fields.find(f => f.name === matchConfig.embed_field.status);
      new_field_status.value = matchConfig.embed_status.closed;

      // 試合通知
      notifyMatch(guild, channel, match, embed);

      // 試合ステータス変更
      changeMatchStatus(match, entryUsers.id);

      // 部屋作成
      createMatchChannel(guild, match, entryUsers.id);
    }
    // 募集メッセージ Embed の編集
    message.edit(new_embed);
  }

  /**
   * 試合にエントリーしている全ユーザー取得
   * @param {*} matchId
   */
  static async getEntryUsers(matchId) {
    return await db.match_users.findAll({
      where: {
        match_id: matchId
      }
    });
  }

  /**
   * 募集中の試合用Discord情報取得
   * @param {*} message_id
   */
  static async getOpenMatchDiscordInfo(message_id) {
    return await db.match_discord_info.findOne({
      where: {
        message_id: message_id
      },
      raw: true,
      include: [
        {
          model: db.matches,
          required: true,
          where: { status: matchConfig.status.open }
        }
      ]
    });
  }
}

/**
 * ユーザーがエントリー可能か？
 * @param {*} channel
 * @param {*} user
 * @param {*} match_id
 * @param {*} match_tier
 */
async function entryEnabled(channel, user, match_id, match_tier) {
  const userInfo = await db.users.findOne({ where: { discord_id: user.id } });
  if (!userInfo) {
    await channel.send(`<@${user.id}> 先にユーザー登録してください`);
    return false;
  }

  if (userInfo.tier !== match_tier) {
    await channel.send(`<@${user.id}> Tierが違います`);
    return false;
  }

  const matchUsers = await db.match_users.findAll({
    where: {
      discord_id: user.id
    },
    raw: true,
    include: [
      {
        model: db.matches,
        required: true,
        where: {
          match_id: {
            [Op.ne]: match_id
          },
          status: matchConfig.status.open
        }
      }
    ]
  });
  if (matchUsers.length > 0) {
    const mentions = matchUsers.map(matchUser => `【${matchUser.match_id}】`);
    await channel.send(
      `<@${user.id}> 他の試合でエントリー中です\nエントリー中：${mentions.join()}`
    );
    return false;
  }
  return true;
}

/**
 * リアクションユーザ－情報取得
 * @param {*} guild
 * @param {*} reaction
 */
async function getReactionUsers(guild, reaction) {
  let entryUsers = {
    id: [],
    name: []
  };

  if (reaction) {
    const reactionUsers = await reaction.fetchUsers();
    reactionUsers.forEach(user => {
      if (!user.bot) {
        entryUsers.id.push(user.id);
        entryUsers.name.push(guild.member(user).displayName);
      }
    });
  }

  return entryUsers;
}

/**
 * リアクションのユーザー一覧をDBに反映
 * @param {*} matchId
 * @param {*} entryUserIds
 */
async function updateMatchUsers(matchId, entryUserIds) {
  // リアクションが外れているユーザーを削除
  const matchUsers = await db.match_users.findAll({
    where: { match_id: matchId }
  });
  const deleteArray = matchUsers.filter(user => !entryUserIds.includes(user.discord_id));
  if (deleteArray) {
    for (let i = 0; i < deleteArray.length; i++) {
      await db.match_users.destroy({
        where: {
          match_id: matchId,
          discord_id: deleteArray[i].discord_id
        }
      });
    }
  }

  // リアクションがついたユーザーを登録
  for (let i = 0; i < entryUserIds.length; i++) {
    const matchUsers = await db.match_users.findOne({
      where: {
        match_id: matchId,
        discord_id: entryUserIds[i]
      }
    });
    if (!matchUsers) {
      await db.match_users.create({
        match_id: matchId,
        discord_id: entryUserIds[i],
        team: 0
      });
    }
  }
}

/**
 * 試合を通知する
 * @param {*} guild
 * @param {*} channel
 * @param {*} match
 * @param {*} embed
 */
async function notifyMatch(guild, channel, match, embed) {
  // チーム分け
  const teams = await chooseUpTeam(match.match_id);
  const blueFieldValue = getTeamPlayerFieldValue(guild, teams.blue);
  const orangeFieldValue = getTeamPlayerFieldValue(guild, teams.orange);

  // 試合情報、チーム情報のEmbedを作成
  const teamEmbed = new discord.RichEmbed()
    .setColor('#0099ff')
    .setTitle(embed.title)
    .addField(matchConfig.embed_field.team_blue, blueFieldValue, true)
    .addField(matchConfig.embed_field.team_orange, orangeFieldValue, true);

  // メンションでエントリーユーザーに通知
  channel.send(`${matchConfig.notification}`, { embed: teamEmbed });
}

/**
 * チーム分け
 * @param {*} matchId
 */
async function chooseUpTeam(matchId) {
  let teams = {
    blue: [],
    orange: []
  };

  // プレイヤーをレートの降順、勝数の降順、負数の昇順でソートする
  const players = await db.match_users.findAll({
    where: {
      match_id: matchId
    },
    raw: true,
    include: [
      {
        model: db.users,
        required: true
      }
    ],
    order: [[db.users, 'rate', 'DESC'], [db.users, 'win', 'DESC'], [db.users, 'lose', 'ASC']]
  });

  // 上から順にプレイヤーを分配していく
  if (players) {
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (i % 2 === 0) {
        // Blueにプレイヤー追加
        teams.blue.push(player);
        // DBに反映
        updateMatchPlayerTeam(player, matchConfig.team.blue);
      } else {
        // Orangeにプレイヤー追加
        teams.orange.push(player);
        // DBに反映
        updateMatchPlayerTeam(player, matchConfig.team.orange);
      }
    }
  }
  return teams;
}

/**
 * プレイヤーのチーム分け結果をDBに反映する
 * @param {*} player
 * @param {*} team
 */
function updateMatchPlayerTeam(player, team) {
  db.match_users.update(
    {
      match_id: player.match_id,
      discord_id: player.discord_id,
      team: team
    },
    {
      where: {
        match_id: player.match_id,
        discord_id: player.discord_id
      }
    }
  );
}

/**
 * チームプレイヤーのフィールド出力値取得
 * @param {*} guild
 * @param {*} players
 */
function getTeamPlayerFieldValue(guild, players) {
  if (players.length === 0) return '-';
  const mentions = players.map(player => `<@${player.discord_id}>`);
  return mentions.join('\n');
}

/**
 * 試合ステータス変更
 * @param {*} match
 * @param {*} entryUsersId
 */
async function changeMatchStatus(match, entryUsersId) {
  // ステータス更新
  let updMatch = {
    match_id: match.match_id,
    match_tier: match.tier,
    status: matchConfig.status.in_progress
  };
  await db.matches.update(updMatch, {
    where: {
      match_id: match.match_id
    }
  });
}

/**
 * 試合用のチャンネルを作成する
 * @param {*} guild
 * @param {*} match
 * @param {*} entryUsersId
 */
async function createMatchChannel(guild, match, entryUsersId) {
  const matchId = match.match_id;
  const tier = await db.tiers.findOne({ where: { tier: match.match_tier } });

  // カテゴリチャンネル作成
  const role = guild.roles.get(tier.role_id);
  const categoryChannel = await guild.createChannel(`${role.name}【${matchId}】`, {
    type: 'category',
    permissionOverwrites: [
      {
        id: guild.id,
        deny: ['VIEW_CHANNEL']
      }
    ]
  });

  // エントリーがあったプレイヤーの権限を設定する
  for (let i = 0; i < entryUsersId.length; i++) {
    const member = guild.members.get(entryUsersId[i]);
    await categoryChannel.overwritePermissions(member, {
      VIEW_CHANNEL: true
    });
  }

  // 試合用チャンネル情報を更新する
  let matchDiscordInfo = await db.match_discord_info.findOne({
    where: { match_id: matchId }
  });
  let updDiscordInfo = {
    match_id: matchDiscordInfo.match_id,
    message_id: matchDiscordInfo.id,
    category_id: categoryChannel.id
  };

  // 試合用チャンネルをカテゴリ内に作成
  let vc = null;

  // Waiting Room VoiceChannel
  vc = await createChannelInCategory(categoryChannel, `【${matchId}】WaitingRoom`);
  updDiscordInfo.waiting_voice_ch_id = vc.id;

  // Blue Team VoiceChannel
  vc = await createChannelInCategory(categoryChannel, `【${matchId}】Blue`);
  updDiscordInfo.team0_voice_ch_id = vc.id;

  // Orange Team VoiceChannel
  vc = await createChannelInCategory(categoryChannel, `【${matchId}】Orange`);
  updDiscordInfo.team1_voice_ch_id = vc.id;

  // DBに試合用チャンネル情報を登録
  db.match_discord_info.update(updDiscordInfo, {
    where: {
      match_id: matchId
    }
  });
}

/**
 * カテゴリにボイスチャンネルを作成する
 * @param {*} categoryChannel
 * @param {*} channelName
 */
async function createChannelInCategory(categoryChannel, channelName) {
  const voiceChannel = await categoryChannel.guild.createChannel(channelName, {
    type: 'voice'
  });
  await voiceChannel.setParent(categoryChannel);
  await voiceChannel.lockPermissions();
  return voiceChannel;
}

module.exports = EntryManager;
