'use strict';

require('dotenv').config();
const match_config = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = match_config.reaction_emoji;

const discord = require('discord.js');

exports.recruit = async (client, event) => {
  const { t: type, d: data } = event;

  const match_disco_info = await db.match_discord_info.findOne({ where: { message_id: data.message_id } });
  if (!match_disco_info) return;

  const match = await db.matches.findOne({ where: { match_id: match_disco_info.match_id } });
  const match_tier = match.tier_id;

  // bot or 指定絵文字以外は中断
  const user = client.users.get(data.user_id);
  if (data.emoji.name !== _recruit_emoji) return;
  if (user.bot) return;

  const guild = client.guilds.get(data.guild_id);
  if (!guild) return;
  
  const channel = client.channels.get(data.channel_id) || await user.createDM();
  const message = await channel.fetchMessage(data.message_id);
  const embed = message.embeds.shift();
  if (!embed) return;
  
  // すでに募集が終了していたら中断
  const field_status = embed.fields.find(e => e.name === match_config.embed.status);
  if (embed.title !== match_config.embed.title || 
      field_status.value === match_config.embed_status.closed) {
    return;
  }

  // エントリーチェック
  const isEnabled = await entryEnabled(channel, user, match_tier);
  if (!isEnabled) return;

  // リアクションユーザー全取得
  let entry_users = {
    user: [],
    id: [],
    name: [],
    mention: []
  };
  const reaction = message.reactions.find(r => r.emoji.name === data.emoji.name);
  if (reaction) {
    const reaction_users = await reaction.fetchUsers();
    reaction_users.forEach(user => {
      if (!user.bot) {
        entry_users.user.push(user);
        entry_users.id.push(user.id);
        entry_users.name.push(guild.member(user).displayName);
        entry_users.mention.push(`<@${user.id}>`);
      }
    });
  }

  // リアクションユーザーのDB登録
  updateMatchUsers(entry_users);

  // エントリーユーザーの表示
  const new_embed = new discord.RichEmbed(embed);
  let field_entry = new_embed.fields.find(e => e.name === match_config.embed.entry);
  if (entry_users.name.length === 0) {
    field_entry.value = match_config.entry_none;
  } else {
    field_entry.value = entry_users.name.join("\n");
  }

  // エントリー数が募集人数に達した場合
  const entry_size = match_config.entry_size;
  if (entry_size <= entry_users.name.length) {
    let new_field_status = new_embed.fields.find(e => e.name === match_config.embed.status);
    new_field_status.value = match_config.embed_status.closed;

    // メンションでエントリーユーザーに通知
    channel.send(`${entry_users.mention.join(' ')}\n${match_config.notification}`);

    // 試合ステータス変更
    await changeMatchStatus(match, entry_users.id);

    // 部屋作成
    await createMatchChannel(guild, match, entry_users.id);

    // 役職設定
  }
  message.edit(new_embed);
};

/**
 * ユーザーがエントリー可能か？
 * @param {*} channel 
 * @param {*} user 
 * @param {*} match_tier 
 */
async function entryEnabled(channel, user, match_tier) {

  const user_info = db.users.findOne({ where: { discord_id: user.id } });
  if (!user_info) {
    await channel.send(`<@${user.id}> 先にユーザー登録してください`);
    return false;
  }

  if (user_info.tier !== match_tier) {
    await channel.send(`<@${user.id}> Tierが違います`);
    return false;
  }

  const match_users = db.match_users.findAll({
    where: {
      discord_id: user.id
    },
    raw: true,
    include: [
      {
        model: db.matches,
        required: true,
        where: { status: match_config.status.open }
      }
    ]
  });
  if (match_users.length > 0) {
    await channel.send(`<@${user.id}> 他の試合でエントリー中です`);
    return false;
  }
  return true;
}

