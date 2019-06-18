'use strict';
module.exports = (sequelize, DataTypes) => {
  const match_discord_info = sequelize.define('match_discord_info', {
    match_id: DataTypes.INTEGER,
    message_id: DataTypes.STRING,
    role_id: DataTypes.STRING,
    category_id: DataTypes.STRING,
    waiting_text_ch_id: DataTypes.STRING,
    waiting_voice_ch_id: DataTypes.STRING,
    team0_text_ch_id: DataTypes.STRING,
    team0_voice_ch_id: DataTypes.STRING,
    team1_text_ch_id: DataTypes.STRING,
    team1_voice_ch_id: DataTypes.STRING
  }, {
    underscored: true,
  });
  match_discord_info.associate = function(models) {
    // associations can be defined here
  };
  match_discord_info.removeAttribute('id');
  return match_discord_info;
};