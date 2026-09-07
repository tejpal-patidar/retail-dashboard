import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import api from '../services/api';
import toast from 'react-hot-toast';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Other',
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ['Salary', 'Rent', 'Electricity', 'Maintenance', 'Marketing', 'Logistics', 'Other'];

  const fetchExpenses = async () => {
    try {
      const { data } = await api.get('/expenses');
      setExpenses(data.data);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/expenses', formData);
      toast.success('Expense added successfully');
      setShowForm(false);
      setFormData({ description: '', amount: '', category: 'Other', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      fetchExpenses();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const columns = [
    { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString('en-IN') },
    { key: 'description', label: 'Description', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: 'category', label: 'Category', render: (v) => <Badge color="purple">{v}</Badge> },
    { key: 'amount', label: 'Amount', render: (v) => <span style={{ color: 'var(--red)', fontWeight: 700 }}>-₹{v.toLocaleString()}</span> },
    { key: 'actions', label: 'Action', render: (_, row) => (
      <Button size="sm" variant="danger" onClick={() => handleDelete(row._id)}>Delete</Button>
    )}
  ];

  return (
    <Layout title="Expense Tracker" subtitle="Manage store expenses and kharcha" onRefresh={fetchExpenses} loading={loading}>
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ background: 'var(--surface2)', padding: '14px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Expenses</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--red)' }}>₹{total.toLocaleString()}</div>
          </div>
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </Button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0, marginBottom: 15 }}>Add New Expense</h3>
            <form onSubmit={handleSubmit} className="expense-form-grid">
              <div className="form-group">
                <label className="form-label">Description</label>
                <input type="text" required className="form-input" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g. June Electricity Bill" />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input type="number" required min="1" className="form-input" value={formData.amount} onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })} placeholder="5000" />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" required className="form-input" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              </div>
              <div className="form-group">
                <Button type="submit" variant="primary" style={{ height: 40, width: '100%' }}>Save</Button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="card-title">Expense History</div>
          </div>
          <Table 
            columns={columns.map((col, i) => ({ ...col, render: col.render ? (v, row) => col.render(v, row, i) : undefined }))} 
            data={expenses} 
            loading={loading} 
            emptyText="No expenses recorded yet." 
          />
        </div>
      </div>
    </Layout>
  );
};

export default Expenses;
