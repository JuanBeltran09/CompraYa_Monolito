require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Controllers
const authController = require('./controllers/authController');
const catalogController = require('./controllers/catalogController');
const cartController = require('./controllers/cartController');
const orderController = require('./controllers/orderController');

// Middlewares
const { loadSession, requireAuth } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Global Middleware to load DB-backed session (if available) on all API requests
app.use('/api', loadSession);

// API Endpoints: Authentication
app.post('/api/auth/register', (req, res) => authController.register(req, res));
app.post('/api/auth/login', (req, res) => authController.login(req, res));
app.post('/api/auth/logout', (req, res) => authController.logout(req, res));
app.get('/api/auth/session', (req, res) => authController.checkSession(req, res));

// API Endpoints: Catalog
app.get('/api/catalog/categories', (req, res) => catalogController.getCategories(req, res));
app.get('/api/catalog/products', (req, res) => catalogController.getProducts(req, res));
app.get('/api/catalog/products/:id', (req, res) => catalogController.getProductById(req, res));

// API Endpoints: Shopping Cart (Require authentication)
app.get('/api/cart', requireAuth, (req, res) => cartController.getCart(req, res));
app.post('/api/cart/add', requireAuth, (req, res) => cartController.addItem(req, res));
app.post('/api/cart/update', requireAuth, (req, res) => cartController.updateQuantity(req, res));
app.delete('/api/cart/remove/:productId', requireAuth, (req, res) => cartController.removeItem(req, res));
app.post('/api/cart/sync', requireAuth, (req, res) => cartController.syncCart(req, res));

// API Endpoints: Checkout & Order History (Require authentication)
app.get('/api/orders', requireAuth, (req, res) => orderController.getOrders(req, res));
app.post('/api/orders/checkout', requireAuth, (req, res) => orderController.checkout(req, res));

// SPA Fallback: serve index.html for any unmatched client-side routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
// Start listening only in local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 CompraYa Monolith Server is running on port ${PORT}`);
    console.log(`🔗 Local Address: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;