const express = require('express')

const router = express.Router();
const { registerUser, loginUser, refreshAccessToken, logoutUser } = require('../controller/identity-controller');



router.post('/register', registerUser)
router.post('/login', loginUser)
router.post('/refresh-token', refreshAccessToken)
router.post('/logout', logoutUser)


module.exports = router