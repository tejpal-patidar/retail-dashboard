import Layout from '../components/layout/Layout';
import KPICard from '../components/ui/KPICard';
import Table from '../components/ui/Table';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import RevenueChart from '../components/charts/RevenueChart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { IndianRupee, TrendingUp, ShoppingBag, Percent, Mail } from 'lucide-react';
import { useSales } from '../hooks/useSales';

const Sales = () => {
  const { summary, dailySales, topProducts, sales, loading, refetch } = useSales({ period: '30' });

  const fmt = (n) => n != null ? `₹${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';

  const paymentColor = { cash: 'green', card: 'accent', upi: 'purple' };

  const columns = [
    { key: 'rank', label: '#', width: 50, render: (_, __, idx) => idx + 1 },
    { key: 'name',  label: 'Product', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { key: 'sku',   label: 'SKU',      render: (v) => <span className="text-muted text-xs">{v}</span> },
    { key: 'category', label: 'Category', render: (v) => <Badge color="accent">{v}</Badge> },
    { key: 'totalQty',     label: 'Units Sold', render: (v) => <span className="font-semibold">{v?.toLocaleString()}</span> },
    { key: 'totalRevenue', label: 'Revenue', render: (v) => <span style={{ color: 'var(--accent)', fontWeight: 700 }}>₹{v?.toLocaleString()}</span> },
    { key: 'totalProfit',  label: 'Profit', render: (v) => <span style={{ color: 'var(--green)', fontWeight: 700 }}>₹{v?.toLocaleString()}</span> },
    {
      key: 'margin', label: 'Margin',
      render: (_, row) => {
        const m = row.totalRevenue > 0 ? ((row.totalProfit / row.totalRevenue) * 100).toFixed(1) : 0;
        return <Badge color={m > 30 ? 'green' : m > 20 ? 'yellow' : 'red'}>{m}%</Badge>;
      }
    },
  ];

  // Daily bar chart data
  const barData = dailySales.slice(-10).map(item => ({
    label: new Date(item._id).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    revenue: Math.round(item.revenue),
    profit: Math.round(item.profit),
  }));

  return (
    <Layout title="Sales" subtitle="Revenue, profit, and product performance" onRefresh={refetch} loading={loading}>
      {/* KPIs */}
      <div className="section">
        <div className="grid kpi-grid">
          <KPICard label="Total Revenue"    value={fmt(summary?.totalRevenue)}   icon={IndianRupee}  color="accent" trend="up" trendValue={12.4} />
          <KPICard label="Total Profit"     value={fmt(summary?.totalProfit)}    icon={TrendingUp}  color="green"  trend="up" trendValue={9.7} />
          <KPICard
            label="Avg Basket Size"
            value={summary?.aov != null ? `₹${Number(summary.aov).toFixed(2)}` : '—'}
            icon={ShoppingBag}
            color="purple"
            trend="up" trendValue={3.2}
          />
          <KPICard
            label="Profit Margin"
            value={summary?.totalRevenue > 0
              ? `${((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)}%`
              : '—'
            }
            icon={Percent}
            color="yellow"
            trend="up" trendValue={1.8}
          />
        </div>
      </div>

      {/* Daily Bar Chart */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Daily Sales (Last 10 Days)</div>
              <div className="card-subtitle">Revenue vs Profit breakdown</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,38,64,0.8)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#4A5270', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4A5270', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: '#131829', border: '1px solid #1E2640', borderRadius: 10, fontSize: '0.85rem' }}
                labelStyle={{ color: '#4A5270' }}
              />
              <Legend wrapperStyle={{ fontSize: '0.78rem', color: '#4A5270', paddingTop: 10 }} iconType="circle" iconSize={8} />
              <Bar dataKey="revenue" fill="#5B8AF0" radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="profit"  fill="#34D99E" radius={[4,4,0,0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Products Table */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Products by Revenue</div>
            <div className="card-subtitle">Last 30 days performance</div>
          </div>
          <Table
            columns={columns.map((col, i) => ({ ...col, render: col.render ? (v, row) => col.render(v, row, i) : undefined }))}
            data={topProducts}
            loading={loading}
            emptyText="No sales data found"
          />
        </div>
      </div>

      {/* Recent Bills Table */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Bills</div>
            <div className="card-subtitle">Latest sales transactions</div>
          </div>
          <Table
            columns={[
              { key: '_id', label: 'Bill ID', render: v => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{v.slice(-6)}</span> },
              { key: 'createdAt', label: 'Date', render: v => new Date(v).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) },
              { key: 'customer', label: 'Customer', render: v => v ? v.name : <span className="text-muted">Walk-in</span> },
              { key: 'total', label: 'Amount', render: v => <span style={{ fontWeight: 600, color: 'var(--accent)' }}>₹{v.toLocaleString()}</span> },
              { key: 'paymentMethod', label: 'Payment', render: v => <Badge color={paymentColor[v] || 'muted'}>{v}</Badge> },
              { key: 'actions', label: 'Action', render: (_, row) => (
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button size="sm" variant="ghost" title="Email invoice to customer" onClick={async () => {
                    const defaultEmail = row.customerEmail || row.customer?.email || '';
                    const email = window.prompt(`Send invoice for Bill #${row._id.slice(-6)} to email:`, defaultEmail);
                    if (!email || !email.trim()) return;
                    
                    const toast = (await import('react-hot-toast')).default;
                    const toastId = toast.loading('Sending bill invoice...');
                    try {
                      const api = (await import('../services/api')).default;
                      const { data } = await api.post(`/sales/${row._id}/send-email`, { email: email.trim() });
                      toast.success(data.message || 'Invoice emailed successfully!', { id: toastId });
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to send invoice email', { id: toastId });
                    }
                  }}>
                    <Mail size={14} style={{ marginRight: 4 }} /> Email
                  </Button>
                  {['admin', 'store_owner'].includes(JSON.parse(localStorage.getItem('user') || '{}')?.role) && (
                    <Button size="sm" variant="danger" onClick={async () => {
                      if (window.confirm('Delete this bill? Stock will be restored.')) {
                        try {
                          await import('../services/api').then(m => m.default.delete(`/sales/${row._id}`));
                          refetch();
                          import('react-hot-toast').then(m => m.default.success('Bill deleted successfully'));
                        } catch(e) {
                          import('react-hot-toast').then(m => m.default.error('Failed to delete bill'));
                        }
                      }
                    }}>Delete</Button>
                  )}
                </div>
              )}
            ]}
            data={sales}
            loading={loading}
            emptyText="No recent bills"
          />
        </div>
      </div>
    </Layout>
  );
};

export default Sales;
