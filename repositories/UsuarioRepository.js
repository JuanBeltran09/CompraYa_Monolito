const { trackedQuery } = require('../database/db');

class UsuarioRepository {
  /**
   * Finds a user by email address.
   * @param {string} email 
   * @returns {Promise<{data: Object|null, queries: Array}>}
   */
  async getByEmail(email) {
    const sql = `
      SELECT id, email, password_hash, nombre_completo, pais, direccion, creado_en 
      FROM usuarios 
      WHERE email = $1
    `;
    const result = await trackedQuery(sql, [email], 'Fetch User By Email');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Finds a user by ID.
   * @param {number} id 
   * @returns {Promise<{data: Object|null, queries: Array}>}
   */
  async getById(id) {
    const sql = `
      SELECT id, email, nombre_completo, pais, direccion, creado_en 
      FROM usuarios 
      WHERE id = $1
    `;
    const result = await trackedQuery(sql, [id], 'Fetch User By ID');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Creates a new user.
   * @param {Object} userData 
   * @returns {Promise<{data: Object, queries: Array}>}
   */
  async create({ email, passwordHash, nombreCompleto, pais = 'Colombia', direccion = {} }) {
    const sql = `
      INSERT INTO usuarios (email, password_hash, nombre_completo, pais, direccion) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, email, nombre_completo, pais, direccion, creado_en
    `;
    const params = [email, passwordHash, nombreCompleto, pais, JSON.stringify(direccion)];
    const result = await trackedQuery(sql, params, 'Create User Account');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }
}

module.exports = new UsuarioRepository();
