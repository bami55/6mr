'use strict';
module.exports = (sequelize, DataTypes) => {
  const tiers = sequelize.define(
    'tiers',
    {
      tier: DataTypes.INTEGER,
      role_id: DataTypes.STRING,
      category_id: DataTypes.STRING,
      entry_ch_id: DataTypes.STRING,
      result_ch_id: DataTypes.STRING,
      init_rate: DataTypes.INTEGER,
      max_rate: DataTypes.INTEGER,
      min_rate: DataTypes.INTEGER
    },
    {
      underscored: true
    }
  );
  tiers.associate = function(models) {
    // associations can be defined here
  };
  tiers.removeAttribute('id');
  return tiers;
};
