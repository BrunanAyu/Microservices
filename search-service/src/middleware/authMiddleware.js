const logger = require('../utils/logger');

const authenticateMiddleware = (req, res, next) => {
    const userId = req.header('x-user-id');
    if (!userId) {
        logger.warn('Unauthorized access attempt');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = { id: userId };
    next();
};


module.exports = authenticateMiddleware;