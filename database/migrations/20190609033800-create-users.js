'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('users', {
      discord_id: {
        allowNull: false,
        primaryKey: true,
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
