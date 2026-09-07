const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');

// Allowed categories for validation
const ALLOWED_CATEGORIES = [
  'Fruits & Vegetables',
  'Dairy & Eggs',
  'Beverages',
  'Snacks & Sweets',
  'Grains & Pulses',
  'Spices & Condiments',
  'Personal Care',
  'Bakery',
  'Frozen Foods',
  'Household',
];

const ALLOWED_UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'dozen', 'box'];

// @desc    Get all inventory (products with stock)
// @route   GET /api/inventory
// @access  Private (all authenticated roles)
const getInventory = asyncHandler(async (req, res) => {
  const { branch, category, status, search } = req.query;

  // Filter ALWAYS scoped to authenticated user's store (from verified token — never from client)
  const filter = { store: req.storeId };

  if (branch) filter.branch = branch;

  // Validate category against allowed values to prevent injection
  if (category) {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      res.status(400);
      throw new Error('Invalid category value');
    }
    filter.category = category;
  }

  if (search) {
    // search is sanitized by express-mongo-sanitize; regex is safe
    filter.name = { $regex: search.substring(0, 100), $options: 'i' };
  }

  let products = await Product.find(filter).sort({ name: 1 });

  // Apply virtual-based status filter after fetching
  const ALLOWED_STATUSES = ['all', 'ok', 'low', 'critical', 'out'];
  if (status && status !== 'all') {
    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400);
      throw new Error('Invalid status filter');
    }
    products = products.filter(p => p.stockStatus === status);
  }

  // Inventory KPIs
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const criticalCount = products.filter(p => p.stockStatus === 'critical').length;
  const lowCount = products.filter(p => p.stockStatus === 'low').length;
  const outCount = products.filter(p => p.stockStatus === 'out').length;

  res.json({
    success: true,
    count: products.length,
    kpis: {
      totalSkus: products.length,
      criticalStock: criticalCount,
      lowStock: lowCount,
      outOfStock: outCount,
      inventoryValue: totalValue,
    },
    data: products,
  });
});

// @desc    Get low/critical stock alerts
// @route   GET /api/inventory/alerts
// @access  Private
const getStockAlerts = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  // Always scope to authenticated store
  const filter = { store: req.storeId };
  if (branch) filter.branch = branch;

  const products = await Product.find(filter);
  const alerts = products.filter(p => ['critical', 'low', 'out'].includes(p.stockStatus));

  res.json({ success: true, count: alerts.length, data: alerts });
});

// @desc    Update stock level and product details
// @route   PUT /api/inventory/:id
// @access  Private (admin, manager, staff, store_owner)
const updateInventory = asyncHandler(async (req, res) => {
  // IDOR prevention: findOne with BOTH _id AND store — cross-store access returns 404
  // req.resource is pre-verified by storeAccess middleware if used on route
  const product = req.resource || await Product.findOne({ _id: req.params.id, store: req.storeId });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // EXPLICIT WHITELIST — only permitted fields can be updated
  // Prevented fields: store, branch, sku, _id, createdAt, updatedAt
  const allowed = ['stock', 'price', 'costPrice', 'reorderLevel', 'name', 'category', 'supplier', 'expiryDate', 'unit', 'imageUrl'];
  const updates = {};
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400);
    throw new Error('No valid fields provided for update');
  }

  // Validate specific fields if present
  if (updates.stock !== undefined && (typeof updates.stock !== 'number' || updates.stock < 0)) {
    res.status(400);
    throw new Error('Stock must be a non-negative number');
  }
  if (updates.price !== undefined && (typeof updates.price !== 'number' || updates.price < 0)) {
    res.status(400);
    throw new Error('Price must be a non-negative number');
  }
  if (updates.costPrice !== undefined && (typeof updates.costPrice !== 'number' || updates.costPrice < 0)) {
    res.status(400);
    throw new Error('Cost price must be a non-negative number');
  }
  if (updates.category !== undefined && !ALLOWED_CATEGORIES.includes(updates.category)) {
    res.status(400);
    throw new Error('Invalid category value');
  }
  if (updates.unit !== undefined && !ALLOWED_UNITS.includes(updates.unit)) {
    res.status(400);
    throw new Error('Invalid unit value');
  }

  // Apply whitelisted updates
  Object.assign(product, updates);
  const updated = await product.save();

  // Emit socket event if stock is low
  if (req.io && updated.stockStatus !== 'ok') {
    req.io.emit('stock_alert', { product: updated.name, stock: updated.stock, status: updated.stockStatus });
  }

  res.json({ success: true, data: updated });
});

// @desc    Add new product
// @route   POST /api/inventory
// @access  Private (admin, manager, staff, store_owner)
const addProduct = asyncHandler(async (req, res) => {
  // EXPLICIT WHITELIST — prevent mass assignment; store is always set from token
  const {
    name, sku, category, price, costPrice, stock, unit,
    reorderLevel, supplier, expiryDate, branch, imageUrl
  } = req.body;

  // Required fields validation
  if (!name || !sku || !category || price === undefined || costPrice === undefined) {
    res.status(400);
    throw new Error('Name, SKU, category, price, and costPrice are required');
  }

  if (!ALLOWED_CATEGORIES.includes(category)) {
    res.status(400);
    throw new Error('Invalid category value');
  }

  if (typeof price !== 'number' || price < 0) {
    res.status(400);
    throw new Error('Price must be a non-negative number');
  }

  if (typeof costPrice !== 'number' || costPrice < 0) {
    res.status(400);
    throw new Error('Cost price must be a non-negative number');
  }

  // Build product data explicitly — store always from token, never from body
  const productData = {
    name: String(name).trim(),
    sku: String(sku).trim().toUpperCase(),
    category,
    price,
    costPrice,
    stock: stock !== undefined ? Number(stock) : 0,
    unit: unit && ALLOWED_UNITS.includes(unit) ? unit : 'piece',
    reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 10,
    supplier: supplier ? String(supplier).trim() : '',
    expiryDate: expiryDate || null,
    imageUrl: imageUrl ? String(imageUrl).trim() : '',
    branch: branch ? String(branch).trim() : req.user.branch || 'Main Branch',
    store: req.storeId, // Always from authenticated token — NEVER from req.body
  };

  const product = await Product.create(productData);
  res.status(201).json({ success: true, data: product });
});

// @desc    Delete product
// @route   DELETE /api/inventory/:id
// @access  Private (admin, store_owner)
const deleteProduct = asyncHandler(async (req, res) => {
  // IDOR prevention: findOne with BOTH _id AND store — cross-store access returns 404
  // req.resource is pre-verified by storeAccess middleware if used on route
  const product = req.resource || await Product.findOne({ _id: req.params.id, store: req.storeId });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await product.deleteOne();

  console.info(`[AUDIT] Product deleted | productId: ${req.params.id} | store: ${req.storeId} | by: ${req.user._id}`);

  res.json({ success: true, message: 'Product removed' });
});

module.exports = { getInventory, getStockAlerts, updateInventory, addProduct, deleteProduct };
