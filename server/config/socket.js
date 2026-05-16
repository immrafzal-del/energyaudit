const socketIo   = require('socket.io');
const { processData } = require('../services/dataProcessor');

const initializeSocket = (server) => {
  const io = socketIo(server, {
    cors: { origin: '*', methods: ['GET','POST'], credentials: true },
    transports: ['websocket','polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 5e6,   // 5 MB — handles 100+100 array JSON
    perMessageDeflate: false,
    serveClient: false,
    path: '/socket.io/'
  });

  io.use((socket, next) => {
    console.log(`\n→ Connection from ${socket.handshake.address} EIO${socket.conn.protocol}`);
    next();
  });

  io.on('connection', (socket) => {
    const isESP32 = (socket.conn.protocol === 3);  // EIO3 = ESP32
    const label   = isESP32 ? 'ESP32' : 'Browser';
    console.log(`✓ ${label} connected  ID=${socket.id}`);

    socket.emit('connected', {
      message: 'Connected to Energy Monitoring Server',
      socketId: socket.id,
      timestamp: new Date()
    });

    // ── Data from ESP32 ────────────────────────────────────────────────────
    socket.on('energy-data', async (raw) => {

      // ── DEEP DIAGNOSTIC LOG ─────────────────────────────────────────────
      // This tells us EXACTLY what the server received from ESP32
      const hasVS = Array.isArray(raw.vs);
      const hasIS = Array.isArray(raw.is);
      console.log(
        `\n← ESP32 data  v=${raw.v}V  i=${raw.i}A  f=${raw.f}Hz  t=${raw.t}°C` +
        `  vs=${hasVS ? raw.vs.length+'pts' : 'MISSING'}` +
        `  is=${hasIS ? raw.is.length+'pts' : 'MISSING'}`
      );
      if (!hasVS) {
        console.warn('  ⚠  vs[] not in packet — waveform will be empty in browser');
        console.warn('  ⚠  Check: Arduino WAVE_PAIRS=100, sendData() prints vs array');
      }

      try {
        await processData(raw, io, true);
      } catch (err) {
        console.error('processData error:', err.message);
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('ping', () => socket.emit('pong'));

    socket.on('disconnect', (reason) => {
      console.log(`✗ ${label} disconnected  reason=${reason}`);
    });
  });

  console.log('\n=== Socket.IO ready (EIO3+EIO4, maxBuf=5MB) ===\n');
  return io;
};

module.exports = initializeSocket;
