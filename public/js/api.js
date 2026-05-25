/**
   * CompraYa API Client with Integrated Query Latency Telemetry
   */

window.queryHistory = [];
window.onQueryLogged = null; // Callback for UI updates

const API_BASE = '/api';

/**
 * Log queries to history and calculate stats
 */
function logQueries(queries, operationName) {
  if (!Array.isArray(queries) || queries.length === 0) return;

  const loggedQueries = queries.map(q => ({
    operation: q.operation || operationName,
    sql: q.sql || 'N/A',
    durationMs: q.durationMs || 0.0,
    timestamp: new Date()
  }));

  window.queryHistory.push(...loggedQueries);
  
  // Keep only last 50 queries to prevent memory leaks
  if (window.queryHistory.length > 50) {
    window.queryHistory = window.queryHistory.slice(window.queryHistory.length - 50);
  }

  // Trigger UI update
  if (typeof window.onQueryLogged === 'function') {
    window.onQueryLogged(loggedQueries, operationName);
  }
}

/**
 * Build request headers with authentication session token
 */
function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  const sessionId = localStorage.getItem('session_id');
  if (sessionId) {
    headers['Authorization'] = `Bearer ${sessionId}`;
  }
  return headers;
}

const api = {
  /**
   * Perform HTTP GET request
   */
  async get(endpoint, operationName = 'GET Request') {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: getHeaders()
      });
      const data = await res.json();
      
      if (data && data.meta && data.meta.queries) {
        logQueries(data.meta.queries, operationName);
      }
      
      return data;
    } catch (err) {
      console.error(`API GET error on ${endpoint}:`, err);
      throw err;
    }
  },

  /**
   * Perform HTTP POST request
   */
  async post(endpoint, body = {}, operationName = 'POST Request') {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data && data.meta && data.meta.queries) {
        logQueries(data.meta.queries, operationName);
      }

      return data;
    } catch (err) {
      console.error(`API POST error on ${endpoint}:`, err);
      throw err;
    }
  },

  /**
   * Perform HTTP DELETE request
   */
  async delete(endpoint, operationName = 'DELETE Request') {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();

      if (data && data.meta && data.meta.queries) {
        logQueries(data.meta.queries, operationName);
      }

      return data;
    } catch (err) {
      console.error(`API DELETE error on ${endpoint}:`, err);
      throw err;
    }
  }
};

window.api = api;
