'use strict';

require('dotenv').config();
const match_config = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = match_config.reaction_emoji;

const discord = require('discord.js');

exports.recruit = async (client, event) => {
  const { t: type, d: data } = event;
  const user = client.users.get(data.user_id);

  // bot or 指定絵文字以外は中断
  if (data.emoji.name !== _recruit_emoji) return;
  if (user.bot) return;

  const guild = client.guilds.get(data.guild_id);
  if (!guild) return;
  
  const channel = client.channels.get(data.channel_id) || await user.createDM();
  const message = await channel.fetchMessage(data.message_id);

  // リアクションユーザー全取得
  let entry_users_id = [];
  let entry_users_name = [];
  let entry_users_mention = [];
  const reaction = message.reactions.find(r => r.emoji.name === data.emoji.name);
  if (reaction) {
    const reaction_users = await reaction.fetchUsers();
    reaction_users.forEach(user => {
      if (!user.bot) {
        entry_users_id.push(user.id);
        entry_users_name.push(guild.member(user).displayName);
        entry_users_mention.push(`<@${user.id}>`);
      }
    });
  }

  const embed = message.embeds.shift();
  if (!embed) return;
  
  // すでに募集が終了していたら中断
  const field_status = embed.fields.find(e => e.name === match_config.embed.status);
  if (embed.title !== match_config.embed.title || 
      field_status.value === match_config.embed_status.closed) {
    return;
  }

  // エントリーユーザーの表示
  const new_embed = new discord.RichEmbed(embed);
  let field_entry = new_embed.fields.find(e => e.name === match_config.embed.entry);
  if (entry_users_name.length === 0) {
    field_entry.value = match_config.entry_none;
  } else {
    field_entry.value = entry_users_name.join("\n");
  }

  // エントリー数が募集人数に達した場合
  const entry_size = match_config.entry_size;
  if (entry_size <= entry_users_name.length) {
    let new_field_status = new_embed.fields.find(e => e.name === match_config.embed.status);
    new_field_status.value = match_config.embed_status.closed;

    // メンションでエントリーユーザーに通知
    channel.send(`${entry_users_mention.join(' ')}\n${match_config.notification}`);

    // 試合ステータス変更
    const match_id = embed.fields.find(e => e.name === match_config.embed.id).value;
    const match = await db.matches.findOne({ where: { match_id: match_id } });
    await changeMatchStatus(match, entry_users_id);

    // 部屋作成
    await setMatchRole(guild, match, entry_users_id);

    // 役職設定
    console.log(match_id);
  }
  message.edit(new_embed);
};

/**
 * 試合ステータス変更
 * @param {*} match 
 * @param {*} entry_users_id 
 */
async function changeMatchStatus(match, entry_users_id) {
  
  // ステータス変更
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
  entry_users_id.forEach(async userId => {
    await db.match_users.upsert({
      match_id: match.match_id,
      discord_id: userId,
      team: 0
    });
  }); 
}

async function setMatchRole(guild, match, entry_users_id) {
  const match_id = match.match_id;
  const tier = await db.tiers.findOne({ where: { tier: match.match_tier } });
  const categoryChannel = await guild.createChannel(`${tier.tier_name}【${match_id}】`, {
    type: 'category',
    permissionOverwrites: [{
      id: guild.id,
      deny: ['VIEW_CHANNEL']
    }]
  });

  for (let i = 0; i < entry_users_id.length; i++) {
    const member = guild.members.find(m => m.id === entry_users_id[i]);
    await categoryChannel.overwritePermissions(member, {
      VIEW_CHANNEL: true
    });
  }
  
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
  
  let vc = null;
  vc = await createChannelInCategory(categoryChannel, `【${match_id}】WaitingRoom`);
  upd_discord_info.waiting_voice_ch_id = vc.id;

  vc = await createChannelInCategory(categoryChannel, `【${match_id}】Blue`);
  upd_discord_info.team0_voice_ch_id = vc.id;

  vc = await createChannelInCategory(categoryChannel, `【${match_id}】Orange`);
  upd_discord_info.team1_voice_ch_id = vc.id;
  
  await db.match_discord_info.update(upd_discord_info, {
    where: {
      match_id: match_id
    }
  });
}

async function createChannelInCategory(categoryChannel, channelName) {
  const voiceChannel = await categoryChannel.guild.createChannel(channelName, { type: 'voice' });
  await voiceChannel.setParent(categoryChannel);
  await voiceChannel.lockPermissions();
  return voiceChannel;
}