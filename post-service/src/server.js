require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const helmet = require('helmet');
const postRoutes = require('./routes/post-route');
const errorHandler = require('./middleware/errorHandler');
const cors = require('cors');
const {connectRabbitMQ} = require('./utils/rabbitmq')


const app = express();
app.use(express.json());
app.use(errorHandler);
app.use(cors());
app.use(helmet());

app.use('/api', postRoutes);

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => logger.info('mongodb connected succesfully'))
    .catch((e) => logger.error('mongodb connection failed', e))


const redisClient = new Redis(process.env.REDIS_URI);

// DDOS protection
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware',
    points: 100, // Number of points
    duration: 60, // Per second(s)
});



app.use((req, res, next) => {
    rateLimiter.consume(req.ip)
        .then(() => {
            next();
        })
        .catch(() => {
            logger.warn('Rate limit exceeded for IP: %s', req.ip);
            res.status(429).json({ error: 'Too many requests' });
        });
});
//ip based rate limiting for sensetive endpoints
const sensitiveRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        logger.warn('Rate limit exceeded for IP: %s on sensitive endpoint: %s', req.ip, req.originalUrl);
        res.status(429).json({ error: 'Too many requests' });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
});

// routes pass redis client to controllers via req.redisClient
app.use('/api/posts', (req, res, next) => {
    req.redisClient = redisClient;
    next();
}, postRoutes);

const PORT = process.env.PORT || 3002;

async function startServer() {
    try {
        await connectRabbitMQ();
        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
    }
}

startServer();

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});