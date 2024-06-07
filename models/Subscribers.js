const {DataTypes} = require('sequelize');
const {sequelize} = require('.');

module.exports = (sequelize, DataTypes) => {
    const Subscribers = sequelize.define('Subscribers', {
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        confirmed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        location: {
            type: DataTypes.STRING,
            allowNull: false
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false
        }
    });

    return Subscribers;
}