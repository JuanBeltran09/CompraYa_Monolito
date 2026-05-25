const CarritoRepository = require('../repositories/CarritoRepository');
const ProductoRepository = require('../repositories/ProductoRepository');

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

class CartController {
  /**
   * Get the active user's cart from the database.
   */
  async getCart(req, res) {
    try {
      const { data, queries } = await CarritoRepository.getCartByUserId(req.user.id);
      req.dbQueries.push(...queries);

      res.status(200).json({
        success: true,
        data,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error fetching cart:', err);
      res.status(500).json({
        success: false,
        message: 'Error al obtener el carrito de compras.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Add a product or increment its quantity in the database cart.
   */
  async addItem(req, res) {
    const { producto_id, cantidad } = req.body;
    const qty = parseInt(cantidad || 1);

    if (!producto_id || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Producto o cantidad inválida.',
        meta: getMeta(req)
      });
    }

    try {
      // 1. Verify product exists and has stock
      const { data: product, queries: prodQueries } = await ProductoRepository.getById(producto_id);
      req.dbQueries.push(...prodQueries);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'El producto seleccionado no existe.',
          meta: getMeta(req)
        });
      }

      // 2. Perform DB Cart upsert
      const { data: cartItem, queries: cartQueries } = await CarritoRepository.addOrIncrementItem(
        req.user.id,
        producto_id,
        qty
      );
      req.dbQueries.push(...cartQueries);

      res.status(200).json({
        success: true,
        message: `Se agregaron ${qty} unidades de "${product.nombre}" al carrito.`,
        data: cartItem,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error adding to cart:', err);
      res.status(500).json({
        success: false,
        message: 'Error al agregar el producto al carrito.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Set specific quantity of a product in the database cart.
   */
  async updateQuantity(req, res) {
    const { producto_id, cantidad } = req.body;
    const qty = parseInt(cantidad);

    if (!producto_id || isNaN(qty) || qty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros inválidos.',
        meta: getMeta(req)
      });
    }

    try {
      const { data: product, queries: prodQueries } = await ProductoRepository.getById(producto_id);
      req.dbQueries.push(...prodQueries);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'El producto no existe.',
          meta: getMeta(req)
        });
      }

      const { data: cartItem, queries: cartQueries } = await CarritoRepository.setItemQuantity(
        req.user.id,
        producto_id,
        qty
      );
      req.dbQueries.push(...cartQueries);

      res.status(200).json({
        success: true,
        message: 'Cantidad actualizada correctamente.',
        data: cartItem,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error updating cart quantity:', err);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar cantidad en el carrito.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Remove an item from the database cart.
   */
  async removeItem(req, res) {
    const productId = parseInt(req.params.productId);
    
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de producto inválido.',
        meta: getMeta(req)
      });
    }

    try {
      const { queries: removeQueries } = await CarritoRepository.removeItem(req.user.id, productId);
      req.dbQueries.push(...removeQueries);

      res.status(200).json({
        success: true,
        message: 'Producto removido del carrito.',
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error removing cart item:', err);
      res.status(500).json({
        success: false,
        message: 'Error al remover producto del carrito.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Synchronize guest local cart to the database cart upon login.
   * Receives an array of { producto_id, cantidad } and batch inserts/upserts them.
   */
  async syncCart(req, res) {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'La lista de ítems a sincronizar debe ser un arreglo.',
        meta: getMeta(req)
      });
    }

    try {
      const queries = [];
      for (const item of items) {
        const prodId = parseInt(item.producto_id);
        const qty = parseInt(item.cantidad);
        if (!isNaN(prodId) && !isNaN(qty) && qty > 0) {
          const { queries: upsertQueries } = await CarritoRepository.addOrIncrementItem(
            req.user.id,
            prodId,
            qty
          );
          queries.push(...upsertQueries);
        }
      }
      req.dbQueries.push(...queries);

      // Fetch the final merged cart to return
      const { data: finalCart, queries: cartQueries } = await CarritoRepository.getCartByUserId(req.user.id);
      req.dbQueries.push(...cartQueries);

      res.status(200).json({
        success: true,
        message: 'Carrito sincronizado exitosamente.',
        data: finalCart,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error syncing cart:', err);
      res.status(500).json({
        success: false,
        message: 'Error al sincronizar el carrito de compras.',
        meta: getMeta(req)
      });
    }
  }
}

module.exports = new CartController();
