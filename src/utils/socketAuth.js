/**
 * Socket authentication utility functions
 */

/**
 * Creates socket connection options with authentication token
 * 
 * @param {string} token - JWT authentication token
 * @returns {Object} Socket connection options with auth
 */
exports.createSocketAuthOptions = (token) => {
  if (!token) {
    throw new Error('Authentication token is required');
  }
  
  return {
    auth: {
      token: token.startsWith('Bearer ') ? token : `Bearer ${token}`
    },
    // Additional options can be added here
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  };
};

/**
 * Sample client connection code (for documentation)
 * 
 * @example
 * // On the client side (front-end), use like this:
 * import { io } from 'socket.io-client';
 * import { createSocketAuthOptions } from '../utils/socketAuth';
 * 
 * // Get token from localStorage or auth context
 * const token = localStorage.getItem('token');
 * 
 * // Create socket connection with auth
 * const socket = io('http://localhost:3000', createSocketAuthOptions(token));
 * 
 * // Handle connection events
 * socket.on('connect', () => {
 *   console.log('Connected to socket server');
 * });
 * 
 * socket.on('error', (error) => {
 *   console.error('Socket error:', error);
 * });
 */ 