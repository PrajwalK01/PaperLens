import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, ShieldCheck, X, Sparkles, Loader2, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
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
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Timer for resending OTP
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
      setSuccess(null);
      setOtp('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      setSuccess('Signed in successfully!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail === 'unverified') {
        // User needs verification - switch to OTP tab!
        setTab('otp');
        setResendTimer(60);
        setError('Your account is not verified. A verification code has been sent to your email.');
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

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password);
      // Success triggers switching to OTP input
      setTab('otp');
      setResendTimer(60);
      setSuccess('Registration successful! Please verify the OTP sent to your email.');
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
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
      setSuccess('Account verified and signed in!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'OTP verification failed. Please check the code.');
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
      setSuccess('A new verification code has been sent to your email.');
      setResendTimer(60);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(detail || err.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-all"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-4 text-center border-b border-slate-50">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            {tab === 'login' && 'Welcome Back'}
            {tab === 'register' && 'Create Account'}
            {tab === 'otp' && 'Verify Your Email'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {tab === 'login' && 'Sign in to access your PaperLens dashboard'}
            {tab === 'register' && 'Sign up to start reviewing and saving papers'}
            {tab === 'otp' && `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-xs">
              <CheckCircle size={15} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Login Mode */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Don't have an account?{' '}
                <button type="button" onClick={() => { setTab('register'); setError(null); setSuccess(null); }} className="text-indigo-600 hover:underline font-semibold">
                  Sign up
                </button>
              </p>
            </form>
          )}

          {/* Register Mode */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password (min 8 chars, uppercase & digit)</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign Up'}
              </button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Already have an account?{' '}
                <button type="button" onClick={() => { setTab('login'); setError(null); setSuccess(null); }} className="text-indigo-600 hover:underline font-semibold">
                  Sign in
                </button>
              </p>
            </form>
          )}

          {/* OTP Verification Mode */}
          {tab === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block text-center">Verification Code</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-lg font-mono font-bold tracking-[8px] text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify & Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 mt-4">
                <button
                  type="button"
                  onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
                  className="hover:text-slate-800 hover:underline font-semibold"
                >
                  Back to Sign In
                </button>

                <button
                  type="button"
                  disabled={resendTimer > 0 || loading}
                  onClick={handleResendOtp}
                  className={`flex items-center gap-1.5 font-semibold ${
                    resendTimer > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-indigo-600 hover:underline hover:text-indigo-700'
                  }`}
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
