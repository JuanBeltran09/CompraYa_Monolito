const CategoriaRepository = require('../repositories/CategoriaRepository');
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

class CatalogController {
  /**
   * Fetch all categories for filtering in the UI.
   */
  async getCategories(req, res) {
    try {
      const { data, queries } = await CategoriaRepository.getAll();
      req.dbQueries.push(...queries);

      res.status(200).json({
        success: true,
        data,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).json({
        success: false,
        message: 'Error al obtener las categorías.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Fetch paginated and filtered list of products.
   */
  async getProducts(req, res) {
    const search = req.query.search || '';
    const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 12;

    try {
      const { data, total, page: activePage, limit: activeLimit, queries } = 
        await ProductoRepository.findWithPagination({
          search,
          categoryId,
          page,
          limit
        });
      req.dbQueries.push(...queries);

      res.status(200).json({
        success: true,
        data,
        pagination: {
          total_items: total,
          total_pages: Math.ceil(total / activeLimit),
          current_page: activePage,
          limit: activeLimit
        },
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({
        success: false,
        message: 'Error al obtener los productos del catálogo.',
        meta: getMeta(req)
      });
    }
  }

  /**
   * Fetch details for a single product.
   */
  async getProductById(req, res) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Identificador de producto inválido.',
        meta: getMeta(req)
      });
    }

    try {
      const { data, queries } = await ProductoRepository.getById(id);
      req.dbQueries.push(...queries);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'El producto solicitado no existe.',
          meta: getMeta(req)
        });
      }

      res.status(200).json({
        success: true,
        data,
        meta: getMeta(req)
      });
    } catch (err) {
      console.error('Error fetching product details:', err);
      res.status(500).json({
        success: false,
        message: 'Error al obtener detalles del producto.',
        meta: getMeta(req)
      });
    }
  }
}

module.exports = new CatalogController();
