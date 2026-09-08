import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import Button from '../components/ui/Button';
import api from '../services/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    name: '',
    gstNumber: '',
    address: '',
    phone: '',
    upiId: '',
    emailConfig: {
      email: '',
      appPassword: ''
    }
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/store/settings');
      setSettings(data.data);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value, isEmailConfig = false) => {
    if (isEmailConfig) {
      setSettings(prev => ({
        ...prev,
        emailConfig: {
          ...prev.emailConfig,
          [field]: value
        }
      }));
    } else {
      setSettings(prev => ({ ...prev, [field]: value }));
    }
  };

  const [testingEmail, setTestingEmail] = useState(false);

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const { data } = await api.post('/store/test-email', {
        email: settings.emailConfig.email,
        appPassword: settings.emailConfig.appPassword
      });
      toast.success(data.message || 'Email connection verified successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email verification failed. Check credentials.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/store/settings', settings);
      setSettings(data.data);
      toast.success('Settings updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout title="Store Settings" loading={true}><div/></Layout>;

  return (
    <Layout title="Store Settings" subtitle="Manage your store details and configurations">
      <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
        <form onSubmit={handleSave}>
          <h3 style={{ marginTop: 0, marginBottom: 20 }}>General Information</h3>
          
          <div className="form-group">
            <label className="form-label">Store Name</label>
            <input 
              type="text" 
              className="form-input" 
              required
              value={settings.name} 
              onChange={e => handleChange('name', e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">GST Number</label>
            <input 
              type="text" 
              className="form-input" 
              value={settings.gstNumber} 
              onChange={e => handleChange('gstNumber', e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea 
              className="form-input" 
              rows="3"
              value={settings.address} 
              onChange={e => handleChange('address', e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone</label>
            <input 
              type="text" 
              className="form-input" 
              value={settings.phone} 
              onChange={e => handleChange('phone', e.target.value)} 
            />
          </div>

          <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

          <h3 style={{ marginTop: 0, marginBottom: 20 }}>Email Configuration (Billing)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20 }}>
            Configure your Gmail and App Password to automatically send PDF bills to customers from your own store's email address.
          </p>

          <div className="form-group">
            <label className="form-label">Gmail Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="store@gmail.com"
              value={settings.emailConfig.email} 
              onChange={e => handleChange('email', e.target.value, true)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Google App Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder={settings.emailConfig.appPassword ? "********" : "Enter 16-digit app password"}
              value={settings.emailConfig.appPassword === '********' ? '' : settings.emailConfig.appPassword} 
              onChange={e => handleChange('appPassword', e.target.value, true)} 
            />
            <small style={{ display: 'block', marginTop: 5, color: 'var(--muted2)' }}>
              Note: Leave empty if you don't want to change the existing password. Use Google Account Settings {'->'} Security to generate an App Password.
            </small>
            <div style={{ marginTop: 12 }}>
              <Button type="button" variant="secondary" size="sm" loading={testingEmail} onClick={handleTestEmail}>
                Test Email Connection
              </Button>
            </div>
          </div>

          <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

          <h3 style={{ marginTop: 0, marginBottom: 20 }}>Payment Configuration (UPI)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 20 }}>
            Enter your UPI ID (VPA) to generate dynamic QR codes during billing. Customers can scan the QR to pay the exact bill amount directly to your bank.
          </p>

          <div className="form-group">
            <label className="form-label">Store UPI ID</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. 9999999999@ybl or storename@okhdfcbank"
              value={settings.upiId || ''} 
              onChange={e => handleChange('upiId', e.target.value)} 
            />
          </div>

          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" loading={saving}>
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default Settings;
