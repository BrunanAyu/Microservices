const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const logger = require('./utilis/logger')
const {rateLimit} = require('express-rate-limit')
const {RedisStore} = require('rate-limit-redis')
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const router = require('./router/identity-service');
const helmet = require('helmet');

const winston = require('winston');
const {RateLimiterRedis} = require('rate-limiter-flexible');
require('dotenv').config();

const redisClient = new Redis(process.env.REDIS_URI);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use((req,res,next) => {
    logger.info('Incoming request: %s %s', req.method, req.url);
    logger.info('Request body: %o', req.body);
    next();
});


//connect to mongodb
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => logger.info('mongodb connected succesfully') )
    .catch((e) => logger.error('mongodb connection failed', e) )

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
        logger.warn('Sensitive endpoint rate limit exceeded for IP: %s', req.ip);
        res.status(429).json({ error: 'Too many requests' });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
});
// apply this sensitiveRateLimiter only to login and register routes
app.use('/api/auth/login', sensitiveRateLimiter);
app.use('/api/auth/register', sensitiveRateLimiter);

// Routes
app.use('/api/auth', router);

//error handling middleware
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Identity service running on port ${PORT}`);
});

// unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});

