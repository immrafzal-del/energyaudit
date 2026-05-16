const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const initializeSocket = require('./config/socket');
const dataProcessor = require('./services/dataProcessor');

const energyRoutes = require('./routes/energy');
const faultRoutes = require('./routes/faults');
const settingsRoutes = require('./routes/settings');
const reportsRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const { createDefaultAdmin } = require('./controllers/authController');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

connectDB();
createDefaultAdmin();

const io = initializeSocket(server);
app.set('io', io);

app.use('/api/auth', authRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api/faults', faultRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get(/^(?!\/api|\/socket\.io).*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Energy Monitoring System API', status: 'running' });
  });
}

setTimeout(() => {
  dataProcessor.startSimulation(io);
}, 5000);

const PORT = process.env.PORT || 5001;
server.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('Energy Monitoring System Server');
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log('=================================');
  console.log('Waiting for ESP32 connection...\n');
});