/**
 * Success response handler
 */
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Error response handler
 */
const errorResponse = (res, message = 'Error', statusCode = 500, data = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(data && { data }),
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
