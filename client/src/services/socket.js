import io from 'socket.io-client';

class SocketService {
  constructor() { this.socket = null; this.listeners = new Map(); }

  connect() {
    if (this.socket?.connected) return;
    this.socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 10 });
    this.socket.on('connect',    () => this._emit('connection-status', { connected: true }));
    this.socket.on('disconnect', () => this._emit('connection-status', { connected: false }));
    return this.socket;
  }

  disconnect() { if (this.socket) { this.socket.disconnect(); this.socket = null; } }

  on(event, cb) {
    if (!this.socket) this.connect();
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
    this.socket.on(event, cb);
  }

  off(event, cb) {
    if (!this.socket) return;
    this.socket.off(event, cb);
    const cbs = this.listeners.get(event) || [];
    const i = cbs.indexOf(cb);
    if (i > -1) cbs.splice(i, 1);
  }

  _emit(event, data) { (this.listeners.get(event) || []).forEach(cb => cb(data)); }
  emit(event, data)  { if (!this.socket) this.connect(); this.socket.emit(event, data); }

  onEnergyData(cb)       { this.on('energy-data',       cb); }
  onWaveformData(cb)     { this.on('waveform-data',     cb); }
  onFaultAlert(cb)       { this.on('fault-saved',       cb); }
  onConnectionStatus(cb) { this.on('connection-status', cb); }
}

export default new SocketService();
