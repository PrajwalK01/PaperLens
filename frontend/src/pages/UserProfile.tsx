import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, LogOut, AlertCircle, CheckCircle, Loader2, Trash2, Eye, EyeOff, Settings as SettingsIcon, Link } from 'lucide-react';
import { getMe, logout, updateProfileEmail, changePassword, deleteAccount } from '../api';
import { useAuth } from '../components/ui/Layout';

const CARD = { background: 'rgba(13,15,26,0.7)', border: '1px solid rgba(99,102,241,0.18)' };

const INPUT_STYLE = {
  background: 'rgba(99,102,241,0.07)',
  border: '1px solid rgba(99,102,241,0.2)',
  color: '#e2e4f0',
  outline: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 14,
  width: '100%',
  transition: 'border-color 0.15s',
};

export default function UserProfile() {
  const { user: authUser, openAuth } = useAuth();
  const [user, setUser]           = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'admin'>('profile');
  const [loading, setLoading]     = useState(true);
  const [message, setMessage]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword]   = useState('');
  const [showPasswords, setShowPasswords]     = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    getMe().then(d => { setUser(d); setEditEmail(d.email); }).catch(() => {}).finally(() => setLoading(false));
  }, [authUser]);

  const handleUpdateEmail = async () => {
    if (!editEmail.includes('@')) { setMessage({ type: 'error', text: 'Invalid email format' }); return; }
    setUpdatingProfile(true);
    try {
      await updateProfileEmail(editEmail);
      setUser({ ...user, email: editEmail });
      setMessage({ type: 'success', text: 'Email updated successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update email' });
    } finally { setUpdatingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); return; }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to change password' });
    } finally { setChangingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) { setMessage({ type: 'error', text: 'Please enter your password' }); return; }
    setDeletingAccount(true);
    try { await deleteAccount(deletePassword); logout(); window.location.href = '/'; }
    catch (err: any) { setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to delete account' }); setDeletingAccount(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-indigo-400" size={32} />
    </div>
  );

  if (!authUser) return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
        <User className="w-8 h-8 text-indigo-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Sign in to view your profile</h2>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'rgba(165,180,252,0.5)' }}>
        Log in to update your email, password, or manage your account settings.
      </p>
      <button onClick={() => openAuth('login')}
        className="inline-flex items-center gap-2 text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
        Sign In / Sign Up
      </button>
    </div>
  );

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'security', label: 'Security', icon: <Lock size={16} /> },
    ...(user?.is_admin ? [{ id: 'admin', label: 'Admin', icon: <SettingsIcon size={16} /> }] : []),
  ] as const;

  return (
    <div className="max-w-2xl mx-auto pb-10 animate-fade-in">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(165,180,252,0.45)' }}>Manage your profile and preferences</p>
      </div>

      {/* Message */}
      {message && (
        <div className="mb-5 p-4 rounded-xl flex items-start gap-3 animate-slide-down"
          style={message.type === 'success'
            ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }
            : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
          {message.type === 'success'
            ? <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            : <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
          <p className="text-sm flex-1" style={{ color: message.type === 'success' ? '#6ee7b7' : '#fca5a5' }}>{message.text}</p>
          <button onClick={() => setMessage(null)} className="text-[11px] underline" style={{ color: 'rgba(165,180,252,0.4)' }}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === tab.id ? {
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
            } : { color: 'rgba(165,180,252,0.5)' }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-5 animate-fade-in">
          <div className="rounded-2xl p-6" style={CARD}>
            <h2 className="text-base font-bold text-white mb-5">Account Information</h2>
            <div className="space-y-4">
              <Field label="Username" icon={<User size={14} />}>
                <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(165,180,252,0.6)' }}>
                  {user?.username}
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(99,102,241,0.4)' }}>Username cannot be changed</p>
              </Field>

              <Field label="Email Address" icon={<Mail size={14} />}>
                <div className="flex gap-2">
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                    style={INPUT_STYLE} placeholder="your@email.com"
                    onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.55)')}
                    onBlur={e => (e.target.style.borderColor = 'rgba(99,102,241,0.2)')} />
                  <button onClick={handleUpdateEmail} disabled={updatingProfile || editEmail === user?.email}
                    className="px-5 py-2 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    {updatingProfile ? <Loader2 size={15} className="animate-spin" /> : 'Update'}
                  </button>
                </div>
              </Field>

              <Field label="Member Since">
                <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: 'rgba(165,180,252,0.6)' }}>
                  {new Date(user?.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </Field>

              {user?.is_admin && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <SettingsIcon size={16} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-300">Administrator Account</span>
                </div>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <h2 className="text-base font-bold text-red-300 mb-2 flex items-center gap-2">
              <AlertCircle size={18} /> Danger Zone
            </h2>
            <p className="text-sm mb-4" style={{ color: 'rgba(252,165,165,0.6)' }}>Permanently delete your account. This cannot be undone.</p>
            <button onClick={() => {
              if (window.confirm('Are you absolutely sure? This will permanently delete your account.')) {
                const pwd = prompt('Enter your password to confirm:');
                if (pwd) { setDeletePassword(pwd); setActiveTab('security'); }
              }
            }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-300 transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <Trash2 size={16} /> Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-fade-in">
          <div className="rounded-2xl p-6" style={CARD}>
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <Lock size={18} className="text-indigo-400" /> Change Password
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Current Password', value: currentPassword, onChange: setCurrentPassword },
                { label: 'New Password', value: newPassword, onChange: setNewPassword, hint: 'Min 8 chars, uppercase & digit required' },
                { label: 'Confirm New Password', value: confirmPassword, onChange: setConfirmPassword },
              ].map((f, i) => (
                <Field key={i} label={f.label}>
                  <div className="relative">
                    <input type={showPasswords ? 'text' : 'password'} value={f.value}
                      onChange={e => f.onChange(e.target.value)}
                      style={{ ...INPUT_STYLE, paddingRight: 44 }} placeholder="••••••••"
                      onFocus={e => (e.target.style.borderColor = 'rgba(99,102,241,0.55)')}
                      onBlur={e => (e.target.style.borderColor = 'rgba(99,102,241,0.2)')} />
                    <button type="button" onClick={() => setShowPasswords(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'rgba(99,102,241,0.5)' }}>
                      {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {f.hint && <p className="text-[11px] mt-1" style={{ color: 'rgba(99,102,241,0.4)' }}>{f.hint}</p>}
                </Field>
              ))}
              <button onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                {changingPassword ? <Loader2 size={16} className="animate-spin" /> : 'Change Password'}
              </button>
            </div>
          </div>

          {/* Session */}
          <div className="rounded-2xl p-6" style={CARD}>
            <h2 className="text-base font-bold text-white mb-4">Session Management</h2>
            <div className="p-3 rounded-xl flex items-center justify-between mb-4"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <div>
                <p className="text-sm font-semibold text-indigo-200">Current Session</p>
                <p className="text-xs" style={{ color: 'rgba(165,180,252,0.45)' }}>Expires in 7 days</p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>Active</span>
            </div>
            <button onClick={() => { logout(); window.location.href = '/'; }}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>

          {/* Delete confirm */}
          {deletePassword && (
            <div className="rounded-2xl p-6 animate-fade-in" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <h2 className="text-base font-bold text-red-300 mb-3 flex items-center gap-2"><AlertCircle size={18} /> Confirm Account Deletion</h2>
              <p className="text-sm mb-4" style={{ color: 'rgba(252,165,165,0.6)' }}>This is permanent and irreversible.</p>
              <div className="flex gap-2">
                <button onClick={handleDeleteAccount} disabled={deletingAccount}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                  style={{ background: '#dc2626' }}>
                  {deletingAccount ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Yes, Delete My Account</>}
                </button>
                <button onClick={() => setDeletePassword('')}
                  className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Tab */}
      {activeTab === 'admin' && user?.is_admin && (
        <div className="animate-fade-in">
          <div className="rounded-2xl p-6" style={CARD}>
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <SettingsIcon size={18} className="text-indigo-400" /> Admin Settings
            </h2>
            <div className="space-y-2">
              {[
                { href: '/admin', label: 'Control Center', desc: 'View system metrics and health' },
                { href: '#', label: 'User Management', desc: 'Manage users and permissions' },
                { href: '#', label: 'Model Configuration', desc: 'Configure LLM models and behavior' },
              ].map((item, i) => (
                <a key={i} href={item.href}
                  className="block px-4 py-3.5 rounded-xl transition-all"
                  style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}>
                  <p className="text-sm font-semibold text-indigo-200">{item.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(165,180,252,0.4)' }}>{item.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
        style={{ color: 'rgba(99,102,241,0.5)' }}>
        {icon}{label}
      </label>
      {children}
    </div>
  );
}
