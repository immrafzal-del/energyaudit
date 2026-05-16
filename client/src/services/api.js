const API_BASE_URL = '/api';

class ApiService {
  _authHeaders() {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async get(endpoint) {
    const r = await fetch(`${API_BASE_URL}${endpoint}`, { headers: { ...this._authHeaders() } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async post(endpoint, data) {
    const r = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async put(endpoint, data) {
    const r = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this._authHeaders() },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async delete(endpoint) {
    const r = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers: { ...this._authHeaders() } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  getRealtimeData()             { return this.get('/energy/realtime'); }
  getDailyConsumption(days=7)   { return this.get(`/energy/consumption/daily?days=${days}`); }
  getMonthlyConsumption(m=12)   { return this.get(`/energy/consumption/monthly?months=${m}`); }
  getStats()                    { return this.get('/energy/stats'); }
  getFaults()                   { return this.get('/faults'); }
  createFault(fault)            { return this.post('/faults', fault); }
  resolveFault(id)              { return this.put(`/faults/${id}/resolve`, {}); }
  getSettings()                 { return this.get('/settings'); }
  updateSettings(settings)      { return this.post('/settings', settings); }
  getAnalytics(range='24h')     { return this.get(`/energy/analytics?range=${range}`); }
  generateReport(type, params={}) { return this.post('/reports/generate', { type, ...params }); }
}

export default new ApiService();
