const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

// Verify JWT token helper function
const verifyToken = (token) => {
  try {
    if (!token) return null;
    
    // Remove Bearer prefix if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
    return jwt.verify(tokenString, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
};

module.exports = (io) => {
  // Socket middleware for authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = verifyToken(token);
      
      if (!decoded) {
        return next(new Error('Invalid authentication token'));
      }
      
      // Attach user data to socket
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Authenticated client connected', socket.id, socket.user.phone);
    
    // Automatically join user to their room based on authenticated user ID
    const userId = socket.user.id;
    socket.join(`user-${userId}`);
    console.log(`Socket ${socket.id} joined room for user ${userId}`);
    
    // Socket middleware to verify user for all events
    socket.use(([event, ...args], next) => {
      if (!socket.user) {
        return next(new Error('Authentication required'));
      }
      next();
    });

    // Handle transaction events
    socket.on('transaction:initiated', async (data) => {
      try {
        // Verify user is the sender
        if (data.senderId !== socket.user.id) {
          socket.emit('error', { message: 'Unauthorized action' });
          return;
        }
        
        // Emit to sender's room
        io.to(`user-${data.senderId}`).emit('transaction:initiated', {
          message: 'Transaction initiated',
          data
        });
        
        // If it's a transfer, emit to receiver's room too
        if (data.receiverId) {
          io.to(`user-${data.receiverId}`).emit('transaction:pending', {
            message: 'You have a pending transaction',
            data
          });
        }
      } catch (error) {
        console.error('Socket error:', error);
        socket.emit('error', { message: 'Server error' });
      }
    });

    // Handle authentication errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error', { message: error.message });
    });

    // Disconnect event
    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
    });
  });
}; 