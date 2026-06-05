const joi = require('joi');

const validateCreatePost = (data) => {
    const schema = joi.object({
        content: joi.string().min(3).max(1000).required(),
        mediaIds: joi.array().items(joi.string())
    });
    return schema.validate(data);
};

module.exports = {
    validateCreatePost,
};