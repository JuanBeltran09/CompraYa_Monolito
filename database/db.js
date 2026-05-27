require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Executes a PostgreSQL query and measures its performance in milliseconds.
 * @param {string} text SQL Query string
 * @param {Array} params Query parameters
 * @param {string} operationDescription Logical name of the operation for logging
 * @returns {Promise<{rows: Array, rowCount: number, durationMs: number}>}
 */
async function trackedQuery(text, params = [], operationDescription = 'SQL Query') {
  const start = process.hrtime.bigint();
  try {
    const res = await pool.query(text, params);
    
    // Simulate database latency if QUERY_DELAY_MS is set
    const delayMs = parseInt(process.env.QUERY_DELAY_MS || '0', 10);
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6; // nanoseconds to milliseconds
    
    return {
      rows: res.rows,
      rowCount: res.rowCount,
      durationMs: parseFloat(durationMs.toFixed(2)),
      operation: operationDescription,
      sql: text.trim().replace(/\s+/g, ' ')
    };
  } catch (err) {
    console.error(`Database error during "${operationDescription}":`, err.message);
    throw err;
  }
}

/**
 * Helper to run a series of queries in a single tracked transaction.
 * @param {function(client): Promise<any>} transactionFn Function that executes queries on the client
 * @param {string} operationDescription Logical name of the transaction
 */
async function trackedTransaction(transactionFn, operationDescription = 'Transaction') {
  const client = await pool.connect();
  const start = process.hrtime.bigint();
  const queries = [];
  
  // Tracked client query wrapper
  const trackedClientQuery = async (text, params = [], desc = 'Tx Query') => {
    const qStart = process.hrtime.bigint();
    try {
      const res = await client.query(text, params);
      
      // Simulate database latency if QUERY_DELAY_MS is set
      const delayMs = parseInt(process.env.QUERY_DELAY_MS || '0', 10);
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      const qEnd = process.hrtime.bigint();
      const qDurationMs = Number(qEnd - qStart) / 1e6;
      queries.push({
        sql: text.trim().replace(/\s+/g, ' '),
        durationMs: parseFloat(qDurationMs.toFixed(2)),
        operation: desc
      });
      return res;
    } catch (err) {
      throw err;
    }
  };

  try {
    await client.query('BEGIN');
    const result = await transactionFn(trackedClientQuery);
    await client.query('COMMIT');
    
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    
    return {
      result,
      durationMs: parseFloat(durationMs.toFixed(2)),
      operation: operationDescription,
      queries
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  trackedQuery,
  trackedTransaction
};
