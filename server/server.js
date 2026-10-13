require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');

const { connectDB } = require('./src/config/database');
const authService = require('./src/services/authService');
const authRoutes = require('./src/routes/authRoutes');
const requireAuthentication = require('./src/middleware/requireAuthentication');
const meetingRoutes = require('./src/routes/meetingRoutes');
const assistantRoutes = require('./src/routes/assistantRoutes');
const { initializeSocket } = require('./src/sockets/meetingSocket');

const app = express();
app.set('trust proxy', 1);
const DEFAULT_PORT = Number(process.env.PORT) || 3001;
const MAX_PORT_ATTEMPTS = 20;
const CLIENT_URL =
  process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';
const SERVER_PORT_FILE = path.join(__dirname, '..', '.server-port');
let activePort;

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration for REST API
const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MeetSpace Signaling Server',
  });
});

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

io.use(async (socket, next) => {
  try {
    const token = authService.getCookieToken(socket.handshake.headers.cookie);
    const user = await authService.getSessionUser(token);
    if (!user) {
      const error = new Error('Please sign in to join meetings.');
      error.data = { code: 'AUTH_REQUIRED' };
      return next(error);
    }
    socket.data.user = user;
    return next();
  } catch (error) {
    console.error('[Socket] Authentication failed:', error.message);
    return next(new Error('Could not verify your session.'));
  }
});

// Initialize real-time signaling socket handlers
initializeSocket(io);

app.set('disconnectUserSockets', (userId) => {
  io.in(`user:${userId}`).disconnectSockets(true);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', requireAuthentication, meetingRoutes);
app.use('/api/assistant', requireAuthentication, assistantRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api/') ||
      req.path === '/health' ||
      req.path.startsWith('/socket.io/') ||
      path.extname(req.path)
    ) {
      return next();
    }
    return res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Start server and optional DB connection
async function startServer() {
  try {
    await authService.initialize();
  } catch (error) {
    console.error('[Auth] Could not initialize authentication:', error.message);
    process.exit(1);
  }

  const tryListen = (port, attemptsLeft = MAX_PORT_ATTEMPTS) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const nextPort = port + 1;

        if (attemptsLeft <= 0) {
          console.error(`[Server] Port ${port} is busy and no available port was found in range.`);
          process.exit(1);
        }

        console.warn(`[Server] Port ${port} is already in use, retrying on port ${nextPort}...`);
        tryListen(nextPort, attemptsLeft - 1);
        return;
      }

      console.error('[Server] Failed to start server:', err.message);
      process.exit(1);
    });

    server.listen(port, () => {
      activePort = server.address().port;
      try {
        fs.writeFileSync(SERVER_PORT_FILE, `${activePort}\n`, 'utf8');
      } catch (error) {
        console.error('[Server] Could not write the active port for the frontend proxy:', error.message);
      }
      console.log(`===========================================`);
      console.log(`🚀 MeetSpace server listening on port ${activePort}`);
      console.log(`📡 Client URL permitted: ${CLIENT_URL}`);
      console.log(`✨ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===========================================`);

      // Connect to DB asynchronously so server is immediately available
      connectDB().catch((err) => {
        console.warn('[Database] Optional MongoDB connection notice:', err.message);
      });
    });
  };

  tryListen(DEFAULT_PORT);
}

// Graceful Shutdown Handling
const handleShutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);

  const forceExit = setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);

  const finishShutdown = () => {
    clearTimeout(forceExit);
    try {
      if (fs.readFileSync(SERVER_PORT_FILE, 'utf8').trim() === String(activePort || '')) {
        fs.unlinkSync(SERVER_PORT_FILE);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[Server] Could not clear the frontend proxy port file:', error.message);
      }
    }
    console.log('[Socket.IO] All socket connections closed.');
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  };

  if (server.listening) {
    io.close(finishShutdown);
  } else {
    finishShutdown();
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer().catch((error) => {
  console.error('[Server] Startup failed:', error.message);
  process.exit(1);
});

module.exports = { app, server, io };
