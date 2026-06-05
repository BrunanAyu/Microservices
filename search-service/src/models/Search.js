const mongoose = require('mongoose')

const searchPostSchema = new mongoose.Schema({
    postId: {
        type: String,
        require: true,
        unique: true,
    },
    userId: {
        type: String,
        require: true,
        index: true,
    },
    content: {
        type: String,
        require: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// index
searchPostSchema.index({ content: 'text' })
searchPostSchema.index({ createdAt: -1 })

const SearchPost = mongoose.model('SearchPost', searchPostSchema)

module.exports = SearchPost;