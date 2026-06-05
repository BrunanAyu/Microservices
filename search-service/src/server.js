require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis')
const { RateLimiterRedis } = require('rate-limiter-flexible');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const searchRoutes = require('./routes/search-route');
const errorHandler = require('./middleware/errorHandler');
const {connectRabbitMQ, consumeEvent} = require('./utils/rabbitmq');
const {handlePostCreated, handlePostDeleted} = require('./eventHandler/search-event-handler');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes
app.use('/api/search',(req,res,next) =>{
    req.redisClient = redisClient;
    next();
} ,searchRoutes);

app.use(errorHandler);
//connect to mongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => logger.info('mongodb connected succesfully'))
    .catch((e) => logger.error('mongodb connection failed', e))

async function startServer() {
    try {
        await connectRabbitMQ();
        await consumeEvent('post.created', handlePostCreated);
        await consumeEvent('post.deleted', handlePostDeleted);
        app.listen(process.env.PORT, () => {
            logger.info(`Search Service running on port ${process.env.PORT}`);
        });
}catch (error) {
        logger.error('Error starting server', error);
        process.exit(1);
    }
}

startServer();