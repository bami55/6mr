'use strict';

const EntryManager = require(__dirname + '/../manager/EntryManager.js');

/**
 * 募集エントリー
 */
exports.entry = async (client, event) => {
  const { t: type, d: data } = event;
  EntryManager.entry(client, type, data);
};
