import { useState, useEffect, useRef } from 'react';
import { Search, Bell, RefreshCw, PackageX, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Badge from '../ui/Badge';

const Topbar = ({ title, subtitle, onRefresh, loading, onMenuClick }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  
  const store = (() => {
    try { return JSON.parse(localStorage.getItem('store')); } catch { return null; }
  })();

  useEffect(() => {
    api.get('/inventory/alerts').then(res => setAlerts(res.data.data || [])).catch(() => {});
    
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button 
          className="mobile-menu-btn icon-btn" 
          onClick={onMenuClick}
          style={{ display: 'none', border: 'none', background: 'none' }}
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: '0.72rem', color: 'var(--muted2)', marginTop: 1 }}>
              {subtitle} • {store ? store.name : 'Store'}
            </p>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE
        </div>

        {onRefresh && (
          <button className="icon-btn" onClick={onRefresh} title="Refresh data" id="topbar-refresh">
            <RefreshCw size={15} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
        )}

        <div style={{ position: 'relative' }} ref={notifRef}>
          <button className="icon-btn" id="topbar-notifications" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={15} />
            {alerts.length > 0 && <span className="notif-dot" style={{ background: 'var(--red)' }}>{alerts.length}</span>}
          </button>

          {showNotifications && (
            <div style={{
              position: 'absolute', top: '120%', right: 0, width: 280, maxWidth: 'calc(100vw - 30px)',
              background: 'var(--surface1)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 100,
              display: 'flex', flexDirection: 'column'
            }}>
              <div style={{ padding: '12px 15px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem' }}>
                Low Stock Alerts
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>All stock levels are good! 🎉</div>
                ) : (
                  alerts.map(item => (
                    <div key={item._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderBottom: '1px dashed var(--surface2)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yellow)' }}>
                        <PackageX size={16} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Stock: {item.stock} left</div>
                      </div>
                      <Badge color={item.stockStatus === 'out' ? 'red' : item.stockStatus === 'critical' ? 'orange' : 'yellow'}>
                        {item.stockStatus}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 11, color: 'white', flexShrink: 0,
          }}
        >
          {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || 'U'}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
