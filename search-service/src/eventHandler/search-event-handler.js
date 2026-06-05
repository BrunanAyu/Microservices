const logger  = require('../utils/logger');
const Search = require('../models/Search');

async function handlePostCreated(event) {
    logger.info('Handling post.created event: %o', event);
    try {
        const { postId, userId, content, createdAt } = event;
        const newSearchPost = new Search({
            postId,
            userId,
            content,
            createdAt
        });
        await newSearchPost.save();
        logger.info('Search document created for postId: %s', postId);

    } catch (error) {
        logger.error('Error handling post.created event', error);
    }
}
async function handlePostDeleted(event) {
    logger.info('Handling post.deleted event: %o', event);
    try {
        const { postId } = event;
        await Search.findOneAndDelete({ postId });
        logger.info('Search document deleted for postId: %s', postId);
    } catch (error) {
        logger.error('Error handling post.deleted event', error);
    }
}

module.exports = {
    handlePostCreated,handlePostDeleted
}