'use strict';

require('dotenv').config();
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = process.env.RECRUIT_EMOJI;

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
  if (embed) {
    // すでに募集が終了していたら中断
    const field_status = embed.fields.find(e => e.name === process.env.RECRUIT_FIELD_STATUS);
    if (embed.title !== process.env.RECRUIT_TITLE || 
        field_status.value === process.env.RECRUIT_END) {
      return;
    }

    // エントリーユーザーの表示
    const new_embed = new discord.RichEmbed(embed);
    let field_entry = new_embed.fields.find(e => e.name === process.env.RECRUIT_FIELD_ENTRY);
    if (entry_users_name.length === 0) {
      field_entry.value = process.env.ENTRY_NONE;
    } else {
      field_entry.value = entry_users_name.join("\n");
    }

    // エントリー数が募集人数に達した場合
    const entry_size = embed.fields.find(e => e.name === process.env.RECRUIT_FIELD_SIZE).value;
    if (entry_size <= entry_users_name.length) {
      let new_field_status = new_embed.fields.find(e => e.name === process.env.RECRUIT_FIELD_STATUS);
      new_field_status.value = process.env.RECRUIT_END;

      // メンションでエントリーユーザーに通知
      channel.send(`${entry_users_mention.join(' ')}\n${process.env.RECRUIT_NOTIFICATION}`);

      // 試合ステータス変更
      const match_id = embed.fields.find(e => e.name === process.env.RECRUIT_FIELD_ID).value;
      await changeMatchStatus(match_id, entry_users_id);

      // 部屋作成
      // 役職設定
      console.log(match_id);
    }
    message.edit(new_embed);
  }
};

/**
 * 試合ステータス変更
 * @param {*} match_id 
 * @param {*} entry_users_id 
 */
async function changeMatchStatus(match_id, entry_users_id) {
  
  // ステータス変更
  const match = await db.matches.findOne({ where: { match_id: match_id } });
  let upd_match = {
    match_id: match.match_id,
    match_tier: match.tier,
    status: 1
  };
  await db.matches.update(upd_match, {
    where: {
      match_id: match.match_id
    }
  });

  // match_users 登録
  entry_users_id.forEach(async userId => {
    await db.match_users.upsert({
      match_id: match_id,
      discord_id: userId,
      team: 0
    });
  });
  
}