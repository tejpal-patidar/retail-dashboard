import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Store, User, Mail, Lock, Phone, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';

const Register = () => {
  const { registerStore } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    storeName: '',
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.storeName || !formData.name || !formData.email || !formData.password) {
      return toast.error('Please fill in all required fields');
    }
    setLoading(true);
    try {
      const data = await registerStore(formData);
      toast.success(`Welcome to GroceryIQ, ${data.user.name}! 🏪`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" style={{ background: 'var(--green)' }} />
      <div className="login-bg-orb login-bg-orb-2" style={{ background: 'var(--accent)' }} />

      <div className="login-card fade-in-up" style={{ maxWidth: 480 }}>
        <div className="login-logo">
          <div className="login-logo-icon">🏪</div>
          <h1 className="login-title">Register Store</h1>
          <p className="login-subtitle">Set up your GroceryIQ account</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Store Name *</label>
            <div className="input-icon-box">
              <Store size={16} color="var(--muted)" />
              <input
                type="text"
                placeholder="My Grocery Store"
                value={formData.storeName}
                onChange={e => setFormData({ ...formData, storeName: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="input-group">
              <label className="input-label">Your Name *</label>
              <div className="input-icon-box">
                <User size={16} color="var(--muted)" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Phone</label>
              <div className="input-icon-box">
                <Phone size={16} color="var(--muted)" />
                <input
                  type="text"
                  placeholder="1234567890"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email Address *</label>
            <div className="input-icon-box">
              <Mail size={16} color="var(--muted)" />
              <input
                type="email"
                placeholder="you@groceryiq.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password *</label>
            <div className="input-icon-box">
              <Lock size={16} color="var(--muted)" />
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="login-btn"
            style={{ background: 'linear-gradient(135deg, var(--green), #20B2AA)' }}
          >
            Create Store Account
            <ArrowRight size={16} />
          </Button>
          
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--muted2)' }}>Already have an account? </span>
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Login here</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
