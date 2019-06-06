require('dotenv').config();
const discord = require('discord.js');
const client = new discord.Client();

const baseEvent = require('./events/baseevent');

client.on('ready', message =>
{
	console.log('bot is ready!');
});

client.on('raw', async event => {
	if (!baseEvent.events.hasOwnProperty(event.t)) return;
	baseEvent.base(client, event);
})

client.on('message', message => {
	if (message.content.startsWith('!b')) {
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
});

client.login(process.env.DISCORD_BOT_TOKEN);