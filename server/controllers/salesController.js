const asyncHandler = require('express-async-handler');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Store = require('../models/Store');
const User = require('../models/User');
const Staff = require('../models/Staff');
const { sendBillEmail } = require('../utils/emailService');

const ALLOWED_PAYMENT_METHODS = ['cash', 'card', 'upi'];

// @desc    Get all sales with optional filters
// @route   GET /api/sales
// @access  Private (admin, manager, store_owner)
const getSales = asyncHandler(async (req, res) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = !isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 500 ? rawLimit : 50;

  const { branch, startDate, endDate } = req.query;

  // Always scope to authenticated user's store
  const filter = { store: req.storeId };

  if (branch) filter.branch = branch;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const sales = await Sale.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('customer', 'name email')
    .populate('staff', 'name email')
    .populate('products.product', 'name sku category');

  res.json({ success: true, count: sales.length, data: sales });
});

// @desc    Get sales KPI summary
// @route   GET /api/sales/summary
// @access  Private (admin, manager, store_owner)
const getSalesSummary = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const rawDays = parseInt(req.query.period, 10);
  const daysBack = !isNaN(rawDays) && rawDays > 0 && rawDays <= 365 ? rawDays : 30;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const filter = { createdAt: { $gte: since }, store: req.storeId };
  if (branch) filter.branch = branch;

  const [result] = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$profit' },
        transactionCount: { $sum: 1 },
        returns: { $sum: { $cond: ['$returnFlag', 1, 0] } },
      },
    },
  ]);

  const summary = result || { totalRevenue: 0, totalProfit: 0, transactionCount: 0, returns: 0 };
  summary.aov = summary.transactionCount > 0 ? summary.totalRevenue / summary.transactionCount : 0;
  summary.returnRate =
    summary.transactionCount > 0
      ? ((summary.returns / summary.transactionCount) * 100).toFixed(1)
      : 0;

  res.json({ success: true, data: summary });
});

// @desc    Get daily sales breakdown
// @route   GET /api/sales/daily
// @access  Private (admin, manager, store_owner)
const getDailySales = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const rawDays = parseInt(req.query.days, 10);
  const days = !isNaN(rawDays) && rawDays > 0 && rawDays <= 90 ? rawDays : 14;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const filter = { createdAt: { $gte: since }, store: req.storeId };
  if (branch) filter.branch = branch;

  const data = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        profit: { $sum: '$profit' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, data });
});

// @desc    Get monthly sales for bar chart
// @route   GET /api/sales/monthly
// @access  Private (admin, manager, store_owner)
const getMonthlySales = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const filter = { createdAt: { $gte: since }, store: req.storeId };
  if (branch) filter.branch = branch;

  const data = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        profit: { $sum: '$profit' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({ success: true, data });
});

