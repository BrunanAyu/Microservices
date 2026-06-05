const cloudinary = require('cloudinary').v2;
const logger = require('./logger');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary =  (file) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
            if (error) {
                logger.error('Cloudinary upload error: %o', error);
                return reject(error);
            }
            resolve(result);
        }).end(file.buffer);
    })
}
const deleteMediaFromCloudinary = async (publicId) => {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(publicId, { resource_type: 'image' }, (error, result) => {
            if (error) {
                logger.error('Cloudinary delete error: %o', error);
                return reject(error);
            }
            resolve(result);
            logger.info('Cloudinary delete result: %o', result);
        });
})
}
module.exports = {
    uploadToCloudinary,
    deleteMediaFromCloudinary
};