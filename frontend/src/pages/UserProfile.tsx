import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  LogOut,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
  ArrowLeft,
  Eye,
  EyeOff,
  Users,
  Settings as SettingsIcon,
} from 'lucide-react';
import { getMe, logout, updateProfileEmail, changePassword, deleteAccount } from '../api';
import { useAuth } from '../components/ui/Layout';

export default function UserProfile() {
  const { user: authUser, openAuth } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'admin'>('profile');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Loading states
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    const loadUser = async () => {
      try {
        const userData = await getMe();
        setUser(userData);
        setEditEmail(userData.email);
      } catch (err) {
        setMessage({ type: 'error', text: 'Failed to load user data' });
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, [authUser]);

  const handleUpdateEmail = async () => {
    if (!editEmail.includes('@')) {
      setMessage({ type: 'error', text: 'Invalid email format' });
      return;
    }
    
    setUpdatingProfile(true);
    try {
      await updateProfileEmail(editEmail);
      setUser({ ...user, email: editEmail });
      setMessage({ type: 'success', text: 'Email updated successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to update email' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password changed successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to change password' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setMessage({ type: 'error', text: 'Please enter your password' });
      return;
    }

    setDeletingAccount(true);
    try {
      await deleteAccount(deletePassword);
      logout();
      window.location.href = '/';
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to delete account' });
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <User className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Sign in to view your profile</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          Log in to update your email, password, or manage your account settings.
        </p>
        <button onClick={() => openAuth('login')}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
            px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm">
          Sign In / Sign Up
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft size={20} className="text-slate-600" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Account Settings</h1>
            <p className="text-sm text-slate-500">Manage your profile and preferences</p>
          </div>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">{message.text}</p>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="ml-auto text-sm font-medium underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-0 border-b border-slate-200 mb-6">
          {(['profile', 'security'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              {tab === 'profile' ? (
                <span className="flex items-center gap-2">
                  <User size={18} />
                  Profile
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock size={18} />
                  Security
                </span>
              )}
            </button>
          ))}
          {user?.is_admin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'admin'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <SettingsIcon size={18} />
                Admin
              </span>
            </button>
          )}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Account Info */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Account Information</h2>
              
              <div className="space-y-4">
                {/* Username (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <span className="flex items-center gap-2">
                      <User size={16} />
                      Username
                    </span>
                  </label>
                  <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                    {user?.username}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Username cannot be changed</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Mail size={16} />
                      Email Address
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="your@email.com"
                    />
                    <button
                      onClick={handleUpdateEmail}
                      disabled={updatingProfile || editEmail === user?.email}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {updatingProfile ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        'Update'
                      )}
                    </button>
                  </div>
                </div>

                {/* Member Since */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Member Since</label>
                  <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                    {new Date(user?.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                {/* Admin Badge */}
                {user?.is_admin && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                    <SettingsIcon size={18} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-900">Administrator Account</span>
                  </div>
                )}
              </div>
            </div>

            {/* Delete Account Section */}
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
                <AlertCircle size={20} />
                Danger Zone
              </h2>
              <p className="text-sm text-red-800 mb-4">
                Permanently delete your account. This action cannot be undone.
              </p>
              <button
                onClick={() => {
                  // Show delete confirmation dialog
                  const confirmed = window.confirm(
                    'Are you absolutely sure? This will permanently delete your account and all associated data.'
                  );
                  if (confirmed) {
                    // Show password prompt
                    const password = prompt('Enter your password to confirm account deletion:');
                    if (password) {
                      setDeletePassword(password);
                      setActiveTab('security');
                      setTimeout(() => {
                        document.getElementById('delete-account-btn')?.scrollIntoView();
                      }, 100);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} />
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Change Password */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Lock size={20} />
                Change Password
              </h2>

              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="••••••••"
                    />
                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-slate-500 mt-1">Min 8 chars, uppercase & digit required</p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {/* Update Button */}
                <button
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
                  className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {changingPassword ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Session Management</h2>
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">Current Session</p>
                    <p className="text-xs text-slate-500">Expires in 7 days</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Active</span>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  window.location.href = '/';
                }}
                className="mt-4 w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>

            {/* Delete Account */}
            {deletePassword && (
              <div id="delete-account-btn" className="bg-red-50 border border-red-200 p-6 rounded-2xl">
                <h2 className="text-lg font-bold text-red-900 mb-4 flex items-center gap-2">
                  <AlertCircle size={20} />
                  Confirm Account Deletion
                </h2>
                <p className="text-sm text-red-800 mb-4">
                  Are you absolutely certain? Deleting your account is permanent and irreversible.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deletingAccount}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingAccount ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Yes, Delete My Account
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDeletePassword('')}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Tab */}
        {activeTab === 'admin' && user?.is_admin && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 p-6 rounded-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <SettingsIcon size={20} />
                Admin Settings
              </h2>
              <p className="text-slate-600 mb-4">Advanced system configuration and management tools.</p>
              
              <div className="space-y-3">
                <a href="/admin" className="block p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                  <p className="font-medium text-slate-700">System Dashboard</p>
                  <p className="text-xs text-slate-500">View system metrics and health</p>
                </a>
                
                <a href="#" className="block p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                  <p className="font-medium text-slate-700">User Management</p>
                  <p className="text-xs text-slate-500">Manage users and permissions</p>
                </a>
                
                <a href="#" className="block p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                  <p className="font-medium text-slate-700">Model Configuration</p>
                  <p className="text-xs text-slate-500">Configure LLM models and behavior</p>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
