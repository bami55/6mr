'use strict';

const discord = require('discord.js');

exports.entry = async (client, message) => {
  const embed = new discord.RichEmbed()
    .setColor('#0099ff')
    .setTitle(process.env.RECRUIT_TITLE)
    .addField('募集人数', '1', true)
    .addField('ステータス', '募集中', true)
    .addField('エントリー', 'なし');
  message.channel.send(embed)
  .then(message => {
    message.react(process.env.RECRUIT_EMOJI);
  });
}
