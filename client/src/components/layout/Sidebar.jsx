import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Package, Users, UserCheck,
  FileText, LogOut, Zap, ShoppingCart, Calculator, Settings as SettingsIcon, IndianRupee, X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

const navItems = [
  // Admin + Manager only
  { to: '/',          icon: LayoutDashboard, label: 'Overview',  roles: ['admin','manager','store_owner'] },
  { to: '/sales',     icon: TrendingUp,      label: 'Sales',     roles: ['admin','manager','store_owner'] },
  { to: '/customers', icon: Users,           label: 'Customers', roles: ['admin','manager','store_owner'] },
  { to: '/staff',     icon: UserCheck,       label: 'Staff',     roles: ['admin','manager','store_owner'] },
  { to: '/expenses',  icon: IndianRupee,     label: 'Expenses',  roles: ['admin','manager','store_owner'] },
  { to: '/reports',   icon: FileText,        label: 'Reports',   roles: ['admin','manager','store_owner'] },
  // POS and Inventory available to all
  { to: '/pos',       icon: Calculator,      label: 'Billing (POS)', roles: ['admin','manager','staff','store_owner'] },
  { to: '/inventory', icon: Package,         label: 'Inventory', roles: ['admin','manager','staff','store_owner'] },
  // Settings
  { to: '/settings',  icon: SettingsIcon,    label: 'Settings',  roles: ['admin','store_owner'] },
];

const Sidebar = ({ alertCount = 0, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U';
  const allowedNav = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">
            <ShoppingCart size={18} />
          </div>
          <div>
            <div className="logo-text">GroceryIQ</div>
            <span className="logo-tag">Store Management</span>
          </div>
        </div>
        
        {/* Mobile Close Button */}
        <button 
          className="mobile-close-btn" 
          onClick={onClose}
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', marginLeft: 'auto' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main Menu</div>
        {allowedNav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            onClick={() => onClose && onClose()}
          >
            <Icon className="nav-icon" size={18} />
            {label}
            {label === 'Inventory' && alertCount > 0 && (
              <span className="nav-badge">{alertCount}</span>
            )}
          </NavLink>
        ))}

        {(user?.role === 'admin' || user?.role === 'store_owner') && (
          <>
            <div className="nav-section-label" style={{ marginTop: 8 }}>System</div>
            <div className="nav-item" style={{ cursor: 'default', opacity: 0.6 }}>
              <Zap size={18} className="nav-icon" />
              Real-time Active
              <span style={{ marginLeft: 'auto' }}>
                <span className="live-dot" style={{ width: 8, height: 8, background: 'var(--green)', borderRadius: '50%', display: 'inline-block', animation: 'pulse-green 2s infinite' }} />
              </span>
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role} · {user?.branch}</div>
          </div>
          <button
            onClick={handleLogout}
            className="icon-btn"
            style={{ width: 28, height: 28, border: 'none' }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
