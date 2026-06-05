const logger = require('../utils/logger');
const Post = require('../models/Post');
const { validateCreatePost } = require('../utils/validate');
const { publishEvent } = require('../utils/rabbitmq');

async function invalidatePostCatch(req, input) {

    const cachedKey = `post:${input}`;
    await req.redisClient.del(cachedKey);

    const keys = await req.redisClient.keys('posts:*');
    if (keys.length > 0) {
        await req.redisClient.del(keys);
        logger.info('Post cache invalidated');
    }
}

const createPost = async (req, res) => {
    logger.info('createPost hit with body: %o', req.body);
    try {
        const { error } = validateCreatePost(req.body);
        if (error) {
            logger.warn('Validation failed for createPost: %s', error.details[0].message);
            return res.status(400).json({succes: false, message: error.details[0].message });
        }
        const {  content, mediaIds } = req.body;
        const newlyCreatedPost = new Post(
            {
                user: req.user.id, 
                content, 
                mediaIds: mediaIds || [] 

            });
        await newlyCreatedPost.save();

        await publishEvent('post.created', {
            postId: newlyCreatedPost._id.toString(),
            userId: req.user.userId,
            content: newlyCreatedPost.content,
            createdAt: newlyCreatedPost.createdAt,
        });

        await invalidatePostCatch(req, newlyCreatedPost._id.toString());
        logger.info('Post created successfully');
        res.status(201).json(newlyCreatedPost);
    } catch (error) {
        logger.error('Error creating post', error);
        res.status(500).json({ message: 'Error creating post' });
    }
};
const getAllPosts = async (req, res) => {
    try {
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;

        const cacheKey = `posts:${page}:${limit}`;
        const cachedPosts = await req.redisClient.get(cacheKey);
        if (cachedPosts) {
            logger.info('Posts retrieved from cache');
            return res.status(200).json(JSON.parse(cachedPosts));
        }
        const posts = await Post.find({})
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit);
        const totalPosts = await Post.countDocuments();
        const totalPages = Math.ceil(totalPosts / limit);
        const response = {
            posts,
            currentPage: page,
            totalPages,
            totalPosts
        }
        //save to redis cache with expiration of 60 seconds
        await req.redisClient.set(cacheKey, JSON.stringify(response), 'EX', 300);

        
        logger.info('Posts retrieved successfully');
        res.status(200).json(response);

    } catch (error) {
        logger.error('Error retrieving posts', error);
        res.status(500).json({ message: 'Error retrieving posts' });
    }
};

const getPost = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `post:${id}`;
        const cachedPost = await req.redisClient.get(cacheKey);
        if (cachedPost) {
            logger.info('Post retrieved from cache');
            return res.status(200).json(JSON.parse(cachedPost));
        }
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }
        // Save to cache with expiration of 60 seconds
        await req.redisClient.set(cacheKey, JSON.stringify(post), 'EX', 300);
        logger.info('Post retrieved successfully');
        res.status(200).json(post);
    } catch (error) {
        logger.error('Error retrieving post', error);
        res.status(500).json({ message: 'Error retrieving post' });
    }
};

 
const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await Post.findByIdAndDelete(id);
        if (!post) {
            return res.status(404).json({ succes: false, message: 'Post not found' });
        }
        // Invalidate cache for this post and the list of posts
        await publishEvent('post.deleted', { 
            postId: post._id.toString(),
            userId: req.user.userId,
            mediaIds: post.mediaIds
        
        });
        await invalidatePostCatch(req, id);
        logger.info('Post deleted successfully');
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        logger.error('Error deleting post', error);
        res.status(500).json({ message: 'Error deleting post' });
    }
};


module.exports = {
    createPost,
    getAllPosts,
    getPost,
    deletePost
};