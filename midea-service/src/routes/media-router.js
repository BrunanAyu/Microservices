const express = require('express');
const multer = require('multer');
const {uploadMedia, getAllMedia} = require('../controllers/media-controller');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
    
}).single('file'); // Expect a single file with the field name 'media'

router.post('/upload', authMiddleware, (req, res, next) => {
    logger.info('Received media upload request from user %s', req.user.id);
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            logger.error('Error processing file upload: %o', err);
            return res.status(400).json({ success: false, massage: 'Error processing file upload', error: err.message, stack: err.stack });
        }else if (err) {
            logger.error('Unexpected error during file upload: %o', err);
            return res.status(500).json({ success: false, message: 'Unexpected error during file upload', error: err.message, stack: err.stack });
        }
        if (!req.file) {
            logger.warn('No file uploaded by user %s', req.user.id);
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        logger.info('File uploaded successfully by user %s: %s', req.user.id, req.file.originalname);
        next();

    });

}, uploadMedia);

router.get('/all', authMiddleware, getAllMedia);

module.exports = router;

