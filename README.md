# BuntuPay API

A secure payment system backend application with advanced authentication, wallet management, and transaction capabilities.

## Features

- Enhanced user authentication
  - Phone number verification with OTP
  - Secure device management (one active device per user)
  - SendChamp SMS integration for OTP delivery
- Wallet management 
- Fund transfers between users
- Transaction history
- Real-time updates using Socket.io with authentication

## Tech Stack

- Node.js and Express
- Prisma ORM with MySQL
- Socket.io for real-time communication
- JWT for authentication
- SendChamp for SMS delivery

## Getting Started

### Prerequisites

- Node.js (v14+)
- MySQL database

### Installation

1. Clone the repository

2. Install dependencies
```
npm install
```

3. Configure environment variables
   - Copy the `.env.example` to `.env` (if available) 
   - Update the database connection string and other configuration:
   ```
   DATABASE_URL="mysql://username:password@localhost:3306/payment_system"
   JWT_SECRET="your-super-secret-jwt-key"
   PORT=3000
   
   # SendChamp API configuration
   SENDCHAMP_PUBLIC_KEY="your-sendchamp-public-key"
   NODE_ENV="development" # Use 'production' for live mode
   ```

4. Run database migrations
```
npx prisma migrate dev --name init
```

5. Start the development server
```
npm run dev
```

## API Endpoints

### Authentication
- POST `/api/auth/check-phone` - Check if phone exists and handle device verification
- POST `/api/auth/verify-otp` - Verify OTP code for registration or device verification
- POST `/api/auth/register` - Register a new user with phone number
- POST `/api/auth/login` - Login with phone number

### User
- GET `/api/user/profile` - Get current user profile info

### Wallet
- GET `/api/wallet/balance` - Get current wallet balance
- POST `/api/wallet/fund` - Fund your wallet

### Transactions
- POST `/api/transactions/transfer` - Transfer funds to another user (using receiver's phone)
- GET `/api/transactions/history` - Get transaction history

## Socket.io Integration

The app uses Socket.io for real-time updates with authenticated connections.

### Authentication

Socket connections require JWT authentication:

```javascript
// Client-side connection with authentication
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'Bearer YOUR_JWT_TOKEN'
  }
});

// Handle connection events
socket.on('connect', () => {
  console.log('Connected to socket server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

### Events List

Below is a comprehensive list of all Socket.io events available in the system:

#### Connection Events
- `connect` - When a client successfully connects
- `disconnect` - When a client disconnects
- `error` - When an error occurs in the socket connection

#### Transaction Events
- `transaction:initiated` - When a new transaction is started
  - Emitted to: Sender's room
  - Payload: `{ message: string, data: TransactionData }`

- `transaction:pending` - When a user receives a pending transaction
  - Emitted to: Receiver's room
  - Payload: `{ message: string, data: TransactionData }`

- `transaction:completed` - When a transaction is successfully completed
  - Emitted to: Sender's room
  - Payload: `{ message: string, transaction: TransactionDetails }`

- `transaction:failed` - When a transaction fails
  - Emitted to: Sender's room (if transaction fails)
  - Payload: `{ message: string, error: string }`

#### Wallet Events
- `wallet:updated` - When a user receives funds via transfer
  - Emitted to: Receiver's room
  - Payload: `{ message: string, transaction: TransactionDetails, newBalance: number }`

- `wallet:funded` - When a user's wallet is funded
  - Emitted to: User's room
  - Payload: `{ message: string, transaction: TransactionDetails, newBalance: number }`

### Frontend Usage Example

```javascript
// Frontend code
const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer YOUR_JWT_TOKEN' }
});

// Connection events
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('error', (error) => console.error('Socket error:', error));

// Transaction events
socket.on('transaction:initiated', (data) => {
  console.log('Transaction started:', data);
  // Update UI to show pending transaction
});

socket.on('transaction:completed', (data) => {
  console.log('Transaction completed:', data);
  // Update UI to show success and transaction details
});

// Wallet events
socket.on('wallet:updated', (data) => {
  console.log('Received payment:', data);
  // Update wallet balance in UI
  updateBalanceDisplay(data.newBalance);
});

socket.on('wallet:funded', (data) => {
  console.log('Wallet funded:', data);
  // Update wallet balance in UI
  updateBalanceDisplay(data.newBalance);
});

// Emit events
function initiateTransfer(receiverPhone, amount) {
  socket.emit('transaction:initiated', {
    senderId: currentUserId,
    receiverPhone,
    amount
  });
}
```

## OTP Verification & Device Management

BuntuPay implements a secure authentication system with phone verification and device management:

### Phone Verification Flow

The application uses a two-step verification process for new device logins:

1. **Check Phone Endpoint** (`POST /api/auth/check-phone`)
   - **Request Body**:
     ```json
     {
       "phone": "+1234567890",
       "deviceId": "unique-device-identifier"
     }
     ```
   - **Response Scenarios**:
     - User doesn't exist: Returns status 203, sends OTP for registration
     - User exists with matching active device: Returns status 200, allows login
     - User exists with inactive device: Returns status 202, sends OTP for verification
     - User exists with different active device: Returns status 202, sends OTP for verification

2. **Verify OTP Endpoint** (`POST /api/auth/verify-otp`)
   - **Request Body**:
     ```json
     {
       "phone": "+1234567890",
       "code": "123456",
       "deviceId": "unique-device-identifier",
       "purpose": "DEVICE_VERIFICATION" // or "REGISTRATION"
     }
     ```
   - **Response**: Authenticates user and manages device status

### One Device Policy

BuntuPay enforces a "one active device per user" security policy:

- Only one device can be active for a user at any time
- When a new device is verified, any previously active device is automatically deactivated
- Inactive devices require OTP verification to reactivate
- This prevents unauthorized access from multiple devices

### SMS Integration

The system uses SendChamp for delivering OTP messages:

- Registration verification messages
- Device verification messages
- Context-aware messages explaining the verification reason
- Fallback to console logging in development mode

## License

This project is MIT licensed. 