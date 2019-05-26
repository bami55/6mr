require('dotenv').config();
const discord = require('discord.js');
const client = new discord.Client();

client.on('ready', message =>
{
	console.log('bot is ready!');
});

client.login(process.env.DISCORD_BOT_TOKEN);