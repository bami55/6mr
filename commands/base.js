'use strict';

const rectuit = require('./recruit');
const user = require('./user');

exports.base = (client, message) => {
  
  if (message.content.startsWith('!b')) {
    rectuit.entry(client, message);
  } else if (message.content === '!signup') {
    user.create(client, message);
  } else if (message.content === '!delete') {
    user.delete(client, message);
  }
}