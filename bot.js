'use strict';

require('dotenv').config();
const discord = require('discord.js');
const client = new discord.Client();

const baseCommand = require('./commands/base');
const baseEvent = require('./events/base');

client.on('ready', message =>
{
	console.log('bot is ready!');
});

client.on('raw', event => {
	if (!baseEvent.events.hasOwnProperty(event.t)) return;
	baseEvent.base(client, event);
})

client.on('message', message => {
	baseCommand.base(client, message);
});

client.login(process.env.DISCORD_BOT_TOKEN);