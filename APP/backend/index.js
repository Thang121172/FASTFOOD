const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const env = require('./config/env');
const pool = require('./config/db'); // Initialize DB pool
const errorHandler = require('./middlewares/errorHandler');

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const orderRoutes = require('./routes/orderRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const shipperRoutes = require('./routes/shipperRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] } });

// Attach socket.io to the app as a global variable
app.set('io', io);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// --- Socket.io Logic ---
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.on('joinOrder', (orderId) => {
    socket.join(`order_${orderId}`);
  });
  socket.on('leaveOrder', (orderId) => {
    socket.leave(`order_${orderId}`);
  });
  socket.on('identify', (payload) => {
    if (payload && payload.userId) socket.join(`user_${payload.userId}`);
    if (payload && payload.role && payload.role === 'ADMIN') socket.join('admins');
  });
  socket.on('disconnect', () => {
    console.log('socket disconnected', socket.id);
  });
});

// --- Register API Routes ---
// Auth APIs directly under /auth or root (to maintain backward compatibility, mostly root)
app.use('/', authRoutes);
app.use('/', adminRoutes);
app.use('/', userRoutes);
app.use('/api/v1', restaurantRoutes); // Contains /restaurants, /restaurants/nearby, etc.
app.use('/', orderRoutes); // /orders, /customer/orders
app.use('/', merchantRoutes);
app.use('/', shipperRoutes);
app.use('/', reviewRoutes);
app.use('/', complaintRoutes);
app.use('/', uploadRoutes);

// Test Endpoint
app.get('/api/v1/test', (req, res) => {
  console.log('[TEST] Endpoint hit!');
  res.json({ success: true, message: 'Test endpoint works!' });
});

// Global Error Handler
app.use(errorHandler);

// --- Start Server ---
const PORT = env.PORT || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Fast Food API Service is running on port ${PORT}.`);
});
