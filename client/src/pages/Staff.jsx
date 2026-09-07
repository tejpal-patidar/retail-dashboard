import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import KPICard from '../components/ui/KPICard';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { UserCheck, Star, Award, BarChart2, UserPlus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const shiftColor = { Morning: 'yellow', Evening: 'accent', Night: 'purple' };
const roleColor  = { admin: 'red', manager: 'accent', staff: 'green' };

const Stars = ({ rating }) => {
  const full = Math.floor(rating);
  return (
    <div className="stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`star${i < full ? '' : ' empty'}`}>★</span>
      ))}
      <span style={{ fontSize: '0.75rem', color: 'var(--muted2)', marginLeft: 4 }}>
        {Number(rating).toFixed(1)}
      </span>
    </div>
  );
};

// ── Add Staff Modal ─────────────────────────────────────────
const AddStaffModal = ({ onClose, onAdded }) => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'staff',
    shift: 'Morning', branch: 'Main Branch',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email aur password zaroori hain');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/staff', form);
      toast.success(`${data.data.user?.name} ko staff mein add kar diya ✅`);
      onAdded();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Staff add karne mein error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserPlus size={20} color="var(--accent)" />
            <span className="modal-title">Naya Staff Member Add Karo</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 0 4px' }}>
          <div className="form-group">
            <label className="form-label">Naam *</label>
            <input className="form-input" name="name" placeholder="Staff ka naam" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" name="email" type="email" placeholder="email@example.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input className="form-input" name="password" type="password" placeholder="Min 6 characters" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" name="role" value={form.role} onChange={handleChange}>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Shift</label>
              <select className="form-input" name="shift" value={form.shift} onChange={handleChange}>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Branch</label>
            <select className="form-input" name="branch" value={form.branch} onChange={handleChange}>
              <option value="Main Branch">Main Branch</option>
              <option value="East Wing">East Wing</option>
              <option value="West Wing">West Wing</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" loading={loading}>
              <UserPlus size={15} /> Staff Add Karo
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Remove Confirm Modal ────────────────────────────────────
const RemoveConfirmModal = ({ staff, onClose, onRemoved }) => {
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    try {
      await api.delete(`/staff/${staff._id}`);
      toast.success(`${staff.user?.name} ko remove kar diya`);
      onRemoved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remove karne mein error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trash2 size={20} color="var(--red, #ef4444)" />
            <span className="modal-title">Staff Remove Karo</span>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Kya aap sure hain ki <strong style={{ color: 'var(--text)' }}>{staff.user?.name}</strong> ko staff se remove karna chahte hain?
          <br /><br />
          Unka account deactivate ho jayega.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={handleRemove}>
            <Trash2 size={14} /> Haan, Remove Karo
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Main Staff Page ─────────────────────────────────────────
const Staff = () => {
  const { user } = useAuth();
  const [staff,        setStaff]        = useState([]);
  const [kpis,         setKpis]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const isAdminOrManager = ['admin', 'manager', 'store_owner'].includes(user?.role);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/staff');
      setStaff(data.data);
      setKpis(data.kpis);
    } catch (err) {
      console.error(err);
      toast.error('Staff data load karne mein error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, []);

  const columns = [
    {
      key: 'user', label: 'Staff Member',
      render: (v) => {
        const name = v?.name || 'Unknown';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="staff-avatar">{initials}</div>
            <div>
              <div className="staff-name">{name}</div>
              <div className="staff-email">{v?.email}</div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'user', label: 'Role',
      render: (v) => <Badge color={roleColor[v?.role] || 'muted'}>{v?.role}</Badge>
    },
    { key: 'shift', label: 'Shift', render: (v) => <Badge color={shiftColor[v] || 'muted'}>{v}</Badge> },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge color={v === 'active' ? 'green' : 'muted'} dot>{v === 'active' ? 'On Shift' : 'Off'}</Badge>
    },
    {
      key: 'salesTotal', label: 'Total Sales',
      render: (v) => <span style={{ fontWeight: 700, color: 'var(--accent)' }}>₹{v?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
    },
    {
      key: 'transactionCount', label: 'Transactions',
      render: (v) => <span className="font-semibold">{v?.toLocaleString()}</span>
    },
    { key: 'rating', label: 'Rating', render: (v) => <Stars rating={v} /> },
    ...(isAdminOrManager ? [{
      key: 'actions', label: 'Action',
      render: (_, row) => (
        <Button
          size="sm"
          variant="danger"
          onClick={() => setRemoveTarget(row)}
          title="Staff remove karo"
        >
          <Trash2 size={13} /> Remove
        </Button>
      )
    }] : []),
  ];

  return (
    <Layout title="Staff Management" subtitle="Staff ko manage karo — add, remove, aur performance dekho" onRefresh={fetchStaff} loading={loading}>

      {/* KPIs */}
      <div className="section">
        <div className="grid kpi-grid">
          <KPICard label="On Shift"         value={kpis?.onShift ?? '—'}         icon={UserCheck}  color="green"  />
          <KPICard label="Top Performer"    value={kpis?.topSeller || '—'}        icon={Award}      color="yellow" />
          <KPICard label="Avg Rating"       value={kpis?.avgRating ?? '—'}        icon={Star}       color="purple" />
          <KPICard label="Avg Transactions" value={kpis?.avgTransactions ?? '—'}  icon={BarChart2}  color="accent" />
        </div>
      </div>

      {/* Staff Table */}
      <div className="section">
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div className="card-title">Staff Members</div>
              <span className="text-muted text-sm">{staff.length} log registered hain</span>
            </div>
            {isAdminOrManager && (
              <Button variant="primary" onClick={() => setShowAddModal(true)} id="add-staff-btn">
                <UserPlus size={15} /> Naya Staff Add Karo
              </Button>
            )}
          </div>
          <Table columns={columns} data={staff} loading={loading} emptyText="Koi staff record nahi mila" />
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <AddStaffModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchStaff}
        />
      )}

      {/* Remove Confirm Modal */}
      {removeTarget && (
        <RemoveConfirmModal
          staff={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onRemoved={fetchStaff}
        />
      )}
    </Layout>
  );
};

export default Staff;
