const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const socketManager = require('../socket/io');
const prisma = new PrismaClient();

// Get wallet balance
exports.getBalance = async (req, res) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    res.json({
      message: 'Wallet balance retrieved successfully',
      balance: wallet.balance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fund wallet
exports.fundWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Find user's wallet
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Generate unique reference
    const reference = uuidv4();

    // Perform funding transaction
    await prisma.$transaction(async (prisma) => {
      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          senderId: userId,
          amount,
          type: 'DEPOSIT',
          status: 'PENDING',
          reference,
          description: 'Wallet funding'
        }
      });

      // Update wallet balance
      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: wallet.balance + amount }
      });

      // Update transaction status to completed
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
        include: {
          sender: {
            select: { name: true, email: true }
          }
        }
      });

      // Emit socket events if socket server is available
      try {
        const io = socketManager.getIO();
        
        // Emit to user's room
        io.to(`user-${userId}`).emit('wallet:funded', {
          message: 'Wallet funded successfully',
          transaction: updatedTransaction,
          newBalance: updatedWallet.balance
        });
      } catch (error) {
        // Log socket error but continue with the transaction
        console.error('Socket emission error:', error.message);
      }
    });

    res.json({
      message: 'Wallet funded successfully',
      reference
    });
  } catch (error) {
    console.error('Fund wallet error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 