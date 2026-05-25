const { trackedQuery } = require('../database/db');

class CarritoRepository {
  /**
   * Fetches all products in a user's cart with details.
   * @param {number} userId 
   * @returns {Promise<{data: Array, queries: Array}>}
   */
  async getCartByUserId(userId) {
    const sql = `
      SELECT c.producto_id, c.cantidad, c.agregado_en, 
             p.nombre, p.sku, p.precio_base, p.precio_descuento, p.imagen_url, p.stock_total
      FROM carrito c
      JOIN productos p ON c.producto_id = p.id
      WHERE c.usuario_id = $1
      ORDER BY c.agregado_en DESC
    `;
    const result = await trackedQuery(sql, [userId], 'Fetch Shopping Cart');
    return {
      data: result.rows,
      queries: [result]
    };
  }

  /**
   * Adds a product to the cart or increments its quantity if it already exists.
   * @param {number} userId 
   * @param {number} productId 
   * @param {number} cantidad 
   * @returns {Promise<{data: Object, queries: Array}>}
   */
  async addOrIncrementItem(userId, productId, cantidad) {
    const sql = `
      INSERT INTO carrito (usuario_id, producto_id, cantidad) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (usuario_id, producto_id) 
      DO UPDATE SET cantidad = carrito.cantidad + EXCLUDED.cantidad, agregado_en = NOW()
      RETURNING *
    `;
    const result = await trackedQuery(sql, [userId, productId, cantidad], 'Add/Increment Cart Item');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }

  /**
   * Sets the exact quantity of a product in the cart.
   * @param {number} userId 
   * @param {number} productId 
   * @param {number} cantidad 
   * @returns {Promise<{data: Object, queries: Array}>}
   */
  async setItemQuantity(userId, productId, cantidad) {
    const sql = `
      INSERT INTO carrito (usuario_id, producto_id, cantidad) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (usuario_id, producto_id) 
      DO UPDATE SET cantidad = EXCLUDED.cantidad, agregado_en = NOW()
      RETURNING *
    `;
    const result = await trackedQuery(sql, [userId, productId, cantidad], 'Set Cart Item Quantity');
    return {
      data: result.rows[0],
      queries: [result]
    };
  }

  /**
   * Removes a single product from the cart.
   * @param {number} userId 
   * @param {number} productId 
   * @returns {Promise<{queries: Array}>}
   */
  async removeItem(userId, productId) {
    const sql = `
      DELETE FROM carrito 
      WHERE usuario_id = $1 AND producto_id = $2
    `;
    const result = await trackedQuery(sql, [userId, productId], 'Remove Cart Item');
    return {
      queries: [result]
    };
  }

  /**
   * Clears the user's cart completely.
   * @param {number} userId 
   * @returns {Promise<{queries: Array}>}
   */
  async clearCart(userId) {
    const sql = `
      DELETE FROM carrito 
      WHERE usuario_id = $1
    `;
    const result = await trackedQuery(sql, [userId], 'Clear Shopping Cart');
    return {
      queries: [result]
    };
  }
}

module.exports = new CarritoRepository();
