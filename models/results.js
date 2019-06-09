'use strict';
module.exports = (sequelize, DataTypes) => {
  const results = sequelize.define('results', {
    match_id: DataTypes.INTEGER,
    match_tier: DataTypes.INTEGER,
    win: DataTypes.INTEGER,
    lose: DataTypes.INTEGER,
    blue_player_1: DataTypes.STRING,
    blue_player_2: DataTypes.STRING,
    blue_player_3: DataTypes.STRING,
    orange_player_1: DataTypes.STRING,
    orange_player_2: DataTypes.STRING,
    orange_player_3: DataTypes.STRING,
    match_date: DataTypes.DATE
  }, {
    underscored: true,
  });
  results.associate = function(models) {
    // associations can be defined here
  };
  return results;
};