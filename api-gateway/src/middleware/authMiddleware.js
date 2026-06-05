const jwt = require('jsonwebtoken')
const logger = require("../utils/logger");



const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Access denied. No token provided.");
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('tokren', token)
      logger.warn("Invalid token.");
      return res.status(429).json({ success: false, message: "Invalid token." });
    }
    req.user = user;
    next();
  })


};

module.exports = {
  validateToken,
};