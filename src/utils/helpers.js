/**
 * Generates a random reference ID for transactions
 * @returns {string} Reference ID
 */
exports.generateReference = () => {
  const timestamp = new Date().getTime().toString();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `REF-${timestamp}-${random}`;
};

/**
 * Formats currency amount
 * @param {number} amount - The amount to format
 * @returns {string} Formatted amount
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Handles API error responses
 * @param {Error} error - The error object
 * @param {Response} res - Express response object
 * @returns {Response} Error response
 */
exports.handleApiError = (error, res) => {
  console.error('API Error:', error);
  
  if (error.code === 'P2002') {
    return res.status(409).json({
      message: 'A record with this unique field already exists.'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      message: 'Record not found.'
    });
  }

  return res.status(500).json({
    message: 'An unexpected error occurred.'
  });
}; 