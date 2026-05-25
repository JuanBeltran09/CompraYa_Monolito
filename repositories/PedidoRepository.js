const { trackedQuery, trackedTransaction } = require('../database/db');

class PedidoRepository {
  /**
   * Retrieves all orders for a specific user, along with their items and payments, in a single SQL JOIN query.
   * @param {number} userId 
   * @returns {Promise<{data: Array, queries: Array}>}
   */
  async getOrdersByUserId(userId) {
    const sql = `
      SELECT o.id, o.estado, o.total, o.moneda, o.direccion_entrega, o.creado_en,
             i.producto_sku, i.nombre_producto, i.cantidad, i.precio_unitario,
             p.metodo as pago_metodo, p.estado as pago_estado, p.referencia as pago_referencia, p.procesado_en as pago_fecha
      FROM pedidos o
      LEFT JOIN items_pedido i ON o.id = i.pedido_id
      LEFT JOIN pagos p ON o.id = p.pedido_id
      WHERE o.usuario_id = $1
      ORDER BY o.creado_en DESC, i.id ASC
    `;
    const result = await trackedQuery(sql, [userId], 'Fetch Order History with Details');
    
    // Group rows by order ID
    const ordersMap = new Map();
    for (const row of result.rows) {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          estado: row.estado,
          total: parseFloat(row.total),
          moneda: row.moneda,
          direccion_entrega: row.direccion_entrega,
          creado_en: row.creado_en,
          pago: {
            metodo: row.pago_metodo,
            estado: row.pago_estado,
            referencia: row.pago_referencia,
            fecha: row.pago_fecha
          },
          items: []
        });
      }
      if (row.producto_sku) {
        ordersMap.get(row.id).items.push({
          sku: row.producto_sku,
          nombre: row.nombre_producto,
          cantidad: row.cantidad,
          precio_unitario: parseFloat(row.precio_unitario)
        });
      }
    }

    return {
      data: Array.from(ordersMap.values()),
      queries: [result]
    };
  }

  /**
   * Performs an ACID atomic checkout transaction:
   * 1. Inserts the order.
   * 2. Inserts each order item.
   * 3. Deducts product stock inventory.
   * 4. Inserts the payment record.
   * 5. Clears the shopping cart.
   * @param {Object} orderData 
   * @returns {Promise<{data: Object, queries: Array, durationMs: number}>}
   */
  async createCheckoutOrder({ userId, total, direccionEntrega, items, metodoPago }) {
    const txResult = await trackedTransaction(async (q) => {
      // 1. Create order
      const orderSql = `
        INSERT INTO pedidos (usuario_id, estado, total, direccion_entrega)
        VALUES ($1, $2, $3, $4)
        RETURNING id, usuario_id, estado, total, direccion_entrega, creado_en
      `;
      const orderRes = await q(orderSql, [userId, 'pagado', total, JSON.stringify(direccionEntrega)], 'Create Order Record');
      const orderId = orderRes.rows[0].id;

      // 2. Insert order items and 3. Deduct stock for each item
      for (const item of items) {
        const itemSql = `
          INSERT INTO items_pedido (pedido_id, producto_sku, nombre_producto, cantidad, precio_unitario)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await q(itemSql, [orderId, item.sku, item.nombre, item.cantidad, item.precio_base || item.precio_unitario], 'Insert Order Item');

        const updateStockSql = `
          UPDATE productos 
          SET stock_total = GREATEST(0, stock_total - $1), actualizado_en = NOW()
          WHERE sku = $2
        `;
        await q(updateStockSql, [item.cantidad, item.sku], 'Deduct Product Stock');
      }

      // 4. Create payment
      const paymentSql = `
        INSERT INTO pagos (pedido_id, metodo, estado, referencia, monto)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, referencia, metodo, estado, monto
      `;
      const refCode = 'PAY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      const paymentRes = await q(paymentSql, [orderId, metodoPago, 'aprobado', refCode, total], 'Register Payment');

      // 5. Clear shopping cart
      const clearCartSql = `
        DELETE FROM carrito 
        WHERE usuario_id = $1
      `;
      await q(clearCartSql, [userId], 'Clear User Cart');

      return {
        order: orderRes.rows[0],
        payment: paymentRes.rows[0]
      };
    }, 'Checkout Order Transaction');

    return {
      data: txResult.result,
      durationMs: txResult.durationMs,
      queries: txResult.queries
    };
  }
}

module.exports = new PedidoRepository();
