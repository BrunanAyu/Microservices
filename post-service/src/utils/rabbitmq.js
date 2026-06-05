const amqp = require('amqplib');
const logger = require('./logger');

let channel = null;
let connection = null;

const EXCHANGE_NAME = 'post_events';

async function connectRabbitMQ() {
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URI);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        logger.info('Connected to RabbitMQ');

        // ✅ handle connection drop
        connection.on('error', (err) => {
            logger.error('RabbitMQ connection error: %o', err);
            channel = null;
            connection = null;
            setTimeout(connectRabbitMQ, 5000);
        });

        // ✅ handle connection close
        connection.on('close', () => {
            logger.warn('RabbitMQ connection closed. Reconnecting in 5s...');
            channel = null;
            connection = null;
            setTimeout(connectRabbitMQ, 5000);
        });

        return channel;

    } catch (error) {
        logger.error('Error connecting to RabbitMQ: %o', error);
        logger.info('Retrying in 5s...');
        channel = null;
        connection = null;
        setTimeout(connectRabbitMQ, 5000);
    }
}
async function publishEvent(routingKey, message) {
    if (!channel) {
        await connectRabbitMQ();
    }

    try {
        await channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
        logger.info('Event published to RabbitMQ: %s', routingKey);
    } catch (error) {
        logger.error('Error publishing event to RabbitMQ: %o', error);
    }

}
const getChannel = () => {
    if (!channel) {
        throw new Error('RabbitMQ channel not available');
    }
    return channel;
};

module.exports = { connectRabbitMQ, getChannel, publishEvent };