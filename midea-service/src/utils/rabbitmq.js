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
async function consumeEvent(routingKey, callback) {
    if (!channel) {
        await connectRabbitMQ();
    }
    try {
        const q = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);
        await channel.consume(q.queue, (msg) => {
            if (msg !== null) {
                const content = JSON.parse(msg.content.toString());
                callback(content);
                channel.ack(msg);
            }

        });

        logger.info('Event consumed from RabbitMQ: %s', routingKey);
    } catch (error) {
        logger.error('Error consuming event from RabbitMQ: %o', error);
    }
}


module.exports = { connectRabbitMQ, publishEvent, consumeEvent };