// @desc    Create a new sale
// @route   POST /api/sales
// @access  Private (admin, manager, store_owner, staff)
const createSale = asyncHandler(async (req, res) => {
  // EXPLICIT WHITELIST — do not trust total, profit, store, staff from client
  const {
    products,
    customer,
    customerEmail,
    customerName,
    customerPhone,
    newCustomer,
    paymentMethod,
    branch,
    returnFlag
  } = req.body;

  // Validate products array
  if (!products || !Array.isArray(products) || products.length === 0) {
    res.status(400);
    throw new Error('Products array is required and must not be empty');
  }

  if (products.length > 100) {
    res.status(400);
    throw new Error('Too many products in a single sale');
  }

  // Validate paymentMethod
  if (paymentMethod && !ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    res.status(400);
    throw new Error('Invalid payment method. Must be cash, card, or upi');
  }

  let resolvedCustomerId = customer || null;
  let finalCustomerName = (customerName || '').trim();
  let finalCustomerEmail = (customerEmail || '').trim();
  let finalCustomerPhone = (customerPhone || '').trim();

  // Validate customer belongs to this store (if provided)
  if (resolvedCustomerId) {
    if (!/^[a-fA-F0-9]{24}$/.test(resolvedCustomerId)) {
      res.status(400);
      throw new Error('Invalid customer ID format');
    }
    const customerRecord = await Customer.findOne({ _id: resolvedCustomerId, store: req.storeId });
    if (!customerRecord) {
      res.status(404);
      throw new Error('Customer not found');
    }
    if (!finalCustomerName) finalCustomerName = customerRecord.name || '';
    if (!finalCustomerEmail) finalCustomerEmail = customerRecord.email || '';
    if (!finalCustomerPhone) finalCustomerPhone = customerRecord.phone || '';
  } else if (newCustomer && (newCustomer.name || newCustomer.email || newCustomer.phone)) {
    // If inline newCustomer details provided (e.g. from POS form), auto-save/find customer
    try {
      let existingCust = null;
      if (newCustomer.phone && newCustomer.phone.trim()) {
        existingCust = await Customer.findOne({ phone: newCustomer.phone.trim(), store: req.storeId });
      }
      if (!existingCust && newCustomer.email && newCustomer.email.trim()) {
        existingCust = await Customer.findOne({ email: newCustomer.email.trim(), store: req.storeId });
      }

      if (existingCust) {
        resolvedCustomerId = existingCust._id;
        finalCustomerName = existingCust.name;
        finalCustomerEmail = newCustomer.email?.trim() || existingCust.email;
        finalCustomerPhone = newCustomer.phone?.trim() || existingCust.phone;
      } else if (newCustomer.name && newCustomer.name.trim()) {
        const createdCust = await Customer.create({
          name: newCustomer.name.trim(),
          email: (newCustomer.email || '').trim(),
          phone: (newCustomer.phone || '').trim(),
          store: req.storeId,
          branch: branch ? branch : req.user.branch || 'Main Branch',
          segment: 'Regular',
          visits: 1,
          totalSpent: 0
        });
        resolvedCustomerId = createdCust._id;
        finalCustomerName = createdCust.name;
        finalCustomerEmail = createdCust.email;
        finalCustomerPhone = createdCust.phone;
      }
    } catch (custErr) {
      console.warn('[SALE] Auto-creating customer encountered error:', custErr.message);
      if (!finalCustomerName) finalCustomerName = newCustomer.name || '';
      if (!finalCustomerEmail) finalCustomerEmail = newCustomer.email || '';
      if (!finalCustomerPhone) finalCustomerPhone = newCustomer.phone || '';
    }
  }

  let total = 0;
  let profit = 0;
  const saleProducts = [];

  for (const item of products) {
    if (!item.product || typeof item.qty !== 'number' || item.qty < 1) {
      res.status(400);
      throw new Error('Each product must have a valid product ID and quantity >= 1');
    }

    if (!/^[a-fA-F0-9]{24}$/.test(item.product)) {
      res.status(400);
      throw new Error('Invalid product ID format');
    }

    // CRITICAL: Verify product belongs to the authenticated user's store
    const product = await Product.findOne({ _id: item.product, store: req.storeId });

    if (!product) {
      res.status(404);
      throw new Error(`Product not found in your store`);
    }

    const lineTotal = item.qty * product.price;
    const lineProfit = item.qty * (product.price - product.costPrice);
    total += lineTotal;
    profit += lineProfit;

    saleProducts.push({
      product: product._id,
      qty: item.qty,
      price: product.price,           // Always use server-side price — never trust client
      costPrice: product.costPrice,   // Always use server-side cost — never trust client
    });

    // Deduct stock (prevent negative stock)
    product.stock = Math.max(0, product.stock - item.qty);
    await product.save();
  }

  // Update staff performance stats
  await Staff.findOneAndUpdate(
    { user: req.user._id, store: req.storeId },
    { $inc: { salesTotal: total, transactionCount: 1 } }
  );

  // Update customer totalSpent and visits if customer is registered
  if (resolvedCustomerId) {
    await Customer.findByIdAndUpdate(resolvedCustomerId, {
      $inc: { visits: 1, totalSpent: total },
      $set: { lastVisit: new Date() }
    }).catch(err => console.warn('[SALE] Updating customer stats failed:', err.message));
  }

  const sale = await Sale.create({
    products: saleProducts,
    total,                                         // Computed server-side — never from client
    profit,                                        // Computed server-side — never from client
    customer: resolvedCustomerId,
    customerName: finalCustomerName || undefined,
    customerEmail: finalCustomerEmail || undefined,
    customerPhone: finalCustomerPhone || undefined,
    staff: req.user._id,                           // Always from verified token
    store: req.storeId,                            // Always from verified token
    branch: branch ? branch : req.user.branch,
    paymentMethod: paymentMethod || 'cash',
    returnFlag: returnFlag === true,               // Explicitly cast to boolean
  });

  console.info(
    `[AUDIT] Sale created | saleId: ${sale._id} | total: ${total} | store: ${req.storeId} | by: ${req.user._id}`
  );

  // Emit socket event
  if (req.io) {
    req.io.emit('new_sale', { sale, revenue: total, profit });
    for (const item of saleProducts) {
      const product = await Product.findById(item.product);
      if (product && product.stock <= product.reorderLevel) {
        req.io.emit('stock_alert', { product: product.name, stock: product.stock });
      }
    }
  }

  // Send bill email (non-blocking, errors are caught internally)
  let emailStatus = { sent: false, previewUrl: null, recipient: null, error: null };
  try {
    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'name email phone')
      .populate('staff', 'name email')
      .populate('products.product', 'name');
    const store = await Store.findById(req.storeId);

    const targetRecipient = finalCustomerEmail || populatedSale.customer?.email;
    if (targetRecipient) {
      const result = await sendBillEmail(populatedSale, store, targetRecipient);
      if (result && result.success) {
        emailStatus.sent = true;
        emailStatus.previewUrl = result.previewUrl;
        emailStatus.recipient = targetRecipient;
        emailStatus.isTest = result.isTest;
      } else {
        emailStatus.error = result?.error || 'Email delivery failed';
      }
    } else {
      emailStatus.error = 'No customer email address provided for this sale';
    }
  } catch (err) {
    // Email failure must never abort the sale response
    console.error('[EMAIL] Sale email sending failed:', err.message);
    emailStatus.error = err.message;
  }

  res.status(201).json({ success: true, data: sale, emailStatus });
});

