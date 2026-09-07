import { useState } from 'react';
import Layout from '../components/layout/Layout';
import KPICard from '../components/ui/KPICard';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import {
  Package, AlertTriangle, TrendingDown, IndianRupee,
  Plus, Search, X, Trash2
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const GROCERY_CATEGORIES = [
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

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'pack', 'dozen', 'box'];

const stockStatusMap = {
  ok:       { color: 'green',  label: 'In Stock' },
  low:      { color: 'yellow', label: 'Low Stock' },
  critical: { color: 'red',    label: 'Critical' },
  out:      { color: 'muted',  label: 'Out of Stock' },
};

// ── Add Product Modal ───────────────────────────────────────
const AddProductModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({
    name: '', sku: '', category: 'Fruits & Vegetables',
    price: '', costPrice: '', stock: '', unit: 'kg',
    reorderLevel: 10, supplier: '', branch: 'Main Branch',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.sku || !form.price || !form.costPrice) {
      toast.error('Naam, SKU, price aur cost price zaroori hain');
      return;
    }
    setLoading(true);
    try {
      await onAdded({
        ...form,
        price: parseFloat(form.price),
        costPrice: parseFloat(form.costPrice),
        stock: parseInt(form.stock) || 0,
        reorderLevel: parseInt(form.reorderLevel) || 10,
      });
      toast.success(`${form.name} inventory mein add ho gaya ✅`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Product add karne mein error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={20} color="var(--accent)" />
            <span className="modal-title">Naya Product Add Karo</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 0 4px' }}>
          <div className="form-grid-2">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Product ka Naam *</label>
              <input className="form-input" name="name" placeholder="e.g. Amul Doodh 1L" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">SKU Code *</label>
              <input className="form-input" name="sku" placeholder="e.g. DAI-100" value={form.sku} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (₹) *</label>
              <input className="form-input" name="price" type="number" min="0" step="0.01" placeholder="0.00" value={form.price} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Cost Price (₹) *</label>
              <input className="form-input" name="costPrice" type="number" min="0" step="0.01" placeholder="0.00" value={form.costPrice} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Stock Quantity *</label>
              <input className="form-input" name="stock" type="number" min="0" placeholder="0" value={form.stock} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-input" name="unit" value={form.unit} onChange={handleChange}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reorder Level</label>
              <input className="form-input" name="reorderLevel" type="number" min="0" value={form.reorderLevel} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select className="form-input" name="branch" value={form.branch} onChange={handleChange}>
                <option value="Main Branch">Main Branch</option>
                <option value="East Wing">East Wing</option>
                <option value="West Wing">West Wing</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Supplier (optional)</label>
              <input className="form-input" name="supplier" placeholder="Supplier ka naam" value={form.supplier} onChange={handleChange} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>
              <Plus size={15} /> Product Add Karo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Inventory Page ─────────────────────────────────────
const Inventory = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [editingStock, setEditingStock] = useState({});
  const [saving, setSaving]             = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isAdmin = ['admin', 'store_owner'].includes(user?.role);
  const isStaff = user?.role === 'staff';
  const canAddOrEdit = ['admin', 'manager', 'staff', 'store_owner'].includes(user?.role);

  const { inventory, kpis, loading, refetch, updateStock, addProduct, deleteProduct } = useInventory({
    status: statusFilter,
    search,
  });

  // Filter by category client-side
  const filtered = categoryFilter === 'all'
    ? inventory
    : inventory.filter(p => p.category === categoryFilter);

  const handleStockUpdate = async (id, newStock) => {
    setSaving(s => ({ ...s, [id]: true }));
    try {
      await updateStock(id, { stock: parseInt(newStock) });
      toast.success('Stock update ho gaya ✅');
      setEditingStock(s => { const n = { ...s }; delete n[id]; return n; });
    } catch {
      toast.error('Stock update karne mein error');
    } finally {
      setSaving(s => ({ ...s, [id]: false }));
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      toast.success('Product delete ho gaya');
      setDeleteTarget(null);
    } catch {
      toast.error('Delete karne mein error');
    }
  };

  const columns = [
    {
      key: 'name', label: 'Product',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{v}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted2)' }}>{row.sku} · {row.supplier && <span style={{ color: 'var(--muted)' }}>{row.supplier}</span>}</div>
        </div>
      )
    },
    { key: 'category', label: 'Category', render: (v) => <Badge color="accent">{v}</Badge> },
    { key: 'unit', label: 'Unit', render: (v) => <span className="text-muted">{v}</span> },
    { key: 'price', label: 'Price (₹)', render: (v) => <span className="font-semibold">₹{v?.toFixed(2)}</span> },
    {
      key: 'stock', label: 'Stock',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editingStock[row._id] !== undefined ? (
            <input
              type="number"
              value={editingStock[row._id]}
              min={0}
              onChange={e => setEditingStock(s => ({ ...s, [row._id]: e.target.value }))}
              style={{
                width: 70, padding: '4px 8px', background: 'var(--surface)',
                border: '1px solid var(--accent)', borderRadius: 6,
                color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
              }}
            />
          ) : (
            <span style={{ fontWeight: 600 }}>{v}</span>
          )}
        </div>
      )
    },
    { key: 'reorderLevel', label: 'Reorder At', render: (v) => <span className="text-muted">{v}</span> },
    {
      key: 'stockStatus', label: 'Status',
      render: (_, row) => {
        const status = row.stock === 0 ? 'out' : row.stock <= row.reorderLevel / 2 ? 'critical' : row.stock <= row.reorderLevel ? 'low' : 'ok';
        const { color, label } = stockStatusMap[status];
        return <Badge color={color} dot>{label}</Badge>;
      }
    },
    {
      key: 'actions', label: 'Action',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          {editingStock[row._id] !== undefined ? (
            <>
              <Button size="sm" variant="primary" loading={saving[row._id]} onClick={() => handleStockUpdate(row._id, editingStock[row._id])}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingStock(s => { const n = { ...s }; delete n[row._id]; return n; })}>Cancel</Button>
            </>
          ) : (
            <>
              {canAddOrEdit && (
                <Button size="sm" variant="secondary" onClick={() => setEditingStock(s => ({ ...s, [row._id]: row.stock }))}>
                  Stock Update
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row)}>
                  <Trash2 size={12} />
                </Button>
              )}
            </>
          )}
        </div>
      )
    },
  ];

  const statusFilters = [
    { label: 'Sab', value: 'all' },
    { label: '🔴 Critical', value: 'critical' },
    { label: '🟡 Kam Stock', value: 'low' },
    { label: '✅ Available', value: 'ok' },
    { label: '⚫ Khatam', value: 'out' },
  ];

  return (
    <Layout
      title={user?.role === 'staff' ? 'Stock Management' : 'Inventory'}
      subtitle={user?.role === 'staff' ? 'Stocks dekho aur update karo' : 'Stock levels, alerts, aur grocery products manage karo'}
      onRefresh={refetch}
      loading={loading}
    >
      {/* KPIs — Staff ko sirf stock KPIs dikhao, revenue nahi */}
      <div className="section">
        <div className="grid kpi-grid">
          <KPICard label="Total Products"  value={kpis?.totalSkus ?? '—'}        icon={Package}       color="accent" />
          <KPICard label="Critical Stock"  value={kpis?.criticalStock ?? '—'}    icon={AlertTriangle} color="red"    trend="down" trendValue={2} />
          <KPICard label="Low Stock Items" value={kpis?.lowStock ?? '—'}         icon={TrendingDown}  color="yellow" />
          <KPICard label="Out of Stock"    value={kpis?.outOfStock ?? '—'}       icon={Package}       color="muted" />
          {/* Inventory Value sirf admin/manager ke liye */}
          {!isStaff && (
            <KPICard
              label="Inventory Value"
              value={kpis?.inventoryValue != null ? `₹${Math.round(kpis.inventoryValue).toLocaleString('en-IN')}` : '—'}
              icon={IndianRupee}
              color="green"
            />
          )}
        </div>
      </div>

      {/* Filters + Search */}
      <div className="section">
        <div className="flex-between mb-16" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="filter-bar" style={{ margin: 0 }}>
            {statusFilters.map(f => (
              <button
                key={f.value}
                className={`filter-tab${statusFilter === f.value ? ' active' : ''}`}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              style={{ height: 36, fontSize: '0.82rem', padding: '0 10px', width: 'auto' }}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="search-box" style={{ maxWidth: 220, height: 36 }}>
              <Search size={14} color="var(--muted)" />
              <input
                type="text"
                placeholder="Product dhundo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="inventory-search"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="card-title">Grocery Inventory</div>
              <span className="text-muted text-sm">{filtered.length} products</span>
            </div>
            {canAddOrEdit && (
              <Button variant="primary" onClick={() => setShowAddModal(true)} id="add-product-btn">
                <Plus size={15} /> Naya Product Add Karo
              </Button>
            )}
          </div>
          <Table columns={columns} data={filtered} loading={loading} emptyText="Koi product nahi mila" />
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          onAdded={addProduct}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trash2 size={20} color="var(--red, #ef4444)" />
                <span className="modal-title">Product Delete Karo</span>
              </div>
              <button className="icon-btn" onClick={() => setDeleteTarget(null)}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
              Kya aap sure hain? <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong> permanently delete ho jayega.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDelete(deleteTarget._id)}>
                <Trash2 size={14} /> Haan, Delete Karo
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Inventory;
