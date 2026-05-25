/**
 * CompraYa SPA Client State Manager & Router
 */

class CompraYaApp {
  constructor() {
    this.user = null;
    this.sessionId = null;
    
    // Cart State: loaded from DB when authenticated, or LocalStorage when guest
    this.cartItems = [];

    // Catalog State
    this.currentPage = 1;
    this.activeSearch = '';
    this.activeCategory = null;
    this.categories = [];

    // Search input debounce timer
    this.searchTimer = null;
  }

  /**
   * Initializes the application, binds DOM events, and runs security checks.
   */
  async init() {
    this.bindEvents();
    
    // 1. Check for persistent session in LocalStorage
    const storedSession = localStorage.getItem('session_id');
    if (storedSession) {
      this.sessionId = storedSession;
      await this.restoreSession();
    } else {
      this.loadGuestCart();
      this.updateHeaderAuth();
    }

    // 2. Load initial catalog data (Categories list + Products grid)
    await this.loadCategories();
    await this.loadProducts();
  }

  /**
   * Binds UI controls, forms, and triggers navigation routing.
   */
  bindEvents() {
    // Navigation Buttons
    document.getElementById('btn-nav-catalog').addEventListener('click', (e) => { e.preventDefault(); this.switchView('view-catalog'); });
    document.getElementById('btn-nav-cart').addEventListener('click', (e) => { e.preventDefault(); this.switchView('view-cart'); });
    document.getElementById('btn-nav-orders').addEventListener('click', (e) => { e.preventDefault(); this.switchView('view-orders'); });
    document.getElementById('nav-logo').addEventListener('click', (e) => { e.preventDefault(); this.switchView('view-catalog'); });
    
    document.getElementById('btn-login-trigger').addEventListener('click', () => this.switchView('view-auth'));
    document.getElementById('btn-cart-empty-catalog').addEventListener('click', () => this.switchView('view-catalog'));
    
    const ordersLoginBtn = document.getElementById('btn-orders-login-trigger');
    if (ordersLoginBtn) {
      ordersLoginBtn.addEventListener('click', () => this.switchView('view-auth'));
    }

    // Auth Form Tabs Switcher
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const boxLogin = document.getElementById('auth-login-box');
    const boxRegister = document.getElementById('auth-register-box');

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      boxLogin.classList.add('active');
      boxRegister.classList.remove('active');
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      boxRegister.classList.add('active');
      boxLogin.classList.remove('active');
    });

    // Login Form Submit
    document.getElementById('form-login').addEventListener('submit', (e) => this.handleLogin(e));
    
    // Register Form Submit
    document.getElementById('form-register').addEventListener('submit', (e) => this.handleRegister(e));

    // Debounced Search Input (Wait 350ms after typing finishes to query DB)
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.activeSearch = searchInput.value;
        this.currentPage = 1; // reset page
        this.loadProducts();
      }, 350);
    });

    // Clear Filters Button
    document.getElementById('btn-clear-filters').addEventListener('click', () => {
      document.getElementById('search-input').value = '';
      this.activeSearch = '';
      this.activeCategory = null;
      this.currentPage = 1;
      
      // Update Category UI Pills
      document.querySelectorAll('.category-pill').forEach(el => el.classList.remove('active'));
      const allPill = document.querySelector('[data-category-id="all"]');
      if (allPill) allPill.classList.add('active');
      
      this.loadProducts();
    });

    // Checkout Form Submit
    document.getElementById('checkout-form').addEventListener('submit', (e) => this.handleCheckout(e));

    // Floating DB Monitor Panel Toggle
    const monitor = document.getElementById('db-monitor');
    const toggleBtn = document.getElementById('btn-toggle-monitor');
    const monitorHeader = document.getElementById('db-monitor-header');
    
    const toggleMonitor = () => {
      monitor.classList.toggle('closed');
      const isClosed = monitor.classList.contains('closed');
      toggleBtn.innerHTML = isClosed ? '<i class="fa-solid fa-chevron-up"></i>' : '<i class="fa-solid fa-chevron-down"></i>';
    };

    monitorHeader.addEventListener('click', toggleMonitor);

    // Modal Close
    document.getElementById('btn-close-modal').addEventListener('click', () => {
      document.getElementById('product-detail-modal').classList.remove('active');
    });
    
    // Clicking outside modal content closes it
    document.getElementById('product-detail-modal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('product-detail-modal')) {
        document.getElementById('product-detail-modal').classList.remove('active');
      }
    });
  }

  /**
   * Switches views in SPA mode.
   */
  switchView(viewId) {
    // 1. Deactivate all views and header navigation links
    document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    // 2. Activate target view
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }

    // 3. Highlight navigation link
    if (viewId === 'view-catalog') {
      document.getElementById('btn-nav-catalog').classList.add('active');
    } else if (viewId === 'view-cart') {
      document.getElementById('btn-nav-cart').classList.add('active');
      this.renderCart(); // Refresh cart UI
    } else if (viewId === 'view-orders') {
      document.getElementById('btn-nav-orders').classList.add('active');
      this.loadOrderHistory(); // Load orders
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ==========================================================================
     AUTHENTICATION SYSTEM
     ========================================================================== */

  /**
   * Attempts to restore user profile from active database session.
   */
  async restoreSession() {
    try {
      const res = await api.get('/auth/session', 'Session Restore');
      if (res && res.success && res.data && res.data.user) {
        this.user = res.data.user;
        this.updateHeaderAuth();
        await this.syncAndLoadCart();
      } else {
        // Session expired or invalid
        this.logoutLocal();
      }
    } catch (e) {
      console.error('Session restoration failed:', e);
      this.logoutLocal();
    }
  }

  /**
   * Handle user login.
   */
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await api.post('/auth/login', { email, password }, 'User Login');
      if (res && res.success && res.data) {
        this.user = res.data.user;
        this.sessionId = res.data.session_id;
        
        localStorage.setItem('session_id', this.sessionId);
        ui.showToast(res.message, 'success');
        
        this.updateHeaderAuth();
        await this.syncAndLoadCart();
        
        // Redirect to catalog page
        this.switchView('view-catalog');
      } else {
        ui.showToast(res.message || 'Error de autenticación.', 'danger');
      }
    } catch (err) {
      ui.showToast('Error al conectar con el servidor.', 'danger');
    }
  }

  /**
   * Handle user registration.
   */
  async handleRegister(e) {
    e.preventDefault();
    const nombre_completo = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const ciudad = document.getElementById('reg-city').value;
    const direccion = document.getElementById('reg-address').value;

    const body = {
      email,
      password,
      nombre_completo,
      pais: 'Colombia',
      direccion: { ciudad, nomenclatura: direccion }
    };

    try {
      const res = await api.post('/auth/register', body, 'User Registration');
      if (res && res.success && res.data) {
        this.user = res.data.user;
        this.sessionId = res.data.session_id;

        localStorage.setItem('session_id', this.sessionId);
        ui.showToast(res.message, 'success');

        this.updateHeaderAuth();
        await this.syncAndLoadCart();

        // Redirect to catalog
        this.switchView('view-catalog');
      } else {
        ui.showToast(res.message || 'Error al registrarse.', 'danger');
      }
    } catch (err) {
      ui.showToast('Error de conexión con el servidor.', 'danger');
    }
  }

  /**
   * Handle user logout.
   */
  async logout() {
    try {
      await api.post('/auth/logout', {}, 'User Logout');
    } catch (e) {
      console.error('Server logout failed:', e);
    }
    this.logoutLocal();
  }

  /**
   * Local cleanup after logout or session invalidation.
   */
  logoutLocal() {
    this.user = null;
    this.sessionId = null;
    localStorage.removeItem('session_id');
    
    // Clear cart and switch to guest LocalStorage
    this.cartItems = [];
    this.loadGuestCart();
    
    this.updateHeaderAuth();
    ui.showToast('Sesión cerrada correctamente.', 'success');
    this.switchView('view-catalog');
  }

  /**
   * Updates the navigation bar auth buttons depending on session state.
   */
  updateHeaderAuth() {
    const container = document.getElementById('header-auth-container');
    if (!container) return;

    if (this.user) {
      // Authenticated User UI
      const nameInitials = this.user.nombre_completo.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();
      container.innerHTML = `
        <div class="user-profile-header">
          <div class="user-avatar-badge">${nameInitials}</div>
          <div class="user-meta-header">
            <span class="user-name-head">${this.user.nombre_completo}</span>
            <span style="font-size:0.72rem; color:var(--text-muted);">${this.user.email}</span>
          </div>
          <button class="btn btn-icon text-danger" onclick="app.logout()" title="Cerrar Sesión">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>
      `;
    } else {
      // Guest User UI
      container.innerHTML = `
        <button class="btn btn-outline" onclick="app.switchView('view-auth')">
          <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar Sesión
        </button>
      `;
    }
  }

  /* ==========================================================================
     CATALOG SYSTEM
     ========================================================================== */

  /**
   * Loads all categories for filter menu.
   */
  async loadCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    try {
      const res = await api.get('/catalog/categories', 'Load Categories');
      if (res && res.success) {
        this.categories = res.data;
        
        // Render category pills
        let html = `<div class="category-pill active" data-category-id="all" onclick="app.selectCategory(null)">Todos los Productos</div>`;
        
        this.categories.forEach(cat => {
          html += `
            <div class="category-pill" data-category-id="${cat.id}" onclick="app.selectCategory(${cat.id})">
              ${cat.nombre}
            </div>
          `;
        });
        
        container.innerHTML = html;
      }
    } catch (e) {
      container.innerHTML = '<p class="text-danger">Error al cargar categorías</p>';
    }
  }

  /**
   * Handle category selection from pills.
   */
  selectCategory(categoryId) {
    this.activeCategory = categoryId;
    this.currentPage = 1; // reset page

    // Update active visual class
    document.querySelectorAll('.category-pill').forEach(el => el.classList.remove('active'));
    
    const selector = categoryId ? `[data-category-id="${categoryId}"]` : '[data-category-id="all"]';
    const activeEl = document.querySelector(selector);
    if (activeEl) {
      activeEl.classList.add('active');
    }

    this.loadProducts();
  }

  /**
   * Queries products with pagination and filters.
   */
  async loadProducts() {
    const grid = document.getElementById('product-grid-container');
    const pagContainer = document.getElementById('pagination-container');
    const timingStrip = document.getElementById('catalog-timing-strip');
    
    if (!grid || !pagContainer || !timingStrip) return;

    // Show loading skeletons
    grid.innerHTML = Array(6).fill('<div class="product-card skeleton-card"></div>').join('');
    pagContainer.innerHTML = '';
    
    let url = `/catalog/products?page=${this.currentPage}&limit=12`;
    if (this.activeSearch) url += `&search=${encodeURIComponent(this.activeSearch)}`;
    if (this.activeCategory) url += `&category_id=${this.activeCategory}`;

    try {
      const res = await api.get(url, 'Fetch Catalog Products');
      
      // Update timings badge
      if (res && res.meta && res.meta.queries) {
        timingStrip.innerHTML = ui.getTimingStripHtml(res.meta.queries);
      }

      if (res && res.success) {
        const products = res.data;
        const pg = res.pagination;

        if (products.length === 0) {
          grid.innerHTML = `
            <div class="glass-card text-center p-5 w-full" style="grid-column: 1 / -1;">
              <i class="fa-solid fa-boxes-empty fa-2x text-muted mb-4"></i>
              <h3>No se encontraron productos</h3>
              <p class="text-muted mt-2">Prueba cambiando la categoría o los términos de tu búsqueda.</p>
            </div>
          `;
          return;
        }

        // Render product cards
        grid.innerHTML = products.map(p => ui.createProductCardHtml(p)).join('');
        
        // Render pagination buttons
        this.renderPagination(pg.current_page, pg.total_pages);
      } else {
        grid.innerHTML = `<p class="text-danger w-full">Error al procesar la solicitud: ${res.message}</p>`;
      }
    } catch (e) {
      grid.innerHTML = '<p class="text-danger w-full">Error de conexión al cargar productos.</p>';
    }
  }

  /**
   * Renders pagination buttons.
   */
  renderPagination(current, total) {
    const container = document.getElementById('pagination-container');
    if (!container || total <= 1) return;

    let html = `
      <button class="pagination-btn ${current === 1 ? 'disabled' : ''}" onclick="app.changePage(${current - 1})" ${current === 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i>
      </button>
    `;

    // Render page indexes (max 5 visible)
    const range = 2;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - range && i <= current + range)) {
        html += `
          <button class="pagination-btn ${current === i ? 'active' : ''}" onclick="app.changePage(${i})">
            ${i}
          </button>
        `;
      } else if (i === current - range - 1 || i === current + range + 1) {
        html += `<span class="text-muted">...</span>`;
      }
    }

    html += `
      <button class="pagination-btn ${current === total ? 'disabled' : ''}" onclick="app.changePage(${current + 1})" ${current === total ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;

    container.innerHTML = html;
  }

  changePage(pageNum) {
    this.currentPage = pageNum;
    this.loadProducts();
    window.scrollTo({ top: document.querySelector('.hero-banner').offsetTop - 20, behavior: 'smooth' });
  }

  /**
   * Fetch single product detail and render inside Modal.
   */
  async viewProductDetail(productId) {
    const modal = document.getElementById('product-detail-modal');
    const modalContent = document.getElementById('modal-product-content');
    
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
      <div style="text-align:center; padding:3rem;">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x text-primary"></i>
        <p class="mt-2 text-muted">Consultando especificaciones del producto...</p>
      </div>
    `;
    modal.classList.add('active');

    try {
      const res = await api.get(`/catalog/products/${productId}`, 'Fetch Product Specifications');
      if (res && res.success) {
        const prod = res.data;
        
        let attrsTableHtml = '';
        if (prod.atributos) {
          const attrs = typeof prod.atributos === 'string' ? JSON.parse(prod.atributos) : prod.atributos;
          Object.keys(attrs).forEach(key => {
            // Capitalize key
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            attrsTableHtml += `
              <tr>
                <td>${label}</td>
                <td><strong>${attrs[key]}</strong></td>
              </tr>
            `;
          });
        }

        const price = prod.precio_descuento ? parseFloat(prod.precio_descuento) : parseFloat(prod.precio_base);
        const isOutOfStock = prod.stock_total <= 0;

        modalContent.innerHTML = `
          <div class="modal-prod-detail">
            <div>
              <img src="${prod.imagen_url || 'https://picsum.photos/seed/' + prod.sku + '/400/300'}" class="modal-prod-img" alt="${prod.nombre}">
              <div class="timing-strip mt-3" style="justify-content:center;">
                ${ui.getTimingStripHtml(res.meta.queries)}
              </div>
            </div>
            <div class="modal-prod-info">
              <span class="product-category-name">${prod.categoria_nombre || 'General'}</span>
              <h2 class="modal-prod-title">${prod.nombre}</h2>
              <span class="text-muted" style="font-family:monospace; font-size:0.8rem; margin-bottom:1rem; display:block;">SKU: ${prod.sku}</span>
              
              <div class="product-price-row mb-4">
                <span class="price-value" style="font-size:1.8rem; color:var(--success);">${ui.formatCOP(price)} COP</span>
                ${prod.precio_descuento ? `<span class="price-original" style="font-size:1.1rem;">${ui.formatCOP(prod.precio_base)}</span>` : ''}
              </div>

              <h4 class="mb-2" style="font-family:var(--font-display); font-weight:600;"><i class="fa-solid fa-align-left"></i> Descripción</h4>
              <p class="modal-prod-desc">${prod.descripcion || 'Sin descripción disponible.'}</p>

              <h4 class="mb-2" style="font-family:var(--font-display); font-weight:600;"><i class="fa-solid fa-gears"></i> Ficha Técnica (JSONB)</h4>
              <table class="attributes-table">
                <tbody>
                  ${attrsTableHtml || '<tr><td colspan="2" class="text-muted">Ningún atributo técnico especificado.</td></tr>'}
                  <tr>
                    <td>Inventario</td>
                    <td><strong class="${isOutOfStock ? 'text-danger' : 'text-success'}">${isOutOfStock ? 'Agotado' : `${prod.stock_total} unidades disponibles`}</strong></td>
                  </tr>
                </tbody>
              </table>

              <button class="btn btn-primary btn-large w-full mt-auto" ${isOutOfStock ? 'disabled' : ''} onclick="app.addToCart(${prod.id}, 1); document.getElementById('product-detail-modal').classList.remove('active');">
                <i class="fa-solid fa-cart-plus"></i> Agregar al Carrito
              </button>
            </div>
          </div>
        `;
      } else {
        modalContent.innerHTML = `<p class="text-danger">${res.message}</p>`;
      }
    } catch (e) {
      modalContent.innerHTML = '<p class="text-danger">Error de red al consultar el producto.</p>';
    }
  }

  /* ==========================================================================
     SHOPPING CART SYSTEM
     ========================================================================== */

  /**
   * Loads the guest cart from LocalStorage.
   */
  loadGuestCart() {
    try {
      const stored = localStorage.getItem('guest_cart');
      this.cartItems = stored ? JSON.parse(stored) : [];
      this.updateCartBadge();
    } catch (e) {
      this.cartItems = [];
    }
  }

  /**
   * Saves guest cart in LocalStorage.
   */
  saveGuestCart() {
    localStorage.setItem('guest_cart', JSON.stringify(this.cartItems));
    this.updateCartBadge();
  }

  /**
   * Synchronizes LocalStorage guest items with Database on Login/Register.
   */
  async syncAndLoadCart() {
    if (!this.user) return;
    
    const guestItems = [];
    try {
      const stored = localStorage.getItem('guest_cart');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.forEach(item => {
          guestItems.push({ producto_id: item.producto_id, cantidad: item.cantidad });
        });
      }
    } catch (e) {
      console.error(e);
    }

    try {
      if (guestItems.length > 0) {
        // Send items to server for synchronization merge
        const res = await api.post('/cart/sync', { items: guestItems }, 'Sync Local Cart to DB');
        if (res && res.success) {
          this.cartItems = res.data;
          // Clear local cart
          localStorage.removeItem('guest_cart');
        }
      } else {
        // Fetch cart from DB
        const res = await api.get('/cart', 'Fetch Active Cart from DB');
        if (res && res.success) {
          this.cartItems = res.data;
        }
      }
    } catch (e) {
      console.error('Failed to sync cart:', e);
    }
    this.updateCartBadge();
  }

  /**
   * Increment navigation badge indicator.
   */
  updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;
    
    const totalQty = this.cartItems.reduce((sum, item) => sum + item.cantidad, 0);
    badge.innerText = totalQty;
  }

  /**
   * Adds an item to the shopping cart (local/remote).
   */
  async addToCart(productId, quantity = 1) {
    if (this.user) {
      // Authenticated User: Save to PostgreSQL
      try {
        const res = await api.post('/cart/add', { producto_id: productId, cantidad: quantity }, 'Add Cart Item DB');
        if (res && res.success) {
          ui.showToast(res.message, 'success');
          await this.syncAndLoadCart(); // refresh state
        } else {
          ui.showToast(res.message || 'Error al agregar al carrito.', 'danger');
        }
      } catch (err) {
        ui.showToast('Error de conexión con la base de datos.', 'danger');
      }
    } else {
      // Guest User: Save to LocalStorage
      // Fetch product catalog item details to show preview
      try {
        const res = await api.get(`/catalog/products/${productId}`, 'Fetch Product Details (Guest Add)');
        if (res && res.success) {
          const prod = res.data;
          
          const existing = this.cartItems.find(item => item.producto_id === productId);
          if (existing) {
            existing.cantidad += quantity;
          } else {
            this.cartItems.push({
              producto_id: productId,
              cantidad: quantity,
              nombre: prod.nombre,
              sku: prod.sku,
              precio_base: prod.precio_base,
              precio_descuento: prod.precio_descuento,
              imagen_url: prod.imagen_url,
              stock_total: prod.stock_total
            });
          }
          this.saveGuestCart();
          ui.showToast(`"${prod.nombre}" agregado al carrito (Invitado).`, 'success');
        }
      } catch (e) {
        ui.showToast('Error al agregar al carrito.', 'danger');
      }
    }
  }

  /**
   * Handles increment/decrement on cart row spinners.
   */
  async changeCartQty(productId, delta) {
    const item = this.cartItems.find(i => i.producto_id === productId);
    if (!item) return;

    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
      await this.removeCartItem(productId);
      return;
    }

    if (newQty > item.stock_total) {
      ui.showToast(`Stock insuficiente. Stock total: ${item.stock_total}`, 'warning');
      return;
    }

    if (this.user) {
      try {
        const res = await api.post('/cart/update', { producto_id: productId, cantidad: newQty }, 'Update Cart Quantity DB');
        if (res && res.success) {
          await this.syncAndLoadCart();
          this.renderCart();
        }
      } catch (e) {
        ui.showToast('Error al modificar cantidad.', 'danger');
      }
    } else {
      item.cantidad = newQty;
      this.saveGuestCart();
      this.renderCart();
    }
  }

  /**
   * Removes an item from the cart.
   */
  async removeCartItem(productId) {
    if (this.user) {
      try {
        const res = await api.delete(`/cart/remove/${productId}`, 'Remove Cart Item DB');
        if (res && res.success) {
          ui.showToast(res.message, 'success');
          await this.syncAndLoadCart();
          this.renderCart();
        }
      } catch (e) {
        ui.showToast('Error de red al eliminar ítem.', 'danger');
      }
    } else {
      this.cartItems = this.cartItems.filter(i => i.producto_id !== productId);
      this.saveGuestCart();
      this.renderCart();
      ui.showToast('Ítem removido.', 'success');
    }
  }

  /**
   * Renders Shopping Cart views.
   */
  renderCart() {
    const layout = document.getElementById('cart-layout-container');
    const emptyState = document.getElementById('cart-empty-state');
    const tableBody = document.getElementById('cart-table-body');
    
    const subtotalEl = document.getElementById('cart-summary-subtotal');
    const totalEl = document.getElementById('cart-summary-total');
    const timingStrip = document.getElementById('cart-timing-strip');
    const checkoutBox = document.getElementById('checkout-form-box');

    if (!layout || !emptyState || !tableBody || !subtotalEl || !totalEl || !timingStrip) return;

    // Reset timing strip
    timingStrip.innerHTML = '';
    
    // Inject last queries if logged in
    const lastQueries = window.queryHistory.filter(q => q.operation.includes('Cart') || q.operation.includes('Sync'));
    if (this.user && lastQueries.length > 0) {
      timingStrip.innerHTML = ui.getTimingStripHtml(lastQueries.slice(-2));
    }

    if (this.cartItems.length === 0) {
      layout.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    layout.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Populate rows
    tableBody.innerHTML = this.cartItems.map(item => ui.createCartRowHtml(item)).join('');

    // Calculations
    let subtotal = 0;
    this.cartItems.forEach(item => {
      const price = item.precio_descuento ? parseFloat(item.precio_descuento) : parseFloat(item.precio_base);
      subtotal += price * item.cantidad;
    });

    subtotalEl.innerText = `${ui.formatCOP(subtotal)} COP`;
    totalEl.innerText = `${ui.formatCOP(subtotal)} COP`;

    // Toggle checkout form box based on user authentication
    if (!this.user) {
      checkoutBox.innerHTML = `
        <div class="glass-card text-center p-3" style="border: 1px dashed var(--glass-border);">
          <i class="fa-solid fa-lock-open fa-lg text-warning mb-2"></i>
          <h4>Checkout Bloqueado</h4>
          <p class="text-muted" style="font-size:0.82rem;">Inicia sesión en tu cuenta para poder procesar la compra e impactar la base de datos de manera atómica.</p>
          <button class="btn btn-primary btn-full mt-2" onclick="app.switchView('view-auth')">
            <i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar Sesión
          </button>
        </div>
      `;
    } else {
      // Restore default checkout form layout if altered by guest message
      checkoutBox.innerHTML = `
        <h4 class="form-title"><i class="fa-solid fa-truck-fast"></i> Datos de Entrega</h4>
        <form id="checkout-form">
          <div class="form-group">
            <label for="checkout-address">Dirección de Envío</label>
            <input type="text" id="checkout-address" placeholder="Ej. Calle 45 # 12-34, Apto 501" required>
          </div>
          <div class="form-group">
            <label for="checkout-city">Ciudad</label>
            <select id="checkout-city" required>
              <option value="Bogotá" selected>Bogotá</option>
              <option value="Medellín">Medellín</option>
              <option value="Cali">Cali</option>
              <option value="Barranquilla">Barranquilla</option>
              <option value="Bucaramanga">Bucaramanga</option>
            </select>
          </div>
          <div class="form-group">
            <label>Método de Pago Simulado</label>
            <div class="payment-radios">
              <label class="payment-radio-label">
                <input type="radio" name="payment_method" value="PSE" checked>
                <span class="custom-radio"></span>
                <i class="fa-solid fa-building-columns"></i> PSE (Débito)
              </label>
              <label class="payment-radio-label">
                <input type="radio" name="payment_method" value="tarjeta">
                <span class="custom-radio"></span>
                <i class="fa-solid fa-credit-card"></i> Tarjeta de Crédito
              </label>
              <label class="payment-radio-label">
                <input type="radio" name="payment_method" value="efectivo">
                <span class="custom-radio"></span>
                <i class="fa-solid fa-money-bill-wave"></i> Efectivo
              </label>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-full btn-large" id="btn-checkout-submit">
            <i class="fa-solid fa-lock"></i> Finalizar Compra (ACID Tx)
          </button>
        </form>
      `;
      // Rebind checkout submit listener
      document.getElementById('checkout-form').addEventListener('submit', (e) => this.handleCheckout(e));
    }
  }

  /* ==========================================================================
     ORDER PROCESSING & HISTORY SYSTEM
     ========================================================================== */

  /**
   * Handle transactional Checkout (ACID).
   */
  async handleCheckout(e) {
    e.preventDefault();
    if (!this.user) {
      ui.showToast('Debes iniciar sesión para realizar pedidos.', 'warning');
      this.switchView('view-auth');
      return;
    }

    const direccion = document.getElementById('checkout-address').value;
    const ciudad = document.getElementById('checkout-city').value;
    const metodoPago = document.querySelector('input[name="payment_method"]:checked').value;

    const checkoutBtn = document.getElementById('btn-checkout-submit');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando Transacción...';

    const body = {
      direccion_entrega: { direccion, ciudad },
      metodo_pago: metodoPago
    };

    try {
      const res = await api.post('/orders/checkout', body, 'Commit Checkout Order');
      if (res && res.success) {
        ui.showToast(res.message, 'success');
        
        // Empty local cart cache
        this.cartItems = [];
        this.updateCartBadge();
        
        // Redirect to Orders dashboard
        this.switchView('view-orders');
      } else {
        ui.showToast(res.message || 'Error al completar la transacción.', 'danger');
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Finalizar Compra (ACID Tx)';
      }
    } catch (err) {
      ui.showToast('Error de red al procesar el checkout.', 'danger');
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Finalizar Compra (ACID Tx)';
    }
  }

  /**
   * Loads the historical orders for the logged-in user.
   */
  async loadOrderHistory() {
    const listBox = document.getElementById('orders-list-box');
    const guestState = document.getElementById('orders-guest-state');
    const timingStrip = document.getElementById('orders-timing-strip');

    if (!listBox || !guestState || !timingStrip) return;

    timingStrip.innerHTML = '';

    if (!this.user) {
      listBox.classList.add('hidden');
      guestState.classList.remove('hidden');
      return;
    }

    listBox.classList.remove('hidden');
    guestState.classList.add('hidden');

    listBox.innerHTML = `
      <div class="glass-card text-center p-5">
        <i class="fa-solid fa-circle-notch fa-spin fa-2x text-primary"></i>
        <p class="mt-2 text-muted">Consultando base de datos por tus facturas...</p>
      </div>
    `;

    try {
      const res = await api.get('/orders', 'Fetch Order History');
      
      // Render SQL query times
      if (res && res.meta && res.meta.queries) {
        timingStrip.innerHTML = ui.getTimingStripHtml(res.meta.queries);
      }

      if (res && res.success) {
        const orders = res.data;
        if (orders.length === 0) {
          listBox.innerHTML = `
            <div class="glass-card text-center p-5">
              <i class="fa-solid fa-file-invoice fa-2x text-muted mb-4"></i>
              <h3>Aún no has realizado pedidos</h3>
              <p class="text-muted mt-2">Visita el catálogo, agrega productos al carrito y finaliza tu compra para ver tu historial aquí.</p>
              <button class="btn btn-primary mt-3" onclick="app.switchView('view-catalog')"><i class="fa-solid fa-store"></i> Explorar Catálogo</button>
            </div>
          `;
          return;
        }

        // Render accordion card items
        listBox.innerHTML = orders.map(o => ui.createOrderCardHtml(o)).join('');
      } else {
        listBox.innerHTML = `<p class="text-danger">Error al consultar el historial: ${res.message}</p>`;
      }
    } catch (e) {
      listBox.innerHTML = '<p class="text-danger">Error de conexión al cargar historial de pedidos.</p>';
    }
  }

  /**
   * Helper to toggle open/close order detail rows in accordion.
   */
  toggleOrderAccordion(orderId) {
    const card = document.getElementById(`order-card-${orderId}`);
    if (card) {
      card.classList.toggle('expanded');
    }
  }
}

// Instantiate and expose globally
window.app = new CompraYaApp();

// Boot application upon DOM render
document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
