const logger = require('../utilis/logger');
const User = require('../model/User');
const { validateRegistration, validateLogin } = require('../utilis/validation');
const RefreshToken = require('../model/RefreshToken');
const { generateAccessToken } = require('../utilis/generateToken');
const { ref } = require('joi');
// user registration
const registerUser = async (req, res, next) => {
    logger.info('Registration endpoint hit with data: %o', req.body);
    try {
        const { error } = validateRegistration(req.body);
        if (error) {
            logger.warn('Validation failed for registration: %o', error.details[0].message);
            return res.status(400).json({ success: false, error: error.details[0].message });
        }

        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            logger.warn('User already exists with email: %s or username: %s', email, username);
            return res.status(400).json({ success: false, error: 'User already exists' });
        }
        const newUser = new User({ username, email, password });
        await newUser.save();
        logger.info('User registered successfully with email: %s', email);
        const { accessToken, refreshToken } = generateAccessToken(newUser);
        res.status(201).json({ success: true, message: 'User registered successfully', accessToken, refreshToken });

    } catch (error) {
        logger.error('Error during user registration: %o', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        })
    }
};

// user login
const loginUser = async (req, res, next) => {
    try {
        const { error } = validateLogin(req.body);
        if (error) {
            logger.warn('Validation failed for login: %o', error.details[0].message);
            return res.status(400).json({ success: false, error: error.details[0].message });
        }
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            logger.warn('Invalid login attempt for email: %s', email);
            return res.status(400).json({ success: false, error: 'Invalid email or password' });
        }
        logger.info('User logged in successfully with email: %s', email);
        const { accessToken, refreshToken } = generateAccessToken(user);
        res.status(200).json({ success: true, message: 'User logged in successfully', accessToken, refreshToken });


    } catch (error) {
        logger.error('Error during user login: %o', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        })
    }
};

// token refresh
const refreshAccessToken = async (req, res, next) => {
    logger.info('Refresh token endpoint hit with data: %o', req.body);
    try {
        const { refreshToken } = req.body;
        // Implementation for token refresh
        if (!refreshToken) {
            logger.warn('Refresh token not provided');
            return res.status(400).json({ success: false, error: 'Refresh token is required' });
        }
        const storedToken = await RefreshToken.findOne({ token: refreshToken });

        // Check if token is expired
        if (!storedToken || storedToken.expiresAt < Date.now()) {
            logger.warn('Invalid or expired refresh token: %s', refreshToken);
            return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
        }
        const user = await User.findById(storedToken.userId);
        if (!user) {
            logger.warn('User not found for refresh token: %s', refreshToken);
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateAccessToken(user);
        // delete old refresh token
        await RefreshToken.deleteOne({ _id: storedToken._id });

        res.status(200).json({ success: true, accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
        logger.error('Error during user login: %o', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        })
    }
};

//user logout
const logoutUser = async (req, res, next) => {
    logger.info('Logout endpoint hit with data: %o', req.body);
    try {
        const { refreshToken } = req.body;
        // Implementation for user logout
        if (!refreshToken) {
            logger.warn('Refresh token not provided');
            return res.status(400).json({ success: false, error: 'Refresh token is required' });
        }
        await RefreshToken.deleteOne({ token: refreshToken });
        logger.info('User logged out successfully with refresh token: %s', refreshToken);
        res.status(200).json({ success: true, message: 'User logged out successfully' });

    } catch (error) {
        logger.error('Error during user login: %o', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        })
    }
};

module.exports = {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser
};
