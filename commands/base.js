'use strict';

require('dotenv').config();
const rectuit = require('./recruit');
const user = require('./user');

exports.base = (client, message) => {
  
  const prefix = process.env.PREFIX;
  if (!message.content.startsWith(prefix)) return;

	const input = message.content.slice(prefix.length).trim();
	if (!input.length) return;
  
  const [, command, commandArgs] = input.match(/(\w+)\s*([\s\S]*)/);

  if (command === 'b') {
    rectuit.entry(client, message);
  } else if (command === 'signup') {
    user.create(client, message);
  } else if (command === 'delete') {
    user.delete(client, message);
  }
}