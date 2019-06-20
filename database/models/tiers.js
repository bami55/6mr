'use strict';
module.exports = (sequelize, DataTypes) => {
  const tiers = sequelize.define('tiers', {
    tier: DataTypes.INTEGER,
    role_id: DataTypes.STRING,
    max_rate: DataTypes.INTEGER,
    median_rate: DataTypes.INTEGER,
    min_rate: DataTypes.INTEGER
  }, {
    underscored: true,
  });
  tiers.associate = function(models) {
    // associations can be defined here
  };
  tiers.removeAttribute('id');
  return tiers;
};