async function updateMatchUsers(matchId, entryUsers) {
  const m_users = await db.match_users.findAll({ where: { match_id: matchId } });
  const deleteArray = m_users.filter(mu => !entryUsers.id.includes(mu.discord_id));
  if (deleteArray) {
    for (let i = 0; i < deleteArray.length; i++) {
      await db.match_users.destroy({ where: { discord_id: deleteArray[i] } });
    }
  }

  for (let i = 0; i < entryUsers.id.length; i++) {
    const mu = db.match_users.find({ where: { discord_id: entryUsers.id[i] } });
    if (!mu) {
      await db.match_users.insert({
        match_id: matchId,
        discord_id: entryUsers.id[i],
        team: 0
      });
    }
  }
}

/**
 * 試合ステータス変更
 * @param {*} match 
 * @param {*} entry_users_id 
 */
async function changeMatchStatus(match, entry_users_id) {
  
  // ステータス更新
  let upd_match = {
    match_id: match.match_id,
    match_tier: match.tier,
    status: match_config.status.in_progress
  };
  await db.matches.update(upd_match, {
    where: {
      match_id: match.match_id
    }
  });

  // match_users 登録
  // await entry_users_id.forEach(async userId => {
  //   await db.match_users.upsert({
  //     match_id: match.match_id,
  //     discord_id: userId,
  //     team: 0
  //   });
  // }); 
}

/**
 * 試合用のチャンネルを作成する
 * @param {*} guild 
 * @param {*} match 
 * @param {*} entry_users_id 
 */
async function createMatchChannel(guild, match, entry_users_id) {
  const match_id = match.match_id;
  const tier = await db.tiers.findOne({ where: { tier: match.match_tier } });
  
  // カテゴリチャンネル作成
  const role = guild.roles.get(tier.role_id);
  const categoryChannel = await guild.createChannel(`${role.name}【${match_id}】`, {
    type: 'category',
    permissionOverwrites: [{
      id: guild.id,
      deny: ['VIEW_CHANNEL']
    }]
  });

  // エントリーがあったプレイヤーの権限を設定する
  for (let i = 0; i < entry_users_id.length; i++) {
    const member = guild.members.get(entry_users_id[i]);
    await categoryChannel.overwritePermissions(member, {
      VIEW_CHANNEL: true
    });
  }
  
  // 試合用チャンネル情報を更新する
  let match_discord_info = await db.match_discord_info.findOne({ where: { match_id: match_id } });
  let upd_discord_info = {
    match_id: match_discord_info.match_id,
    message_id: match_discord_info.id,
    category_id: categoryChannel.id,
    waiting_text_ch_id: null,
    waiting_voice_ch_id: null,
    team0_text_ch_id: null,
    team0_voice_ch_id: null,
    team1_text_ch_id: null,
    team1_voice_ch_id: null
  };
  
  // 試合用チャンネルをカテゴリ内に作成
  let vc = null;
  vc = await createChannelInCategory(categoryChannel, `【${match_id}】WaitingRoom`);
  upd_discord_info.waiting_voice_ch_id = vc.id;

  vc = await createChannelInCategory(categoryChannel, `【${match_id}】Blue`);
  upd_discord_info.team0_voice_ch_id = vc.id;

  vc = await createChannelInCategory(categoryChannel, `【${match_id}】Orange`);
  upd_discord_info.team1_voice_ch_id = vc.id;
  
  // DBに試合用チャンネル情報を登録
  await db.match_discord_info.update(upd_discord_info, {
    where: {
      match_id: match_id
    }
  });
}

/**
 * カテゴリにボイスチャンネルを作成する
 * @param {*} categoryChannel 
 * @param {*} channelName 
 */
async function createChannelInCategory(categoryChannel, channelName) {
  const voiceChannel = await categoryChannel.guild.createChannel(channelName, { type: 'voice' });
  await voiceChannel.setParent(categoryChannel);
  await voiceChannel.lockPermissions();
  return voiceChannel;
}