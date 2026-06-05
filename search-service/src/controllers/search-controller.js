const logger = require("../utils/logger")
const Search = require("../models/Search")


async function invalidatePostCatch(req, input) {

   const cachedKey = `search:${input}`;
   await req.redisClient.del(cachedKey);
    const keys = await req.redisClient.keys('search:*');
    if (keys.length > 0) {
        await req.redisClient.del(keys);
        logger.info('Post cache invalidated');
    }
}

const searchPostController = async (req, res) => {
    logger.info('search endpoint hit with query: %s', req.query.query);
    try {
        const { query } = req.query;
        // Your search logic here
        const results = await Search.find({ $text: { $search: query } }, { score: { $meta: "textScore" } }).sort({ score: { $meta: "textScore" } }).limit(10);
        
        res.json({ results });
    } catch (error) { 
        logger.error('Error occurred while searching:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    searchPostController,
}