const { trackedQuery } = require('../database/db');

class CategoriaRepository {
  /**
   * Retrieves all categories, ordered by name.
   * @returns {Promise<{data: Array, durationMs: number}>}
   */
  async getAll() {
    const sql = `
      SELECT id, nombre, descripcion, padre_id 
      FROM categorias 
      ORDER BY nombre ASC
    `;
    const result = await trackedQuery(sql, [], 'Fetch All Categories');
    return {
      data: result.rows,
      queries: [result]
    };
  }

  /**
   * Finds a category by its unique ID.
   * @param {number} id 
   * @returns {Promise<{data: Object|null, durationMs: number}>}
   */
  async getById(id) {
    const sql = `
      SELECT id, nombre, descripcion, padre_id 
      FROM categorias 
      WHERE id = $1
    `;
    const result = await trackedQuery(sql, [id], 'Fetch Category By ID');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Creates a new category.
   * @param {Object} categoryData 
   * @returns {Promise<{data: Object, durationMs: number}>}
   */
  async create({ nombre, descripcion, padre_id = null }) {
    const sql = `
      INSERT INTO categorias (nombre, descripcion, padre_id) 
      VALUES ($1, $2, $3) 
      RETURNING id, nombre, descripcion, padre_id
    `;
    const result = await trackedQuery(sql, [nombre, descripcion, padre_id], 'Create Category');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }
}

module.exports = new CategoriaRepository();
