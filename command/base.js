'use strict';

require('dotenv').config();
const user = require('./user');
const tier = require('./tier');
const match = require('./match');

exports.base = (client, message) => {
  const prefix = process.env.PREFIX;
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content
    .slice(prefix.length)
    .trim()
    .split(/ +/);
  const command = args.shift().toLowerCase();

  switch (command) {
    // User
    case 'signup':
      user.create(client, message, args);
      break;
    case 'delete':
      user.delete(client, message);
      break;

    // Tier
    case 'tier_add':
      tier.create(client, message, args);
      break;
    case 'tier_update':
      tier.update(client, message, args);
      break;
    case 'tier_delete':
      tier.delete(client, message, args);
      break;

    // Match
    case 'open':
      match.open(client, message);
      break;
    case 'win':
      match.reportWin(client, message, args);
      break;
    case 'lose':
      match.reportLose(client, message, args);
      break;
    case 'cancel':
      match.cancel(client, message, args);
      break;

    default:
      break;
  }
};
