'use strict';
module.exports = (sequelize, DataTypes) => {
  const matches = sequelize.define(
    'matches',
    {
      match_id: DataTypes.INTEGER,
      match_tier: DataTypes.INTEGER,
      status: DataTypes.INTEGER
    },
    {
      underscored: true
    }
  );
  matches.associate = function(models) {
    // associations can be defined here
  };
  matches.removeAttribute('id');
  return matches;
};
