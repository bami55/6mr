'use strict';

require('dotenv').config();
const rectuit = require('./recruit');
const user = require('./user');
const tier = require('./tier');

exports.base = (client, message) => {
  
  const prefix = process.env.PREFIX;
  if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  switch (command) {
    case 'open': rectuit.entry(client, message); break;
    case 'signup': user.create(client, message, args); break;
    case 'delete': user.delete(client, message); break;
    case 'tier_add': tier.create(client, message, args); break;
    case 'tier_update': tier.update(client, message, args); break;
    case 'tier_delete': tier.delete(client, message, args); break;
  
    default: break;
  }
}