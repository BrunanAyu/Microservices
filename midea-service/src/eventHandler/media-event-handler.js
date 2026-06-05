const Media = require('../models/Media');
const logger = require('../utils/logger');
const {deleteMediaFromCloudinary} = require('../utils/cloudinary');
const handlerPostDeleted = async (data) => {
    try {
        logger.info('Handling post.deleted event: %o', data);
        const { postId, mediaIds } = data;
        // Delete all media associated with the post
       const mediaToDelete =  await Media.find({ _id: { $in: mediaIds } });
       for(const media of mediaToDelete) {
            await deleteMediaFromCloudinary(media.publicId);
            await Media.deleteOne({ _id: media._id });
            logger.info('Deleted media with id: %s for postId: %s', media._id, postId);
       }
        logger.info('Media deleted successfully for postId: %s', postId);
    } catch (error) {
        logger.error('Error handling post.deleted event: %o', error);
    }
};

module.exports = {
    handlerPostDeleted
};