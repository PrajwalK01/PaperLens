import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, ShieldCheck, X, Sparkles, Loader2, AlertCircle, RefreshCw, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { login, register, verifyOtp, resendOtp } from '../../api';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, initialTab = 'login', onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register' | 'otp'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
      setSuccess(null);
      setOtp('');
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, initialTab]);

  // Auto-focus OTP input when switching to otp tab
  useEffect(() => {
    if (tab === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [tab]);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      setSuccess('Signed in successfully!');
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === 'unverified') {
        setTab('otp');
        setResendTimer(60);
        setError('Account not verified. A new code has been sent to your email.');
      } else {
        setError(detail || err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password);
      setTab('otp');
      setResendTimer(60);
      setSuccess('Check your inbox! We sent a 6-digit code to ' + email.trim());
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
      setSuccess('Email verified! Signing you in…');
      setTimeout(() => { onSuccess(); onClose(); }, 900);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail?.includes('expired')) {
        setError('Code expired. Click "Resend Code" to get a new one.');
      } else {
        setError(detail || err.message || 'Invalid code. Please check and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await resendOtp(email.trim());
      setSuccess('New code sent! Check your inbox.');
      setResendTimer(60);
      setOtp('');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'Failed to resend. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const tabTitle: Record<string, string> = {
    login: 'Welcome back',
    register: 'Create account',
    otp: 'Verify your email',
  };
  const tabSub: Record<string, string> = {
    login: 'Sign in to your SPR account',
    register: 'Start reviewing papers with AI',
    otp: `Enter the 6-digit code sent to ${email}`,
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 0.18s ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden relative"
        style={{ animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {/* Decorative gradient header bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-all"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="px-7 pt-6 pb-5 border-b border-slate-50">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {tabTitle[tab]}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tabSub[tab]}
              </p>
            </div>
          </div>

          {/* Tab switcher (only for login/register) */}
          {tab !== 'otp' && (
            <div className="flex gap-1 mt-4 p-1 bg-slate-100 rounded-xl">
              {(['login', 'register'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                    tab === t
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-7 py-5 space-y-4">
          {/* Alerts */}
          {error && (
            <div
              className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs"
              style={{ animation: 'slideDown 0.2s ease-out' }}
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div
              className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-xs"
              style={{ animation: 'slideDown 0.2s ease-out' }}
            >
              <CheckCircle size={15} className="mt-0.5 shrink-0 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <InputField
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                icon={<Mail size={15} className="text-slate-400" />}
                required
              />
              <InputField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                icon={<Lock size={15} className="text-slate-400" />}
                suffix={
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                required
              />
              <SubmitButton loading={loading} label="Sign In" />
            </form>
          )}

          {/* ── REGISTER ── */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <InputField
                label="Email Address"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                icon={<Mail size={15} className="text-slate-400" />}
                required
              />
              <InputField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                icon={<Lock size={15} className="text-slate-400" />}
                suffix={
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                required
              />
              <InputField
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
                icon={<Lock size={15} className="text-slate-400" />}
                suffix={
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                    className="text-slate-400 hover:text-slate-600 transition-colors">
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                required
              />
              {/* Password strength hint */}
              {password.length > 0 && (
                <PasswordStrength password={password} />
              )}
              <SubmitButton loading={loading} label="Create Account" />
            </form>
          )}

          {/* ── OTP ── */}
          {tab === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {/* OTP visual display */}
              <div className="text-center space-y-3">
                <div className="w-14 h-14 bg-indigo-50 border-2 border-indigo-200 rounded-2xl flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-7 h-7 text-indigo-600" />
                </div>
                <p className="text-sm text-slate-600">
                  We sent a code to <span className="font-semibold text-slate-800">{email}</span>
                </p>
              </div>

              {/* OTP input — large digits */}
              <div className="relative">
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full py-4 border-2 border-slate-200 rounded-xl text-2xl font-mono font-bold
                    tracking-[14px] text-center focus:outline-none focus:border-indigo-500 focus:ring-4
                    focus:ring-indigo-500/10 transition-all text-slate-900 bg-slate-50"
                />
              </div>

              <SubmitButton loading={loading} label="Verify & Sign In" />

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
                  className="hover:text-slate-700 font-medium transition-colors"
                >
                  ← Back to Sign In
                </button>

                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={handleResendOtp}
                  className={`flex items-center gap-1.5 font-semibold transition-colors ${
                    resendTimer > 0
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-700'
                  }`}
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                </button>
              </div>

              {/* Dev hint — visible only in dev */}
              {import.meta.env.DEV && (
                <p className="text-[10px] text-slate-400 text-center bg-slate-50 rounded-lg py-2">
                  Dev mode: check <code className="font-mono">backend/last_otp.txt</code> or server console for OTP
                </p>
              )}
            </form>
          )}
        </div>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.92) translateY(8px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Reusable field ────────────────────────────────────────────────────────────
function InputField({ label, type, value, onChange, placeholder, icon, suffix, required }: {
  label: string; type: string; value: string; onChange: (v: string) => void;
  placeholder: string; icon: React.ReactNode; suffix?: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{label}</label>
      <div className="relative flex items-center">
        <span className="absolute left-3 pointer-events-none">{icon}</span>
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2.5 border border-slate-200 rounded-xl text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
            text-slate-800 bg-white placeholder:text-slate-400 transition-all"
        />
        {suffix && <span className="absolute right-3">{suffix}</span>}
      </div>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white
        rounded-xl font-semibold text-sm transition-all shadow-sm shadow-indigo-200
        flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : label}
    </button>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-red-400', 'bg-amber-400', 'bg-emerald-500'];
  const labels = ['Weak', 'Fair', 'Strong'];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            i < score ? colors[score - 1] : 'bg-slate-200'
          }`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {checks.map(c => (
            <span key={c.label} className={`text-[10px] font-medium transition-colors ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
              {c.ok ? '✓' : '·'} {c.label}
            </span>
          ))}
        </div>
        {score > 0 && <span className={`text-[10px] font-bold ${colors[score - 1].replace('bg-', 'text-').replace('-400', '-600').replace('-500', '-600')}`}>{labels[score - 1]}</span>}
      </div>
    </div>
  );
}
