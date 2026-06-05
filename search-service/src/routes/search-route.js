const express = require('express');

const {searchPostController} = require('../controllers/search-controller');
const authenticateMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticateMiddleware) // Apply authentication middleware to all routes in this router
router.get('/post', searchPostController)

module.exports = router;