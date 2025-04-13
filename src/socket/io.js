/**
 * Socket.io singleton module to avoid circular dependencies
 * This module holds and manages the Socket.io instance for the entire application
 */

// Socket.io instance holder
let io = null;

/**
 * Initialize the io instance
 * @param {Object} server - HTTP server instance
 * @param {Object} options - Socket.io options
 */
exports.initialize = (server, options = {}) => {
  const socketIo = require('socket.io');
  io = socketIo(server, options);
  return io;
};

/**
 * Get the io instance
 * @returns {Object} Socket.io instance
 */
exports.getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initialize() first.');
  }
  return io;
}; 