import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Search, ShoppingCart, Package, Plus, Minus, Trash2, Mail, CheckCircle2, AlertCircle, Send, User, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useInventory } from '../hooks/useInventory';
import api from '../services/api';
import toast from 'react-hot-toast';

const POS = () => {
  const { inventory, loading: invLoading, refetch: refetchInv } = useInventory();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');

  // Barcode Scanner Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let timeoutId = null;

    const handleKeyDown = (e) => {
      // Ignore if user is manually typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter' && barcodeBuffer.length > 2) {
        // Find product by SKU
        const product = inventory.find(p => p.sku.toLowerCase() === barcodeBuffer.toLowerCase());
        if (product) {
          addToCart(product);
          toast.success(`Scanned: ${product.name}`);
        } else {
          toast.error(`Unknown Barcode: ${barcodeBuffer}`);
        }
        barcodeBuffer = '';
      } else {
        if (e.key.length === 1) {
          barcodeBuffer += e.key;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => { barcodeBuffer = ''; }, 100); // Scanners type very fast
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inventory]);

  
  // Cart state
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successBill, setSuccessBill] = useState(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showManualEmail, setShowManualEmail] = useState(false);

  // New Customer State
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [customerLoading, setCustomerLoading] = useState(false);
  
  const [mySales, setMySales] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);

  useEffect(() => {
    // Fetch customers for the dropdown
    api.get('/customers').then(res => setCustomers(res.data.data)).catch(console.error);
    api.get('/store/info').then(res => setStoreInfo(res.data.data)).catch(console.error);
    fetchMySales();
  }, []);

  const fetchMySales = () => {
    api.get('/sales/me').then(res => setMySales(res.data.data)).catch(console.error);
  };

  const filteredProducts = useMemo(() => {
    if (!search) return inventory;
    const l = search.toLowerCase();
    return inventory.filter(p => p.name.toLowerCase().includes(l) || p.sku.toLowerCase().includes(l));
  }, [inventory, search]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      toast.error('Out of stock!');
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error(`Only ${product.stock} available`);
          return prev;
        }
        return prev.map(item => item.product._id === product._id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product._id === id) {
          const newQty = item.qty + delta;
          if (newQty > item.product.stock) {
            toast.error(`Only ${item.product.stock} available`);
            return item;
          }
          if (newQty <= 0) return null; // remove
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.product._id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setCheckoutLoading(true);

    try {
      let customerPayload = selectedCustomer || undefined;
      let newCustomerPayload = undefined;
      let customerEmail = walkInEmail ? walkInEmail.trim() : undefined;

      // If user typed into new customer form, pass it so backend can auto-save/link
      if (showNewCustomerForm && (newCustomer.name || newCustomer.email || newCustomer.phone)) {
        if (!newCustomer.name || !newCustomer.name.trim()) {
          toast.error('Customer name is required');
          setCheckoutLoading(false);
          return;
        }
        newCustomerPayload = {
          name: newCustomer.name.trim(),
          email: (newCustomer.email || '').trim(),
          phone: (newCustomer.phone || '').trim()
        };
        customerEmail = newCustomerPayload.email || undefined;
      }

      const payload = {
        products: cart.map(item => ({ product: item.product._id, qty: item.qty })),
        paymentMethod,
        customer: customerPayload,
        newCustomer: newCustomerPayload,
        customerEmail
      };

      const { data } = await api.post('/sales', payload);
      toast.success('Bill Generated Successfully!');
      
      const selectedCustomerObj = customers.find(c => c._id === (data.data.customer || selectedCustomer));
      const customerName = selectedCustomerObj?.name || newCustomerPayload?.name || (walkInEmail ? 'Customer' : '');
      const customerPhone = selectedCustomerObj?.phone || newCustomerPayload?.phone || '';
      const finalEmail = data.emailStatus?.recipient || customerEmail || selectedCustomerObj?.email || '';

      setSuccessBill({
        id: data.data._id,
        emailStatus: data.emailStatus,
        total: cartTotal,
        phone: customerPhone,
        name: customerName,
        email: finalEmail,
        paymentMethod
      });
      setResendEmail(finalEmail || '');
      setShowManualEmail(false);
      setCart([]);
      setSelectedCustomer('');
      setWalkInEmail('');
      setShowNewCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '' });

      // Refresh customers list if a new customer was registered
      if (newCustomerPayload) {
        api.get('/customers').then(res => setCustomers(res.data.data)).catch(() => {});
      }

      refetchInv(); // refresh stock
      fetchMySales(); // refresh my performance
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSendBillEmail = async (billId, targetEmail) => {
    if (!targetEmail || !targetEmail.trim()) {
      return toast.error('Please enter a valid email address');
    }
    setResendingEmail(true);
    try {
      const { data } = await api.post(`/sales/${billId}/send-email`, { email: targetEmail.trim() });
      toast.success(data.message || 'Bill sent to customer successfully!');
      setSuccessBill(prev => prev ? {
        ...prev,
        email: targetEmail.trim(),
        emailStatus: data.emailStatus
      } : null);
      setShowManualEmail(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send bill email');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name) return toast.error('Customer name is required');
    if (!newCustomer.phone) return toast.error('Customer phone is required for billing');
    
    setCustomerLoading(true);
    try {
      const { data } = await api.post('/customers', { ...newCustomer, branch: 'Main Branch', segment: 'Regular', visits: 0, totalSpent: 0 });
      setCustomers(prev => [...prev, data.data]);
      setSelectedCustomer(data.data._id);
      setShowNewCustomerForm(false);
      setNewCustomer({ name: '', email: '', phone: '' });
      toast.success('Customer added successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add customer');
    } finally {
      setCustomerLoading(false);
    }
  };

  // Mobile tab state: 'products' | 'cart'
  const [mobileTab, setMobileTab] = useState('products');

  return (
    <Layout title="Point of Sale" subtitle="Record sales and generate bills" loading={invLoading}>
      {/* My Performance Bar */}
      {mySales && (
        <div style={{ display: 'flex', gap: 15, marginBottom: 20, padding: 15, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Today's Sales</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>₹{(mySales.todayTotal || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--muted2)' }}>({mySales.todayCount || 0} bills)</span></div>
          </div>
          <div style={{ width: 1, background: 'var(--border)' }}></div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Total Sales (All Time)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--green)' }}>₹{(mySales.totalSales || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--muted2)' }}>({mySales.totalCount || 0} bills)</span></div>
          </div>
        </div>
      )}

      {successBill && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--green)', background: 'rgba(52, 217, 158, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--green)' }}>
            <CheckCircle2 size={24} />
            <h3 style={{ margin: 0 }}>Bill Generated!</h3>
          </div>
          <p style={{ marginTop: 10, color: 'var(--muted)' }}>
            Bill ID: <strong style={{ color: 'var(--text)' }}>{successBill.id}</strong> | Amount: <strong style={{ color: 'var(--accent)' }}>₹{successBill.total}</strong>
            {successBill.name ? ` | Customer: ${successBill.name}` : ''}
          </p>

          <div style={{ marginTop: 15, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            {successBill.emailStatus?.sent ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--green)', fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <CheckCircle2 size={18} /> Bill emailed successfully to {successBill.emailStatus.recipient || successBill.email}!
                  </span>
                  {successBill.emailStatus.previewUrl && (
                    <a href={successBill.emailStatus.previewUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '4px 10px', fontSize: '0.8rem' }}>
                      <Mail size={14} /> View Sent Email (Test)
                    </a>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', padding: '2px 8px', height: 'auto', textDecoration: 'underline' }}
                    onClick={() => setShowManualEmail(!showManualEmail)}
                  >
                    {showManualEmail ? 'Close' : 'Send to another email'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: successBill.emailStatus?.error && !successBill.emailStatus.error.includes('No customer email') ? 'var(--orange, #f59e0b)' : 'var(--muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={16} />
                  <span>
                    {successBill.emailStatus?.error && !successBill.emailStatus.error.includes('No customer email')
                      ? `Email delivery note: ${successBill.emailStatus.error}`
                      : 'Bill saved. No customer email was specified during checkout.'}
                  </span>
                </div>
              </div>
            )}

            {/* Instant Email Sender Form */}
            {(!successBill.emailStatus?.sent || showManualEmail) && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="email"
                  className="form-input"
                  style={{ flex: 1, minWidth: 220, fontSize: '0.85rem', padding: '7px 10px' }}
                  placeholder="Enter customer email address..."
                  value={resendEmail}
                  onChange={e => setResendEmail(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendBillEmail(successBill.id, resendEmail);
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                  loading={resendingEmail}
                  onClick={() => handleSendBillEmail(successBill.id, resendEmail)}
                >
                  <Send size={14} /> {successBill.emailStatus?.sent ? 'Resend Bill' : 'Send Bill Email'}
                </Button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 15, flexWrap: 'wrap' }}>
            {successBill.phone && (
              <a 
                href={`https://wa.me/91${successBill.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hello ${successBill.name || 'Customer'},\nThank you for shopping with us!\nYour bill amount is ₹${successBill.total}.\nBill ID: ${successBill.id}`)}`}
                target="_blank" rel="noreferrer"
                className="btn btn-primary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: '#25D366', borderColor: '#25D366' }}
              >
                Send WhatsApp
              </a>
            )}
            <Button variant="ghost" onClick={() => { setSuccessBill(null); setShowManualEmail(false); }}>New Sale</Button>
          </div>
        </div>
      )}

      {/* Mobile Tab Bar — only shows on mobile via CSS */}
      <div className="pos-tab-bar">
        <button
          className={`pos-tab-btn ${mobileTab === 'products' ? 'active' : ''}`}
          onClick={() => setMobileTab('products')}
        >
          <Package size={16} /> Products
        </button>
        <button
          className={`pos-tab-btn ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <ShoppingCart size={16} /> Cart {cart.length > 0 && `(${cart.length})`}
        </button>
      </div>

      {/* Two-panel layout: desktop = side by side, mobile = tabs */}
      <div className="pos-layout">
        {/* Left: Product Grid */}
        <div className={`card pos-products-panel ${mobileTab === 'products' ? 'active' : ''}`} style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-box" style={{ margin: 0, width: '100%' }}>
              <Search size={16} color="var(--muted)" />
              <input 
                type="text" 
                placeholder="Search products by name or SKU..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                style={{ fontSize: '0.92rem' }}
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 10, alignContent: 'start' }}>
            {filteredProducts.map(p => (
              <div 
                key={p._id} 
                onClick={() => addToCart(p)}
                style={{ 
                  background: 'var(--surface2)', 
                  border: '1px solid var(--border)',
                  borderRadius: 10, padding: 12, 
                  cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                  opacity: p.stock > 0 ? 1 : 0.5,
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
                onMouseOver={(e) => { if(p.stock>0) e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8 }}>{p.sku}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.92rem' }}>₹{p.price}</span>
                  <Badge color={p.stock > 10 ? 'green' : p.stock > 0 ? 'yellow' : 'red'}>{p.stock}</Badge>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--muted)', padding: 40 }}>No products found</div>
            )}
          </div>
          {mobileTab === 'products' && cart.length > 0 && (
            <div className="pos-mobile-cart-bar" onClick={() => setMobileTab('cart')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={18} />
                <span>{cart.reduce((s, i) => s + i.qty, 0)} items · ₹{cartTotal.toLocaleString()}</span>
              </div>
              <span>View Cart & Checkout →</span>
            </div>
          )}
        </div>

        {/* Right: Cart & Checkout */}
        <div className={`card pos-cart-panel ${mobileTab === 'cart' ? 'active' : ''}`} style={{ padding: 0 }}>
          {/* Cart Header - Fixed */}
          <div className="pos-cart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingCart size={18} color="var(--accent)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Current Bill</h3>
              {cart.length > 0 && (
                <Badge color="accent">{cart.reduce((s, i) => s + i.qty, 0)} items</Badge>
              )}
            </div>
            {cart.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--red)', height: 'auto' }}
                onClick={() => setCart([])}
                title="Clear all items from cart"
              >
                <Trash2 size={12} style={{ marginRight: 3 }} /> Clear
              </button>
            )}
          </div>
          
          {/* Cart Items List - INDEPENDENTLY SCROLLABLE */}
          <div className="pos-cart-items">
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '36px 0' }}>
                <ShoppingCart size={38} opacity={0.25} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Cart is empty</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted2)', marginTop: 4 }}>Select products from catalog to add</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cart.map(item => (
                  <div
                    key={item.product._id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--surface2)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 2 }}>
                        ₹{item.product.price} / unit
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', padding: '2px 4px' }}>
                        <button
                          className="icon-btn"
                          style={{ width: 22, height: 22, border: 'none', background: 'none' }}
                          onClick={() => updateQty(item.product._id, -1)}
                          title="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, width: 22, textAlign: 'center' }}>
                          {item.qty}
                        </span>
                        <button
                          className="icon-btn"
                          style={{ width: 22, height: 22, border: 'none', background: 'none' }}
                          onClick={() => updateQty(item.product._id, 1)}
                          title="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div style={{ fontWeight: 700, width: 55, textAlign: 'right', fontSize: '0.86rem', color: 'var(--accent)' }}>
                        ₹{(item.product.price * item.qty).toLocaleString()}
                      </div>

                      <button
                        className="icon-btn"
                        style={{ color: 'var(--red)', width: 26, height: 26, border: 'none', background: 'none' }}
                        onClick={() => removeFromCart(item.product._id)}
                        title="Remove product"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Footer - Fixed at bottom */}
          <div className="pos-cart-footer">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}><User size={14} /> Select Customer</label>
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem', height: 'auto' }} onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}>
                  {showNewCustomerForm ? 'Cancel' : '+ New'}
                </button>
              </div>

              {showNewCustomerForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface1)', padding: 12, borderRadius: 8, border: '1px dashed var(--border)' }}>
                  <input type="text" className="form-input" placeholder="Name *" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                  <input type="email" className="form-input" placeholder="Email (for bill)" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                  <input type="text" className="form-input" placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Button size="sm" onClick={handleAddCustomer} loading={customerLoading}>Save & Select</Button>
                    <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>(or click Generate Bill directly)</span>
                  </div>
                </div>
              ) : (
                <>
                  <select className="form-input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                    <option value="">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.email || c.phone || 'No contact'})</option>
                    ))}
                  </select>
                  {!selectedCustomer && (
                    <input
                      type="email"
                      className="form-input"
                      style={{ marginTop: 6, fontSize: '0.82rem', padding: '6px 10px' }}
                      placeholder="Customer email for bill receipt (optional)"
                      value={walkInEmail}
                      onChange={e => setWalkInEmail(e.target.value)}
                    />
                  )}
                </>
              )}
            </div>
            
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Payment Method</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['cash', 'card', 'upi'].map(m => (
                  <button 
                    key={m} 
                    className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-ghost'}`} 
                    style={{ flex: 1, textTransform: 'capitalize', padding: '7px 4px', fontSize: '0.82rem' }}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* UPI QR AND TOTAL ROW */}
            {paymentMethod === 'upi' && cartTotal > 0 && storeInfo?.upiId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--accent)', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#fff', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
                    <QRCodeCanvas 
                      value={`upi://pay?pa=${storeInfo.upiId}&pn=${encodeURIComponent(storeInfo.name)}&am=${cartTotal}&cu=INR`}
                      size={65}
                      level="M"
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#333', fontSize: '0.85rem' }}>Scan to Pay</div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: 2 }}>{storeInfo.upiId}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.25rem' }}>₹{cartTotal.toLocaleString()}</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: '1.1rem', fontWeight: 700 }}>
                <span>Total:</span>
                <span style={{ color: 'var(--accent)' }}>₹{cartTotal.toLocaleString()}</span>
              </div>
            )}

            {paymentMethod === 'upi' && cartTotal > 0 && !storeInfo?.upiId && (
              <div style={{ marginBottom: 14, padding: 10, background: 'var(--surface2)', borderRadius: 8, color: 'var(--muted)', fontSize: '0.82rem' }}>
                <QrCode size={16} style={{ marginBottom: -3, marginRight: 5 }} /> 
                Store UPI ID is not configured in Settings.
              </div>
            )}

            <Button variant="primary" style={{ width: '100%', height: 42, fontSize: '0.95rem' }} disabled={cart.length === 0} loading={checkoutLoading} onClick={handleCheckout}>
              Generate Bill (Checkout)
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default POS;
