const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Store = require('../models/Store');
const generateToken = require('../utils/generateToken');

// @desc    Register a new Store and its Owner (SaaS Onboarding)
// @route   POST /api/auth/register-store
// @access  Public
const registerStore = asyncHandler(async (req, res) => {
  // Only allow specific fields — prevent mass assignment
  const { storeName, name, email, password, phone } = req.body;

  // Server-side validation
  if (!storeName || !name || !email || !password) {
    res.status(400);
    throw new Error('Please provide storeName, name, email, and password');
  }

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    res.status(400);
    throw new Error('Name must be between 2 and 100 characters');
  }

  if (typeof storeName !== 'string' || storeName.trim().length < 2 || storeName.trim().length > 100) {
    res.status(400);
    throw new Error('Store name must be between 2 and 100 characters');
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400);
    throw new Error('Invalid email format');
  }

  const userExists = await User.findOne({ email: email.toLowerCase().trim() });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists with this email');
  }

  // Pre-generate IDs so owner and store can reference each other
  const ownerId = new mongoose.Types.ObjectId();
  const storeId = new mongoose.Types.ObjectId();

  // Create the Store — owner is the pre-generated ownerId
  const store = await Store.create({
    _id: storeId,
    name: storeName.trim(),
    phone: phone ? String(phone).trim() : '',
    owner: ownerId,
    subscriptionStatus: 'trial',
  });

  // Create the Store Owner User — role is always 'store_owner', never from client
  const user = await User.create({
    _id: ownerId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    role: 'store_owner', // NEVER trust role from client
    store: store._id,
    isActive: true,
  });

  console.info(`[AUTH] New store registered | storeId: ${store._id} | ownerId: ${user._id} | IP: ${req.ip}`);

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      store: store._id,
    },
    store: {
      _id: store._id,
      name: store.name,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Please provide email and password');
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400);
    throw new Error('Invalid request data');
  }

  // Always include +password since it has select: false in schema
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    // Security log: failed login — log email hash/IP but NEVER the password
    console.warn(`[AUTH] Failed login attempt | email: ${email.toLowerCase().trim()} | IP: ${req.ip}`);
    res.status(401);
    // Use a generic message — do not reveal whether email or password was wrong
    throw new Error('Invalid email or password');
  }

  // Check if account is active BEFORE issuing token
  if (!user.isActive) {
    console.warn(`[AUTH] Deactivated user login attempt | userId: ${user._id} | IP: ${req.ip}`);
    res.status(401);
    throw new Error('Account has been deactivated. Contact your administrator.');
  }

  console.info(`[AUTH] Successful login | userId: ${user._id} | IP: ${req.ip}`);

  const token = generateToken(user._id);

  // Set httpOnly, Secure cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      store: user.store,
    },
  });
});

// @desc    Get current authenticated user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  // req.user is already populated by the protect middleware from the verified JWT
  // We re-fetch to get the latest data (e.g., if isActive changed)
  const user = await User.findById(req.user._id).select('-password');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      store: user.store,
      avatar: user.avatar,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // Clear the auth cookie
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  });

  console.info(`[AUTH] Logout | userId: ${req.user._id} | IP: ${req.ip}`);

  res.json({ success: true, message: 'Logged out successfully' });
});

// NOTE: The public POST /api/auth/register endpoint has been REMOVED.
// It allowed unauthenticated clients to create users with any role (store_owner, admin, etc.)
// and any store assignment — a critical privilege escalation vulnerability.
// Staff creation must go through POST /api/staff (requires authentication + role check).

module.exports = { registerStore, login, getMe, logout };
