const asyncHandler = require('express-async-handler');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');

const ALLOWED_SEGMENTS = ['VIP', 'Regular', 'New'];

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = asyncHandler(async (req, res) => {
  const { branch, segment, search } = req.query;

  // Always scope to authenticated user's store — NEVER trust storeId from client
  const filter = { store: req.storeId };

  if (branch) filter.branch = branch;

  if (segment) {
    if (!ALLOWED_SEGMENTS.includes(segment)) {
      res.status(400);
      throw new Error('Invalid segment value');
    }
    filter.segment = segment;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search.substring(0, 100), $options: 'i' } },
      { email: { $regex: search.substring(0, 100), $options: 'i' } },
    ];
  }

  const customers = await Customer.find(filter).sort({ totalSpent: -1 });

  // KPIs
  const totalCustomers = await Customer.countDocuments({
    store: req.storeId,
    ...(branch ? { branch } : {}),
  });
  const repeatCount = await Customer.countDocuments({
    store: req.storeId,
    visits: { $gt: 1 },
    ...(branch ? { branch } : {}),
  });
  const avgLTV =
    customers.length > 0
      ? customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length
      : 0;

  res.json({
    success: true,
    count: customers.length,
    kpis: {
      totalCustomers,
      repeatRate: totalCustomers > 0 ? ((repeatCount / totalCustomers) * 100).toFixed(1) : 0,
      avgLTV: avgLTV.toFixed(2),
      churnRate: '12.4', // Simulated
    },
    data: customers,
  });
});

// @desc    Get customer segments breakdown
// @route   GET /api/customers/segments
// @access  Private (admin, manager, store_owner)
const getSegments = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const filter = { store: req.storeId, ...(branch ? { branch } : {}) };

  const data = await Customer.aggregate([
    { $match: filter },
    { $group: { _id: '$segment', count: { $sum: 1 }, totalSpent: { $sum: '$totalSpent' } } },
    { $sort: { count: -1 } },
  ]);

  res.json({ success: true, data });
});

// @desc    Get hourly foot traffic
// @route   GET /api/customers/traffic
// @access  Private (admin, manager, store_owner)
const getFootTraffic = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const filter = { createdAt: { $gte: since }, store: req.storeId };
  if (branch) filter.branch = branch;

  const data = await Sale.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { $hour: '$createdAt' },
        visits: { $sum: 1 },
        revenue: { $sum: '$total' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        hour: '$_id',
        label: { $concat: [{ $toString: '$_id' }, ':00'] },
        visits: 1,
        revenue: 1,
        _id: 0,
      },
    },
  ]);

  res.json({ success: true, data });
});

// @desc    Add new customer
// @route   POST /api/customers
// @access  Private (admin, manager, store_owner, staff)
const addCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, segment } = req.body;

  // Required field validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400);
    throw new Error('Customer name is required');
  }

  // Validate segment if provided
  if (segment && !ALLOWED_SEGMENTS.includes(segment)) {
    res.status(400);
    throw new Error('Invalid segment. Must be VIP, Regular, or New');
  }

  // EXPLICIT WHITELIST — prevent mass assignment
  // totalSpent, visits, lastVisit, store, branch must NOT come from client
  const customerData = {
    name: name.trim(),
    email: email ? String(email).toLowerCase().trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
    segment: segment || 'New',
    store: req.storeId, // Always from verified token
    branch: req.user.branch || 'Main Branch',
    // totalSpent, visits, lastVisit are intentionally excluded — server-managed fields
  };

  const customer = await Customer.create(customerData);
  res.status(201).json({ success: true, data: customer });
});

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private (admin, manager, store_owner)
const updateCustomer = asyncHandler(async (req, res) => {
  // EXPLICIT WHITELIST — prevent mass assignment
  // Forbidden: store, totalSpent, visits, lastVisit, branch, _id
  const allowed = ['name', 'email', 'phone', 'segment'];
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

  if (updates.segment && !ALLOWED_SEGMENTS.includes(updates.segment)) {
    res.status(400);
    throw new Error('Invalid segment. Must be VIP, Regular, or New');
  }

  if (updates.name) updates.name = String(updates.name).trim();
  if (updates.email) updates.email = String(updates.email).toLowerCase().trim();
  if (updates.phone) updates.phone = String(updates.phone).trim();

  // findOneAndUpdate with BOTH _id AND store — prevents IDOR
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, store: req.storeId },
    updates,
    { new: true, runValidators: true }
  );

  if (!customer) {
    res.status(404);
    throw new Error('Customer not found');
  }

  res.json({ success: true, data: customer });
});

module.exports = { getCustomers, getSegments, getFootTraffic, addCustomer, updateCustomer };
