const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const socketManager = require('../socket/io');

const prisma = new PrismaClient();

// Transfer funds to another user
exports.transferFunds = async (req, res) => {
  try {
    const { receiverPhone, amount, description } = req.body;
    const senderId = req.user.id;
    
    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Find sender's wallet
    const senderWallet = await prisma.wallet.findUnique({
      where: { userId: senderId }
    });

    if (!senderWallet) {
      return res.status(404).json({ message: 'Sender wallet not found' });
    }

    // Check if sender has enough balance
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Find receiver by phone
    const receiver = await prisma.user.findUnique({
      where: { phone: receiverPhone }
    });

    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Find receiver's wallet
    const receiverWallet = await prisma.wallet.findUnique({
      where: { userId: receiver.id }
    });

    if (!receiverWallet) {
      return res.status(404).json({ message: 'Receiver wallet not found' });
    }

    // Generate unique reference
    const reference = uuidv4();

    // Perform transfer transaction
    await prisma.$transaction(async (prisma) => {
      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          senderId,
          receiverId: receiver.id,
          amount,
          type: 'TRANSFER',
          status: 'PENDING',
          reference,
          description
        }
      });

      // Update sender's wallet (deduct amount)
      await prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: senderWallet.balance - amount }
      });

      // Update receiver's wallet (add amount)
      await prisma.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: receiverWallet.balance + amount }
      });

      // Update transaction status to completed
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
        include: {
          sender: {
            select: { name: true, phone: true }
          },
          receiver: {
            select: { name: true, phone: true }
          }
        }
      });

      // Emit socket events if socket server is available
      try {
        const io = socketManager.getIO();
        
        // Emit to sender's room
        io.to(`user-${senderId}`).emit('transaction:completed', {
          message: 'Transfer completed successfully',
          transaction: updatedTransaction
        });

        // Emit to receiver's room
        io.to(`user-${receiver.id}`).emit('wallet:updated', {
          message: 'You received a transfer',
          transaction: updatedTransaction,
          newBalance: receiverWallet.balance + amount
        });
      } catch (error) {
        // Log socket error but continue with the transaction
        console.error('Socket emission error:', error.message);
      }
    });

    res.json({
      message: 'Transfer completed successfully',
      reference
    });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get transactions where user is sender or receiver
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json({
      message: 'Transaction history retrieved successfully',
      transactions
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 