const logger = require('../utils/logger');
const cloudinary = require('../utils/cloudinary');
const Media = require('../models/Media');
const uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            logger.warn('No file uploaded');
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // ✅ correct multer field names
        const { originalname, mimetype, buffer } = req.file;
        const userId = req.headers['x-user-id']; // ✅ from api gateway header

        logger.info('Uploading media for user %s: %s', userId, originalname);
        logger.info('uploading to cloudinary started...');

        const result = await cloudinary.uploadToCloudinary(req.file);

        // ✅ fixed hyphen to underscore
        logger.info('uploading to cloudinary completed: %o', result.public_id);

        const mediaData = {
            userId,
            originalName: originalname,  // ✅
            mimeType: mimetype,          // ✅
            publicId: result.public_id,
            url: result.secure_url
        };

        const newMedia = new Media(mediaData);
        await newMedia.save();

        res.json({ 
            success: true, 
            mediaId: newMedia._id, 
            url: newMedia.url, 
            message: 'Media uploaded successfully' 
        });

    } catch (error) {
        logger.error('Error uploading media: %o', error);
        res.status(500).json({ success: false, error: 'Error uploading media' });
    }
};
const getAllMedia = async (req, res) => {
    try {
        

        const media = await Media.find({});

        res.json({ success: true, media });
    } catch (error) {
        logger.error('Error fetching media: %o', error);
        res.status(500).json({ success: false, error: 'Error fetching media' });
    }
};

module.exports = {
    uploadMedia,
    getAllMedia
};