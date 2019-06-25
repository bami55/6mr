'use strict';

require('dotenv').config();
const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = matchConfig.reaction_emoji;
const _event_type_add = 'MESSAGE_REACTION_ADD';

const discord = require('discord.js');
const Sequelize = require('sequelize');
const EntryManager = require(__dirname + '/../manager/EntryManager.js');

/**
 * 募集エントリー
 */
exports.entry = async (client, event) => {
  const { t: type, d: data } = event;
  EntryManager.entry(client, type, data);
};
