const { trackedQuery } = require('../database/db');

class ProductoRepository {
  /**
   * Retrieves products with pagination, search (name or SKU), and category filters.
   * Runs two queries (count and rows) and tracks execution time for both.
   * @param {Object} params Filters, search, pagination config
   * @returns {Promise<{data: Array, total: number, page: number, limit: number, queries: Array}>}
   */
  async findWithPagination({ search = '', categoryId = null, page = 1, limit = 12 }) {
    const offset = (page - 1) * limit;
    const queries = [];
    
    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    // Filter by Category
    if (categoryId) {
      whereClauses.push(`categoria_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    // Search by Name or SKU (Case Insensitive)
    if (search && search.trim() !== '') {
      whereClauses.push(`(nombre ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 1. Get total count
    const countSql = `SELECT COUNT(*) as total FROM productos ${whereString}`;
    const countResult = await trackedQuery(countSql, params, 'Count Total Products');
    queries.push(countResult);
    const total = parseInt(countResult.rows[0].total);

    // 2. Fetch paginated products
    const selectSql = `
      SELECT p.id, p.sku, p.nombre, p.descripcion, p.categoria_id, c.nombre as categoria_nombre,
             p.precio_base, p.precio_descuento, p.moneda, p.atributos, p.imagen_url, p.stock_total
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ${whereString}
      ORDER BY p.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const selectParams = [...params, limit, offset];
    const selectResult = await trackedQuery(selectSql, selectParams, 'Fetch Paginated Products');
    queries.push(selectResult);

    return {
      data: selectResult.rows,
      total,
      page,
      limit,
      queries
    };
  }

  /**
   * Finds a single product by ID.
   * @param {number} id 
   * @returns {Promise<{data: Object|null, queries: Array}>}
   */
  async getById(id) {
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = $1
    `;
    const result = await trackedQuery(sql, [id], 'Fetch Product By ID');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Finds a product by SKU.
   * @param {string} sku 
   * @returns {Promise<{data: Object|null, queries: Array}>}
   */
  async getBySku(sku) {
    const sql = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.sku = $1
    `;
    const result = await trackedQuery(sql, [sku], 'Fetch Product By SKU');
    return {
      data: result.rows[0] || null,
      queries: [result]
    };
  }

  /**
   * Inserts a single product (used in tests or administration).
   * @param {Object} productData 
   * @returns {Promise<{data: Object, queries: Array}>}
   */
  async create({ sku, nombre, descripcion, categoria_id, precio_base, precio_descuento = null, moneda = 'COP', atributos = {}, imagen_url = null, stock_total = 0 }) {
    const sql = `
      INSERT INTO productos 
        (sku, nombre, descripcion, categoria_id, precio_base, precio_descuento, moneda, atributos, imagen_url, stock_total)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const params = [sku, nombre, descripcion, categoria_id, precio_base, precio_descuento, moneda, JSON.stringify(atributos), imagen_url, stock_total];
    const result = await trackedQuery(sql, params, 'Create Product');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }
}

module.exports = new ProductoRepository();
