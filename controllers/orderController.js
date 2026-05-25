const PedidoRepository = require('../repositories/PedidoRepository');
const CarritoRepository = require('../repositories/CarritoRepository');

function getMeta(req, ...moreQueries) {
  const queries = [...(req.dbQueries || [])];
  for (const qGroup of moreQueries) {
    if (Array.isArray(qGroup)) {
      queries.push(...qGroup);
    } else if (qGroup) {
      queries.push(qGroup);
    }
  }
  return { queries };
}

class OrderController {
  /**
   * Run the checkout transaction (Create Order, Register Items, Deduct Stock, Register Payment, Clear Cart).
   */
  async checkout(req, res) {
    const { direccion_entrega, metodo_pago } = req.body;

    if (!direccion_entrega || !direccion_entrega.direccion || !direccion_entrega.ciudad || !metodo_pago) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona una dirección de entrega completa y un método de pago válido.',
        meta: getMeta(req)
      });
    }

    try {
      // 1. Get the current cart items
      const { data: cartItems, queries: cartQueries } = await CarritoRepository.getCartByUserId(req.user.id);
      req.dbQueries.push(...cartQueries);

      if (cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El carrito de compras está vacío. Agrega productos antes de realizar el pedido.',
          meta: getMeta(req)
        });
      }

      // 2. Stock inventory pre-check and total calculation
      let total = 0;
      const itemsToOrder = [];

      for (const item of cartItems) {
        if (item.stock_total < item.cantidad) {
          return res.status(400).json({
            success: false,
            message: `Stock insuficiente para el producto "${item.nombre}". Stock disponible: ${item.stock_total}, solicitado: ${item.cantidad}.`,
            meta: getMeta(req)
          });
        }
        
        const price = item.precio_descuento ? parseFloat(item.precio_descuento) : parseFloat(item.precio_base);
        total += price * item.cantidad;

        itemsToOrder.push({
          sku: item.sku,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio_unitario: price
        });
      }

      // 3. Execute checkout ACID transaction
      const { data: result, queries: txQueries, durationMs: txDuration } = 
        await PedidoRepository.createCheckoutOrder({
          userId: req.user.id,
          total,
          direccionEntrega: direccion_entrega,
          items: itemsToOrder,
          metodoPago: metodo_pago
        });
      
      // Add transaction timing to the queries log
      req.dbQueries.push(...txQueries);
      req.dbQueries.push({
        operation: 'Checkout Transaction Aggregate',
        sql: 'COMMIT / TRANSACTION',
        durationMs: txDuration
      });

      res.status(201).json({
        success: true,
        message: 'Pedido realizado y pagado con éxito.',
        data: {
          order: result.order,
          payment: result.payment
        },
        meta: getMeta(req)
      });

    } catch (err) {
      console.error('Error during checkout transaction:', err);
      res.status(500).json({
        success: false,
        message: 'Ocurrió un error al procesar el checkout.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Get historical orders with items and payments.
   */
  async getOrders(req, res) {
    try {
      const { data, queries } = await PedidoRepository.getOrdersByUserId(req.user.id);
      req.dbQueries.push(...queries);

      res.status(200).json({
        success: true,
        data,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error fetching orders list:', err);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el historial de pedidos.',
        meta: getMeta(req)
      });
    }
  }
}

module.exports = new OrderController();