// @desc    Delete a sale (restores stock)
// @route   DELETE /api/sales/:id
// @access  Private (admin, store_owner)
const deleteSale = asyncHandler(async (req, res) => {
  // IDOR prevention: scope to authenticated store
  const sale = await Sale.findOne({ _id: req.params.id, store: req.storeId });

  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }

  // Restore stock for each product — verify product still belongs to store
  for (const item of sale.products) {
    await Product.findOneAndUpdate(
      { _id: item.product, store: req.storeId },
      { $inc: { stock: item.qty } }
    );
  }

  await Sale.deleteOne({ _id: req.params.id });

  console.info(
    `[AUDIT] Sale deleted | saleId: ${req.params.id} | store: ${req.storeId} | by: ${req.user._id}`
  );

  if (req.io) {
    req.io.emit('sale_deleted', { id: req.params.id });
  }

  res.json({ success: true, message: 'Sale deleted and stock restored' });
});

// @desc    Get top-selling products
// @route   GET /api/sales/top-products
// @access  Private (admin, manager, store_owner)
const getTopProducts = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = !isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 10;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const filter = { createdAt: { $gte: since }, store: req.storeId };
  if (branch) filter.branch = branch;

  const data = await Sale.aggregate([
    { $match: filter },
    { $unwind: '$products' },
    {
      $group: {
        _id: '$products.product',
        totalQty: { $sum: '$products.qty' },
        totalRevenue: { $sum: { $multiply: ['$products.qty', '$products.price'] } },
        totalProfit: {
          $sum: {
            $multiply: ['$products.qty', { $subtract: ['$products.price', '$products.costPrice'] }],
          },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: '$productInfo' },
    {
      $project: {
        name: '$productInfo.name',
        sku: '$productInfo.sku',
        category: '$productInfo.category',
        totalQty: 1,
        totalRevenue: 1,
        totalProfit: 1,
      },
    },
  ]);

  res.json({ success: true, data });
});

// @desc    Get current user's sales performance
// @route   GET /api/sales/me
// @access  Private (all authenticated)
const getMySales = asyncHandler(async (req, res) => {
  // This is safe — uses req.user._id and req.storeId from verified token
  const staffRecord = await Staff.findOne({ user: req.user._id, store: req.storeId });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayStats] = await Sale.aggregate([
    { $match: { staff: req.user._id, store: req.storeId, createdAt: { $gte: startOfDay } } },
    { $group: { _id: null, todayTotal: { $sum: '$total' }, todayCount: { $sum: 1 } } },
  ]);

  res.json({
    success: true,
    data: {
      totalSales: staffRecord?.salesTotal || 0,
      totalCount: staffRecord?.transactionCount || 0,
      todayTotal: todayStats?.todayTotal || 0,
      todayCount: todayStats?.todayCount || 0,
    },
  });
});

// @desc    Send / Resend bill email to customer
// @route   POST /api/sales/:id/send-email
// @access  Private (admin, manager, store_owner, staff)
const sendSaleEmail = asyncHandler(async (req, res) => {
  const sale = await Sale.findOne({ _id: req.params.id, store: req.storeId })
    .populate('customer', 'name email phone')
    .populate('staff', 'name email')
    .populate('products.product', 'name');

  if (!sale) {
    res.status(404);
    throw new Error('Sale not found');
  }

  const targetEmail = (req.body.email || sale.customerEmail || sale.customer?.email)?.trim();
  if (!targetEmail) {
    res.status(400);
    throw new Error('Please provide an email address to send the bill to');
  }

  const store = await Store.findById(req.storeId);
  const result = await sendBillEmail(sale, store, targetEmail);

  if (!result || !result.success) {
    res.status(500);
    throw new Error(result?.error || 'Failed to send bill email');
  }

  // Update customerEmail on sale if it wasn't recorded
  if (!sale.customerEmail) {
    sale.customerEmail = targetEmail;
    await sale.save();
  }

  res.json({
    success: true,
    message: `Bill invoice successfully sent to ${targetEmail}`,
    emailStatus: {
      sent: true,
      previewUrl: result.previewUrl,
      recipient: targetEmail,
      isTest: result.isTest
    }
  });
});

module.exports = {
  getSales,
  getSalesSummary,
  getDailySales,
  getMonthlySales,
  createSale,
  sendSaleEmail,
  getTopProducts,
  deleteSale,
  getMySales,
};
