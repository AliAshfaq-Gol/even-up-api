const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseHandler');

exports.verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return errorResponse(res, 'Authorization token missing or malformed', 401);
        }

        const token = authHeader.split(' ')[1];

        // ✅ Verify and decode the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Attach decoded info to request
        req.user = decoded; // ← VERY IMPORTANT

        next();
    } catch (error) {
        console.error('JWT verification error:', error.message);
        return errorResponse(res, 'Invalid or expired token', 401);
    }
};
