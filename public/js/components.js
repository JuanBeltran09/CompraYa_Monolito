/**
 * CompraYa Frontend Components & Templates
 */

// Helper to format currency in COP
function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount);
}

// 1. Toast Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-check-circle text-success';
  if (type === 'danger') iconClass = 'fa-exclamation-circle text-danger';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle text-warning';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);

  // Close button click listener
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.style.animation = 'fadeIn 0.2s reverse forwards';
    setTimeout(() => toast.remove(), 200);
  });

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'fadeIn 0.2s reverse forwards';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}

// 2. Query timing strip generator
function getTimingStripHtml(queries) {
  if (!Array.isArray(queries) || queries.length === 0) return '';
  
  return queries.map(q => {
    let speedClass = 'fast';
    let icon = 'fa-bolt';
    
    if (q.durationMs > 200) {
      speedClass = 'slow';
      icon = 'fa-triangle-exclamation';
    } else if (q.durationMs > 50) {
      speedClass = 'moderate';
      icon = 'fa-hourglass-half';
    }
    
    return `
      <span class="timing-badge ${speedClass}" title="${q.sql}">
        <i class="fa-solid ${icon}"></i> 
        ${q.operation}: <strong>${q.durationMs}ms</strong>
      </span>
    `;
  }).join('');
}

// 3. Product Card Renderer
function createProductCardHtml(product) {
  const isOutOfStock = product.stock_total <= 0;
  const isLowStock = product.stock_total > 0 && product.stock_total <= 20;
  
  let stockClass = 'stock-ok';
  let stockText = `${product.stock_total} disp.`;
  if (isOutOfStock) {
    stockClass = 'stock-empty';
    stockText = 'Agotado';
  } else if (isLowStock) {
    stockClass = 'stock-low';
    stockText = '¡Últimas unidades!';
  }

  // Render flexible attributes from JSONB
  let attributesHtml = '';
  if (product.atributos) {
    let attrs = typeof product.atributos === 'string' ? JSON.parse(product.atributos) : product.atributos;
    if (attrs.marca) attributesHtml += `<span class="attribute-pill">${attrs.marca}</span>`;
    if (attrs.procesador) attributesHtml += `<span class="attribute-pill"><i class="fa-solid fa-microchip"></i> ${attrs.procesador}</span>`;
    if (attrs.talla) attributesHtml += `<span class="attribute-pill">Talla: ${attrs.talla}</span>`;
    if (attrs.color) attributesHtml += `<span class="attribute-pill" style="border-color:${attrs.color}">${attrs.color}</span>`;
  }

  const priceBase = parseFloat(product.precio_base);
  const priceDiscount = product.precio_descuento ? parseFloat(product.precio_descuento) : null;

  return `
    <div class="product-card glass-card">
      <div class="product-image-container">
        <span class="sku-badge">${product.sku}</span>
        <span class="stock-badge ${stockClass}">${stockText}</span>
        <img src="${product.imagen_url || 'https://picsum.photos/seed/' + product.sku + '/400/300'}" alt="${product.nombre}" loading="lazy">
      </div>
      <div class="product-card-body">
        <span class="product-category-name">${product.categoria_nombre || 'General'}</span>
        <h3 class="product-name" title="${product.nombre}">${product.nombre}</h3>
        <div class="product-attributes-preview">
          ${attributesHtml}
        </div>
        <div class="product-price-row">
          ${priceDiscount ? `
            <span class="price-value text-success">${formatCOP(priceDiscount)}</span>
            <span class="price-original">${formatCOP(priceBase)}</span>
          ` : `
            <span class="price-value">${formatCOP(priceBase)}</span>
          `}
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="btn btn-outline" style="flex:1;" onclick="app.viewProductDetail(${product.id})">
            <i class="fa-solid fa-circle-info"></i> Detalles
          </button>
          <button class="btn btn-primary" style="flex:1.2;" ${isOutOfStock ? 'disabled' : ''} onclick="app.addToCart(${product.id}, 1)">
            <i class="fa-solid fa-cart-plus"></i> Comprar
          </button>
        </div>
      </div>
    </div>
  `;
}

// 4. Cart Table Row Renderer
function createCartRowHtml(item) {
  const price = item.precio_descuento ? parseFloat(item.precio_descuento) : parseFloat(item.precio_base);
  const subtotal = price * item.cantidad;

  return `
    <tr data-product-id="${item.producto_id}">
      <td>
        <div class="cart-prod-item">
          <img src="${item.imagen_url || 'https://picsum.photos/seed/' + item.sku + '/100/100'}" class="cart-prod-img" alt="${item.nombre}">
          <div class="cart-prod-meta">
            <span class="cart-prod-title">${item.nombre}</span>
            <span class="cart-prod-sku">${item.sku}</span>
          </div>
        </div>
      </td>
      <td>${formatCOP(price)} COP</td>
      <td>
        <div class="qty-spinner">
          <button class="qty-btn" onclick="app.changeCartQty(${item.producto_id}, -1)"><i class="fa-solid fa-minus"></i></button>
          <input type="text" readonly class="qty-val" value="${item.cantidad}">
          <button class="qty-btn" onclick="app.changeCartQty(${item.producto_id}, 1)"><i class="fa-solid fa-plus"></i></button>
        </div>
      </td>
      <td class="font-weight-bold" style="font-family: var(--font-display);">${formatCOP(subtotal)} COP</td>
      <td>
        <button class="btn-icon text-danger" onclick="app.removeCartItem(${item.producto_id})" title="Eliminar ítem">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `;
}

