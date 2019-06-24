"use strict";
module.exports = (sequelize, DataTypes) => {
  const match_results = sequelize.define(
    "match_results",
    {
      match_id: DataTypes.INTEGER,
      win_team: DataTypes.INTEGER,
      match_date: DataTypes.DATE
    },
    {
      underscored: true
    }
  );
  match_results.associate = function(models) {
    // associations can be defined here
  };
  match_results.removeAttribute("id");
  return match_results;
};
