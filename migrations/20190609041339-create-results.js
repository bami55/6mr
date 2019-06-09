'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('results', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      match_id: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      match_tier: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      win: {
        type: Sequelize.INTEGER
      },
      lose: {
        type: Sequelize.INTEGER
      },
      blue_player_1: {
        type: Sequelize.STRING
      },
      blue_player_2: {
        type: Sequelize.STRING
      },
      blue_player_3: {
        type: Sequelize.STRING
      },
      orange_player_1: {
        type: Sequelize.STRING
      },
      orange_player_2: {
        type: Sequelize.STRING
      },
      orange_player_3: {
        type: Sequelize.STRING
      },
      match_date: {
        type: Sequelize.DATE
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
    return queryInterface.dropTable('results');
  }
};