// 5. Order Accordion Card Renderer
function createOrderCardHtml(order) {
  const dateStr = new Date(order.creado_en).toLocaleString('es-CO');
  
  // Items HTML
  const itemsHtml = order.items.map(item => `
    <div class="order-item-row">
      <div>
        <span class="order-item-title">${item.nombre}</span>
        <span class="order-item-qty">x${item.cantidad}</span>
      </div>
      <span class="font-weight-bold">${formatCOP(item.precio_unitario * item.cantidad)} COP</span>
    </div>
  `).join('');

  // Status Class selector
  let statusClass = `status-${order.estado}`;

  return `
    <div class="order-accordion-item" id="order-card-${order.id}">
      <div class="order-accordion-header" onclick="app.toggleOrderAccordion(${order.id})">
        <div class="order-meta-info">
          <span class="order-meta-id">Pedido #${order.id}</span>
          <span class="order-meta-date"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <span class="order-meta-total">${formatCOP(order.total)} COP</span>
          <span class="order-status-badge ${statusClass}">${order.estado}</span>
          <i class="fa-solid fa-chevron-down chevron-icon"></i>
        </div>
      </div>
      <div class="order-accordion-body">
        <h4 class="mb-4" style="font-family: var(--font-display); font-weight: 600;"><i class="fa-solid fa-list-ul"></i> Artículos Comprados</h4>
        <div class="order-items-list">
          ${itemsHtml}
        </div>
        
        <hr class="card-divider">
        
        <h4 class="mb-4" style="font-family: var(--font-display); font-weight: 600;"><i class="fa-solid fa-receipt"></i> Comprobante de Transacción</h4>
        <div class="order-payment-box">
          <div>
            <p class="text-muted">Método de Pago:</p>
            <p><strong>${order.pago.metodo ? order.pago.metodo.toUpperCase() : 'N/A'}</strong></p>
          </div>
          <div>
            <p class="text-muted">Referencia de Pago:</p>
            <p class="text-success" style="font-family: monospace;">${order.pago.referencia || 'N/A'}</p>
          </div>
          <div>
            <p class="text-muted">Dirección de Entrega:</p>
            <p>${order.direccion_entrega ? `${order.direccion_entrega.direccion}, ${order.direccion_entrega.ciudad}` : 'N/A'}</p>
          </div>
          <div>
            <p class="text-muted">Estado del Pago:</p>
            <p><span class="text-success"><i class="fa-solid fa-circle-check"></i> ${order.pago.estado || 'Aprobado'}</span></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 6. SQL Latency Telemetry Dashboard updating
function updateQueryMonitorUI(loggedQueries = [], lastOperation = '') {
  const avgBadge = document.getElementById('monitor-avg-badge');
  const queryCount = document.getElementById('monitor-query-count');
  const lastOpEl = document.getElementById('monitor-last-op');
  const listContainer = document.getElementById('monitor-queries-list-container');
  const chartContainer = document.getElementById('monitor-latency-chart');

  if (!avgBadge || !queryCount || !lastOpEl || !listContainer || !chartContainer) return;

  // 1. Update basic counts and stats
  const history = window.queryHistory;
  queryCount.innerText = history.length;
  
  if (lastOperation) {
    lastOpEl.innerText = lastOperation;
  }

  if (history.length > 0) {
    const sum = history.reduce((acc, q) => acc + q.durationMs, 0);
    const avg = (sum / history.length).toFixed(1);
    avgBadge.innerText = `${avg}ms`;
    
    // Color code average badge
    avgBadge.className = 'avg-latency-badge';
    if (avg > 200) avgBadge.classList.add('text-danger');
    else if (avg > 50) avgBadge.classList.add('text-warning');
    else avgBadge.classList.add('text-success');
  } else {
    avgBadge.innerText = '0.0ms';
  }

  // 2. Render chart bar elements
  const maxBars = 25;
  const recentQueries = history.slice(-maxBars);
  const maxVal = Math.max(...recentQueries.map(q => q.durationMs), 15); // min scale 15ms

  chartContainer.innerHTML = '';
  recentQueries.forEach(q => {
    const bar = document.createElement('div');
    const heightPercent = Math.min((q.durationMs / maxVal) * 100, 100);
    bar.className = 'chart-bar';
    bar.style.height = `${heightPercent}%`;
    bar.setAttribute('data-time', q.durationMs);

    if (q.durationMs > 200) bar.classList.add('slow');
    else if (q.durationMs > 50) bar.classList.add('moderate');
    else bar.classList.add('fast');

    chartContainer.appendChild(bar);
  });

  // 3. Render Query List history log
  listContainer.innerHTML = '';
  // Show list in reverse chronological order
  [...history].reverse().forEach(q => {
    const item = document.createElement('div');
    item.className = 'query-log-item';
    
    let colorClass = 'text-success';
    if (q.durationMs > 200) colorClass = 'text-danger';
    else if (q.durationMs > 50) colorClass = 'text-warning';

    const timestamp = q.timestamp.toLocaleTimeString('es-CO');

    item.innerHTML = `
      <div class="query-log-header">
        <span class="query-log-op"><i class="fa-solid fa-database"></i> ${q.operation}</span>
        <span class="query-log-time ${colorClass}">${q.durationMs}ms</span>
      </div>
      <div class="query-log-sql">${q.sql}</div>
      <div style="font-size:0.65rem; color:var(--text-muted); text-align:right; margin-top:2px;">
        <i class="fa-regular fa-clock"></i> ${timestamp}
      </div>
    `;
    listContainer.appendChild(item);
  });
}

// Hook up monitor to window logging pipeline
window.onQueryLogged = (logged, op) => {
  updateQueryMonitorUI(logged, op);
};

// Export tools
window.ui = {
  formatCOP,
  showToast,
  getTimingStripHtml,
  createProductCardHtml,
  createCartRowHtml,
  createOrderCardHtml,
  updateQueryMonitorUI
};
