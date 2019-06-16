'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('tiers', {
      tier: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      tier_name: {
        allowNull: false,
        type: Sequelize.STRING
      },
      max_rate: {
        allowNull: false,
        default: 0,
        type: Sequelize.INTEGER
      },
      median_rate: {
        allowNull: false,
        default: 0,
        type: Sequelize.INTEGER
      },
      min_rate: {
        allowNull: false,
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
    return queryInterface.dropTable('tiers');
  }
};