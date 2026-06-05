require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');
const errorHandler = require('./middleware/errorhandler');
const { validateToken } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URI);

app.use(helmet());
app.use(cors());
app.use(express.json());

//rates limit
const ratelimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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

app.use(ratelimit);

app.use((req, res, next) => {
    logger.info('Incoming request: %s %s', req.method, req.url);
    logger.info('Request body: %o', req.body);
    next();
});

const proxyOptions = {
    proxyReqPathResolver: (req) => {
        return req.originalUrl.replace(/^\/v1/, '/api');
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error('Proxy error: %s', err.message, { stack: err.stack });
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

//setting up proxy for identity service
app.use('/v1/auth', proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        // Add authentication headers or tokens if needed
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        // Handle responses from the identity service if needed
        logger.info('Response from identity service: %s', proxyRes.statusCode);
        return proxyResData;
    }

}));
//setting up proxy for post service
app.use('/v1/posts', validateToken, proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        // Add authentication headers or tokens if needed
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        proxyReqOpts.headers['x-user-id'] = srcReq.user.id; // Pass user ID to post service
        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        // Handle responses from the post service if needed
        logger.info('Response from post service: %s', proxyRes.statusCode);
        return proxyResData;
    }
}));
//setting up proxy for media service
app.use('/v1/media', validateToken, proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,

    // ✅ use this for headers
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers['x-user-id'] = srcReq.user.id;

        // ✅ lowercase content-type
        if (srcReq.headers['content-type'] && 
            !srcReq.headers['content-type'].startsWith('multipart/form-data')) {
            proxyReqOpts.headers['content-type'] = 'application/json';
        }
        return proxyReqOpts;
    },

    // ✅ use this for body modification only
    proxyReqBodyDecorator: (bodyContent, srcReq) => {
        return bodyContent; // just pass body as is
    },

    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info('Response from media service: %s', proxyRes.statusCode);
        return proxyResData;
    },

    parseReqBody: false,
}));

//setting up proxy for search service
app.use('/v1/search', validateToken, proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        // Add authentication headers or tokens if needed
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        proxyReqOpts.headers['x-user-id'] = srcReq.user.id; // Pass user ID to search service
        return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        // Handle responses from the search service if needed
        logger.info('Response from search service: %s', proxyRes.statusCode);
        return proxyResData;
    }
}));

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(`Proxying /v1/auth to ${process.env.IDENTITY_SERVICE_URL}`);
    logger.info(`Proxying /v1/posts to ${process.env.POST_SERVICE_URL}`);
    logger.info(`Proxying /v1/search to ${process.env.SEARCH_SERVICE_URL}`);
    logger.info('Redis uri: %s', process.env.REDIS_URI);
});