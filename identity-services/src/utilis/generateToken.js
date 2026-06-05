const jwt = require('jsonwebtoken');
const crypto = require('crypto')

const RefreshToken = require('../model/RefreshToken');
const logger = require('./logger');

const generateAccessToken = (user) => {
    const accessToken = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '15m' });

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    RefreshToken.create({ token: refreshToken, user: user._id, expiresAt })
        .then(() => logger.info('Refresh token stored successfully for user: %s', user.username))
        .catch(error => logger.error('Error storing refresh token for user: %s - %o', user.username, error));

    return { accessToken, refreshToken };
};

module.exports = { generateAccessToken };
