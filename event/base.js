'use strict';

const reaction = require('./reaction');

const _events = {
  MESSAGE_REACTION_ADD: 'messageReactionAdd',
  MESSAGE_REACTION_REMOVE: 'messageReactionRemove'
};
exports.events = _events;

exports.base = (client, event) => {
  const { t: type, d: data } = event;
  switch (type) {
    case 'MESSAGE_REACTION_ADD':
    case 'MESSAGE_REACTION_REMOVE':
      reaction.entry(client, event);
      break;

    default:
      break;
  }
};
