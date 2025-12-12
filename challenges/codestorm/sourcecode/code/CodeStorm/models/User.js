const { DataTypes } = require('sequelize');
const sequelize = require("../config");
const { v4: uuidv4 } = require('uuid'); 

const User = sequelize.define(
  "users",
  {
    id: {
      type: DataTypes.UUID, 
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = User;