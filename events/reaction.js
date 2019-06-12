'use strict';

const _recruit_emoji = process.env.RECRUIT_EMOJI;

const discord = require('discord.js');

exports.recruit = async (client, event) => {
  const { t: type, d: data } = event;
  const user = client.users.get(data.user_id);
  console.log(data);

  if (data.emoji.name !== _recruit_emoji) return;
  if (user.bot) return;

  const guild = client.guilds.get(data.guild_id);
  if (!guild) return;
  
  const channel = client.channels.get(data.channel_id) || await user.createDM();
  const message = await channel.fetchMessage(data.message_id);

  let entry_users = [];
  let entry_users_mention = [];
  const reaction = message.reactions.find(r => r.emoji.name === data.emoji.name);
  if (reaction) {
    const reaction_users = await reaction.fetchUsers();
    reaction_users.forEach(user => {
      if (!user.bot) {
        entry_users.push(guild.member(user).displayName);
        entry_users_mention.push(`<@${user.id}>`);
      }
    });
  }

  const embed = message.embeds.shift();
  if (embed) {
    if (embed.title !== process.env.RECRUIT_TITLE || 
        embed.fields[1].value === process.env.RECRUIT_END) {
      return;
    }

    const new_embed = new discord.RichEmbed(embed);
    if (entry_users.length === 0) {
      new_embed.fields[2].value = process.env.ENTRY_NONE;
    } else {
      new_embed.fields[2].value = entry_users.join("\n");
    }
    const max_count = embed.fields[0].value;
    if (max_count <= entry_users.length) {
      new_embed.fields[1].value = process.env.RECRUIT_END;
      channel.send(`${entry_users_mention.join(' ')}\n${process.env.RECRUIT_NOTIFICATION}`);
    }
    message.edit(new_embed);
  }
  console.debug(`TYPE:${type} / MESSAGE:${message.content} / EMOJI:${data.emoji.name}`);
};