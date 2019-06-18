'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('match_discord_infos', {
      match_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      message_id: {
        type: Sequelize.STRING
      },
      role_id: {
        type: Sequelize.STRING
      },
      category_id: {
        type: Sequelize.STRING
      },
      waiting_text_ch_id: {
        type: Sequelize.STRING
      },
      waiting_voice_ch_id: {
        type: Sequelize.STRING
      },
      team0_text_ch_id: {
        type: Sequelize.STRING
      },
      team0_voice_ch_id: {
        type: Sequelize.STRING
      },
      team1_text_ch_id: {
        type: Sequelize.STRING
      },
      team1_voice_ch_id: {
        type: Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('match_discord_infos');
  }
};