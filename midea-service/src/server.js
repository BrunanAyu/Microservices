require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const mediaRouter = require('./routes/media-router');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const { connectRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlerPostDeleted } = require('./eventHandler/media-event-handler');

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(errorHandler);


const PORT = process.env.PORT || 3003;

app.use((req, res, next) => {
    logger.info('Incoming request: %s %s from user %s', req.method, req.url, req.user ? req.user.id : 'unknown');
    logger.info('Request body: %o', req.body);
    next();
});

app.use('/api/media', mediaRouter);



mongoose.connect(process.env.MONGO_URI)
    .then(() => { logger.info('Connected to MongoDB'); })
    .catch((err) => logger.error('Error connecting to MongoDB: %o', err));

async function startServer() {

    try {
        await connectRabbitMQ();
        // consume all event
        await consumeEvent('post.deleted', handlerPostDeleted);

        app.listen(PORT, () => {
            logger.info('Media service is running on port %d', PORT);
        });
    } catch (error) {
        logger.error('Error starting server: %o', error);
        process.exit(1); // Exit the process if we can't connect to RabbitMQ
    }
}

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at: %o, reason: %o', promise, reason);
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception: %o', err);
    process.exit(1); // Exit the process to avoid undefined behavior
});

startServer();