'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('match_users', {
      match_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      discord_id: {
        allowNull: false,
        type: Sequelize.STRING,
        primaryKey: true
      },
      team: {
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
    return queryInterface.dropTable('match_users');
  }
};
