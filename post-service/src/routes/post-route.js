const express = require('express');
const {createPost,getAllPosts,getPost, deletePost } = require('../controllers/post-controller');
const authenticateMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/create-post', authenticateMiddleware, createPost);
router.get('/all-posts', getAllPosts); 
router.get('/post/:id', getPost);
router.delete('/delete-post/:id', authenticateMiddleware, deletePost);


module.exports = router;