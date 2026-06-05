const mongoose = require('mongoose');
const argon2 = require('argon2');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) { // ✅ skip if not modified
        return
    }
    try {
        this.password = await argon2.hash(this.password); // ✅ hash if modified
        
    } catch (error) {
        return next(error);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        console.log('=== COMPARE PASSWORD DEBUG ===');
        console.log('Candidate password:', candidatePassword);
        console.log('Stored hash:', this.password);
        console.log('Hash length:', this.password?.length);
        const result = await argon2.verify(this.password, candidatePassword);
        console.log('Result:', result);
        return result;
        //return await argon2.verify(this.password, candidatePassword);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};
userSchema.index({ username: 'text' });

module.exports = mongoose.model('User', userSchema);