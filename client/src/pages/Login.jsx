import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';

const DEMO_CREDS = [
  { role: 'Admin',   email: 'admin@groceryiq.com',   password: 'admin123' },
  { role: 'Manager', email: 'manager@groceryiq.com', password: 'manager123' },
  { role: 'Staff',   email: 'staff1@groceryiq.com',  password: 'staff123' },
];

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name}! 👋`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillCred = (cred) => {
    setEmail(cred.email);
    setPassword(cred.password);
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-card fade-in-up">
        <div className="login-logo">
          <div className="login-logo-icon">🛒</div>
          <h1 className="login-title">GroceryIQ</h1>
          <p className="login-subtitle">Apne grocery store mein login karo</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} id="login-form">
          <div className="input-group">
            <label className="input-label" htmlFor="login-email">Email Address</label>
            <div className="input-icon-box">
              <Mail size={16} color="var(--muted)" />
              <input
                id="login-email"
                type="email"
                placeholder="you@groceryiq.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="login-password">Password</label>
            <div className="input-icon-box">
              <Lock size={16} color="var(--muted)" />
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 4px', display: 'flex', alignItems: 'center' }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="login-btn"
            id="login-submit"
          >
            Sign In
            <ArrowRight size={16} />
          </Button>
        </form>

          <div style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--muted2)' }}>Don't have a store account? </span>
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Register your Store</Link>
          </div>
      </div>
    </div>
  );
};

export default Login;
