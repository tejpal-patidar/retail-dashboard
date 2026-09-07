const asyncHandler = require('express-async-handler');
const Staff = require('../models/Staff');
const User = require('../models/User');

const ALLOWED_SHIFTS = ['Morning', 'Evening', 'Night'];
const ALLOWED_STATUSES = ['active', 'off'];

// Roles that can be created by a given role (role escalation prevention)
const CREATABLE_ROLES = {
  store_owner: ['store_owner', 'admin', 'manager', 'staff'],
  admin: ['manager', 'staff'],
  manager: ['staff'], // managers can ONLY create staff
};

// @desc    Get all staff with performance data
// @route   GET /api/staff
// @access  Private (admin, manager, store_owner)
const getStaff = asyncHandler(async (req, res) => {
  const { branch, status, shift } = req.query;

  // Always scope to authenticated user's store
  const filter = { store: req.storeId };

  if (branch) filter.branch = branch;
  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      res.status(400);
      throw new Error('Invalid status filter');
    }
    filter.status = status;
  }
  if (shift) {
    if (!ALLOWED_SHIFTS.includes(shift)) {
      res.status(400);
      throw new Error('Invalid shift filter');
    }
    filter.shift = shift;
  }

  const staff = await Staff.find(filter)
    .populate('user', 'name email role isActive')
    .sort({ salesTotal: -1 });

  // KPIs — always scoped to store
  const onShift = await Staff.countDocuments({
    store: req.storeId,
    status: 'active',
    ...(branch ? { branch } : {}),
  });
  const allStaff = await Staff.find({ store: req.storeId, ...(branch ? { branch } : {}) }).populate('user', 'name');
  const topSeller = [...allStaff].sort((a, b) => b.salesTotal - a.salesTotal)[0];
  const avgRating =
    allStaff.length > 0
      ? (allStaff.reduce((sum, s) => sum + s.rating, 0) / allStaff.length).toFixed(1)
      : 0;
  const avgTransactions =
    allStaff.length > 0
      ? Math.round(allStaff.reduce((sum, s) => sum + s.transactionCount, 0) / allStaff.length)
      : 0;

  res.json({
    success: true,
    count: staff.length,
    kpis: {
      onShift,
      topSeller: topSeller ? topSeller.user?.name : 'N/A',
      avgRating,
      avgTransactions,
    },
    data: staff,
  });
});

// @desc    Get staff leaderboard (top performers)
// @route   GET /api/staff/leaderboard
// @access  Private (all authenticated — staff can see leaderboard)
const getLeaderboard = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  const rawLimit = parseInt(req.query.limit, 10);
  const limit = !isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 50 ? rawLimit : 10;

  const filter = { store: req.storeId, ...(branch ? { branch } : {}) };

  const staff = await Staff.find(filter)
    .populate('user', 'name email')
    .sort({ salesTotal: -1 })
    .limit(limit);

  res.json({ success: true, data: staff });
});

// @desc    Update staff info
// @route   PUT /api/staff/:id
// @access  Private (admin, manager, store_owner)
const updateStaff = asyncHandler(async (req, res) => {
  // EXPLICIT WHITELIST — prevent mass assignment
  // Forbidden: store, salesTotal, transactionCount, user, _id, branch (privileged)
  const allowed = ['shift', 'status', 'rating', 'branch'];
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

  // Validate values
  if (updates.shift && !ALLOWED_SHIFTS.includes(updates.shift)) {
    res.status(400);
    throw new Error('Invalid shift. Must be Morning, Evening, or Night');
  }
  if (updates.status && !ALLOWED_STATUSES.includes(updates.status)) {
    res.status(400);
    throw new Error('Invalid status. Must be active or off');
  }
  if (updates.rating !== undefined) {
    const rating = parseFloat(updates.rating);
    if (isNaN(rating) || rating < 0 || rating > 5) {
      res.status(400);
      throw new Error('Rating must be between 0 and 5');
    }
    updates.rating = rating;
  }

  // findOneAndUpdate with BOTH _id AND store — prevents IDOR
  const staff = await Staff.findOneAndUpdate(
    { _id: req.params.id, store: req.storeId },
    updates,
    { new: true, runValidators: true }
  ).populate('user', 'name email role');

  if (!staff) {
    res.status(404);
    throw new Error('Staff record not found');
  }

  if (req.io) req.io.emit('staff_update', { staff });
  res.json({ success: true, data: staff });
});

