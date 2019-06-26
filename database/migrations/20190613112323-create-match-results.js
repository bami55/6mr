'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('match_results', {
      match_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        primaryKey: true
      },
      win_team: {
        type: Sequelize.INTEGER
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
    return queryInterface.dropTable('match_results');
  }
};
