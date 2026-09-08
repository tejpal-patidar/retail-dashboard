const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 },
}, { _id: false });

const saleSchema = new mongoose.Schema({
  products: { type: [saleItemSchema], required: true },
  total: { type: Number, required: true, min: 0 },
  profit: { type: Number, default: 0 },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, trim: true },
  customerEmail: { type: String, trim: true },
  customerPhone: { type: String, trim: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  branch: { type: String, default: 'Main Branch' },
  paymentMethod: { type: String, enum: ['cash', 'card', 'upi'], default: 'cash' },
  returnFlag: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Sale', saleSchema);
