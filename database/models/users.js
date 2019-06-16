'use strict';
module.exports = (sequelize, DataTypes) => {
  const users = sequelize.define('users', {
    discord_id: DataTypes.STRING,
    tier: DataTypes.INTEGER,
    rate: DataTypes.INTEGER,
    win: DataTypes.INTEGER,
    lose: DataTypes.INTEGER,
    streak: DataTypes.INTEGER
  }, {
    underscored: true,
  });
  users.associate = function(models) {
    // associations can be defined here
  };
  users.removeAttribute('id');
  return users;
};