// @desc    Add new staff member (creates User + Staff record)
// @route   POST /api/staff
// @access  Private (admin, manager, store_owner)
const addStaff = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'staff', shift = 'Morning', branch = 'Main Branch' } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  if (typeof name !== 'string' || name.trim().length < 2) {
    res.status(400);
    throw new Error('Name must be at least 2 characters');
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  if (!ALLOWED_SHIFTS.includes(shift)) {
    res.status(400);
    throw new Error('Invalid shift. Must be Morning, Evening, or Night');
  }

  // ROLE ESCALATION PREVENTION
  // A manager can only create 'staff' users, not other managers or owners
  // A store_owner/admin can create managers and staff
  const callerRole = req.user.role;
  const allowedRoles = CREATABLE_ROLES[callerRole] || [];

  if (!allowedRoles.includes(role)) {
    console.warn(
      `[AUTHZ] Role escalation attempt | caller: ${req.user._id} (${callerRole}) tried to create role: '${role}' | IP: ${req.ip}`
    );
    res.status(403);
    throw new Error(`Your role (${callerRole}) is not permitted to create users with role '${role}'`);
  }

  // Only allow valid roles
  const VALID_ROLES = ['store_owner', 'admin', 'manager', 'staff'];
  if (!VALID_ROLES.includes(role)) {
    res.status(400);
    throw new Error('Invalid role');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  // Create user account — store is always from authenticated token, never from body
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
    branch: branch.trim(),
    store: req.storeId, // Always from verified token
    isActive: true,
  });

  // Create staff performance record
  const staffRecord = await Staff.create({
    user: user._id,
    store: req.storeId, // Always from verified token
    shift,
    branch: branch.trim(),
    salesTotal: 0,
    transactionCount: 0,
    rating: 4.0,
    status: 'active',
  });

  const populated = await Staff.findById(staffRecord._id).populate('user', 'name email role');

  console.info(
    `[AUDIT] Staff added | newUserId: ${user._id} | role: ${role} | store: ${req.storeId} | by: ${req.user._id}`
  );

  if (req.io) req.io.emit('staff_added', { staff: populated });

  res.status(201).json({ success: true, data: populated });
});

// @desc    Remove staff member (deactivate user + delete staff record)
// @route   DELETE /api/staff/:id
// @access  Private (admin, manager, store_owner)
const removeStaff = asyncHandler(async (req, res) => {
  // IDOR prevention: findOne with BOTH _id AND store
  const staffRecord = await Staff.findOne({ _id: req.params.id, store: req.storeId }).populate('user');

  if (!staffRecord) {
    res.status(404);
    throw new Error('Staff record not found');
  }

  // Prevent removing yourself
  if (staffRecord.user && staffRecord.user._id.toString() === req.user._id.toString()) {
    res.status(403);
    throw new Error('You cannot remove your own staff record');
  }

  // Deactivate the user account (soft delete — preserve historical data)
  if (staffRecord.user) {
    await User.findByIdAndUpdate(staffRecord.user._id, { isActive: false });
  }

  await staffRecord.deleteOne();

  console.info(
    `[AUDIT] Staff removed | staffId: ${req.params.id} | store: ${req.storeId} | by: ${req.user._id}`
  );

  if (req.io) req.io.emit('staff_removed', { staffId: req.params.id });

  res.json({ success: true, message: 'Staff member removed successfully' });
});

module.exports = { getStaff, getLeaderboard, updateStaff, addStaff, removeStaff };
