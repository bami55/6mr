'use strict';
module.exports = (sequelize, DataTypes) => {
  const match_users = sequelize.define('match_users', {
    match_id: DataTypes.INTEGER,
    discord_id: DataTypes.STRING,
    team: DataTypes.INTEGER
  }, {
    underscored: true,
  });
  match_users.associate = function(models) {
    // associations can be defined here
  };
  return match_users;
};