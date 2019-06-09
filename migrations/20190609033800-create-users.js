'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      discord_id: {
        allowNull: false,
        type: Sequelize.STRING
      },
      tier: {
        default: 0,
        type: Sequelize.INTEGER
      },
      rate: {
        default: 0,
        type: Sequelize.INTEGER
      },
      win: {
        default: 0,
        type: Sequelize.INTEGER
      },
      lose: {
        default: 0,
        type: Sequelize.INTEGER
      },
      streak: {
        default: 0,
        type: Sequelize.INTEGER
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
    return queryInterface.dropTable('users');
  }
};