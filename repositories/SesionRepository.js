const { trackedQuery } = require('../database/db');

class SesionRepository {
  /**
   * Retrieves a session by its ID, checking that it has not expired.
   * @param {string} id 
   * @returns {Promise<{data: Object|null, queries: Array}>}
   */
  async getSession(id) {
    const sql = `
      SELECT s.id, s.user_id, s.payload, s.ultimo_acceso, s.expira,
             u.email, u.nombre_completo
      FROM sesiones s
      LEFT JOIN usuarios u ON s.user_id = u.id
      WHERE s.id = $1 AND s.expira > NOW()
    `;
    const result = await trackedQuery(sql, [id], 'Retrieve Valid Session');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Saves or updates a session.
   * @param {string} id Session token/ID
   * @param {number|null} userId Associated user ID
   * @param {Object} payload Session data
   * @param {Date} expira Expiration timestamp
   * @returns {Promise<{data: Object, queries: Array}>}
   */
  async createOrUpdateSession(id, userId, payload, expira) {
    const sql = `
      INSERT INTO sesiones (id, user_id, payload, expira, ultimo_acceso) 
      VALUES ($1, $2, $3, $4, NOW()) 
      ON CONFLICT (id) 
      DO UPDATE SET 
        user_id = COALESCE(EXCLUDED.user_id, sesiones.user_id),
        payload = EXCLUDED.payload, 
        expira = EXCLUDED.expira, 
        ultimo_acceso = NOW()
      RETURNING *
    `;
    const params = [id, userId, JSON.stringify(payload), expira];
    const result = await trackedQuery(sql, params, 'Save/Update Session');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }

  /**
   * Touches a session to update its last access and extend expiration.
   * @param {string} id 
   * @param {Date} newExpira 
   * @returns {Promise<{queries: Array}>}
   */
  async touchSession(id, newExpira) {
    const sql = `
      UPDATE sesiones 
      SET expira = $1, ultimo_acceso = NOW() 
      WHERE id = $2
    `;
    const result = await trackedQuery(sql, [newExpira, id], 'Extend Session Lease');
    return {
      queries: [result]
    };
  }

  /**
   * Deletes a session by ID (logout).
   * @param {string} id 
   * @returns {Promise<{queries: Array}>}
   */
  async destroySession(id) {
    const sql = `
      DELETE FROM sesiones 
      WHERE id = $1
    `;
    const result = await trackedQuery(sql, [id], 'Destroy Session (Logout)');
    return {
      queries: [result]
    };
  }

  /**
   * Deletes all expired sessions from the database.
   * @returns {Promise<{queries: Array}>}
   */
  async clearExpired() {
    const sql = `
      DELETE FROM sesiones 
      WHERE expira < NOW()
    `;
    const result = await trackedQuery(sql, [], 'Prune Expired Sessions');
    return {
      queries: [result]
    };
  }
}

module.exports = new SesionRepository();
