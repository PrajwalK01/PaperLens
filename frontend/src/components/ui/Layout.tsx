import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Outlet, useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import {
  Settings, ChevronDown,
  FileText, BookOpen, Bot, CheckCircle, AlertCircle, Clock,
  Loader2, LogOut, User, Home, History, LayoutDashboard,
  ShieldCheck, X, Send, Sparkles,
  MessageSquare, Trash2,
} from 'lucide-react';
import { getActivity, getToken, logout, getMe, streamChat, type ChatMsg, type ActivityGroup } from '../../api';
import AuthModal from './AuthModal';

// ── Contexts ──────────────────────────────────────────────────────────────────
export const AuthContext = createContext<{
  user: any;
  refresh: () => void;
  openAuth: (tab?: 'login' | 'register') => void;
}>({
  user: null,
  refresh: () => {},
  openAuth: () => {}
});
export function useAuth() { return useContext(AuthContext); }

export default function Layout() {
  const [activityGroups, setActivityGroups] = useState<ActivityGroup[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();
  const location = useLocation();

  const openAuth = useCallback((tab: 'login' | 'register' = 'login') => {
    setAuthTab(tab);
    setAuthOpen(true);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      logout();
      return;
    }
    try {
      setUser(await getMe());
    } catch (err: any) {
      setUser(null);
      if (err?.response?.status === 401) {
        logout();
      }
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    if (!getToken()) {
      setLoadingActivity(false);
      setActivityGroups([]);
      return;
    }
    try {
      const { getActivity: ga } = await import('../../api');
      const data = await ga();
      setActivityGroups(data.groups);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        logout();
        setUser(null);
        setActivityGroups([]);
      }
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      if (getToken()) {
        await fetchActivity();
      }
    };
    init();

    const iv = setInterval(() => {
      if (getToken()) {
        fetchActivity();
      }
    }, 30_000);

    return () => clearInterval(iv);
  }, [fetchActivity, refreshUser]);

  useEffect(() => {
    if (getToken()) fetchActivity();
  }, [location.pathname, fetchActivity]);

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : '?';

  // Extract paper_id and job_id from route for chat context
  const jobIdMatch = location.pathname.match(/\/review\/([^/]+)/);
  const chatJobId = jobIdMatch?.[1] ?? null;

  return (
    <AuthContext.Provider value={{ user, refresh: refreshUser, openAuth }}>
        <div className="flex flex-col h-screen bg-[#f8fafc] font-sans overflow-hidden">

          {/* ── Top Nav ───────────────────────────────────────────────── */}
          <TopNav user={user} showUserMenu={showUserMenu}
            onToggleUserMenu={() => setShowUserMenu(v => !v)}
            onCloseUserMenu={() => setShowUserMenu(false)}
            onLogout={() => { logout(); setUser(null); setActivityGroups([]); navigate('/'); setShowUserMenu(false); }}
            initials={initials}
            chatOpen={chatOpen} onToggleChat={() => setChatOpen(v => !v)}
            onOpenAuth={() => openAuth('login')} />

          {/* ── 3-Column Workspace ─────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* LEFT: Activity + Nav */}
            <aside className="w-[240px] bg-[#161b33] flex flex-col shrink-0 text-slate-300 border-r border-[#252f55]">
              <div className="px-4 pt-4 pb-3 border-b border-[#252f55]">
                <h2 className="font-bold text-white text-sm">Activity History</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Your project timeline</p>
              </div>
              <nav className="px-2 py-2 border-b border-[#252f55] flex flex-col gap-0.5">
                <SideNavLink to="/" label="Home" icon={<Home size={14} />} current={location.pathname} />
                <SideNavLink to="/dashboard" label="Dashboard" icon={<LayoutDashboard size={14} />} current={location.pathname} />
                <SideNavLink to="/history" label="Review History" icon={<History size={14} />} current={location.pathname} />
                {user?.is_admin && <SideNavLink to="/admin" label="Admin" icon={<ShieldCheck size={14} />} current={location.pathname} />}
              </nav>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {!getToken() ? (
                  <EmptyState icon={<User size={20} className="text-slate-600" />} title="Not signed in" sub="Log in to see your activity timeline." />
                ) : loadingActivity ? (
                  <div className="flex justify-center py-10"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
                ) : activityGroups.length === 0 ? (
                  <EmptyState icon={<Clock size={20} className="text-slate-600" />} title="No activity yet" sub="Upload a paper to see your timeline." />
                ) : (
                  activityGroups.map((group, gi) => (
                    <TimelineGroup key={gi} date={group.date}>
                      {group.events.map((event, ei) => {
                        const isLast = ei === group.events.length - 1 && gi === activityGroups.length - 1;
                        const iconMap: Record<string, React.ReactNode> = {
                          file: <FileText size={11} />, bot: <Bot size={11} />,
                          check: <CheckCircle size={11} />, check_circle: <CheckCircle size={11} />,
                          alert: <AlertCircle size={11} />, book: <BookOpen size={11} />,
                        };
                        const colorMap: Record<string, string> = {
                          blue: 'bg-blue-500', indigo: 'bg-indigo-500', emerald: 'bg-emerald-500',
                          purple: 'bg-purple-500', amber: 'bg-amber-500', red: 'bg-red-500',
                        };
                        return (
                          <TimelineItem key={event.id}
                            time={new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            icon={iconMap[event.icon] || <CheckCircle size={11} />}
                            iconBg={colorMap[event.color] || 'bg-slate-500'}
                            title={event.title} subtitle={event.subtitle} user={event.user} isLast={isLast} />
                        );
                      })}
                    </TimelineGroup>
                  ))
                )}
              </div>
            </aside>

            {/* CENTER: Main content */}
            <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
              <div className="max-w-4xl mx-auto h-full p-6">
                <Outlet />
              </div>
            </main>

            {/* RIGHT: AI Chat Panel */}
            {chatOpen && (
              <AIChatPanel jobId={chatJobId} onClose={() => setChatOpen(false)} />
            )}
          </div>

          <AuthModal
            isOpen={authOpen}
            initialTab={authTab}
            onClose={() => setAuthOpen(false)}
            onSuccess={refreshUser}
          />

          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 3px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #2d3559; border-radius: 4px; }
          `}</style>
        </div>
    </AuthContext.Provider>
  );
}

// ── AI Chat Panel ─────────────────────────────────────────────────────────────
function AIChatPanel({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Greet on first load / when paper context changes
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: jobId
        ? "I can see the paper you're reviewing. Ask me anything — methodology, equations, related work, critique, or a plain-English summary."
        : "Hi! I'm your PaperLens research assistant. Upload or open a paper, then I can answer questions about it. Or ask me general research questions.",
    }]);
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: ChatMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setStreaming(true);
    setStreamText('');

    let accumulated = '';
    abortRef.current = streamChat(
      text, newHistory.slice(-10), null, jobId,
      (token) => { accumulated += token; setStreamText(accumulated); },
      () => {
        setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamText('');
        setStreaming(false);
        abortRef.current = null;
      },
      (err) => {
        // Translate raw network errors into helpful messages
        let msg = err;
        if (err.toLowerCase().includes('fetch') || err.toLowerCase().includes('network') || err.toLowerCase().includes('failed to fetch')) {
          msg = 'Cannot reach the backend. Make sure the server is running on port 8000.';
        } else if (err.includes('503') || err.toLowerCase().includes('no llm') || err.toLowerCase().includes('api key')) {
          msg = 'No LLM API key is configured. Add OPENAI_API_KEY or ANTHROPIC_API_KEY to backend/.env and restart the server.';
        }
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
        setStreamText('');
        setStreaming(false);
      },
    );
  };

  const stop = () => { abortRef.current?.abort(); setStreaming(false); setStreamText(''); };
  const clear = () => { setMessages([]); stop(); };

  const SUGGESTIONS = jobId
    ? ['Summarise this paper', 'Explain the methodology', 'What are the key weaknesses?', 'Find related work']
    : ['What makes a good paper?', 'Explain peer review', 'How does LangGraph work?'];

  return (
    <aside className="w-[320px] bg-white border-l border-slate-200 flex flex-col shrink-0 shadow-[-4px_0_20px_rgba(0,0,0,0.04)]">

      {/* Header */}
      <div className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Research Assistant</p>
            {jobId && <p className="text-[10px] text-indigo-500 font-medium">Paper context loaded</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clear} title="Clear chat"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Trash2 size={13} />
          </button>
          <button onClick={onClose} title="Close chat"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ scrollbarColor: '#e2e8f0 transparent' }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}

        {/* Streaming bubble */}
        {streaming && streamText && (
          <ChatBubble msg={{ role: 'assistant', content: streamText }} streaming />
        )}
        {streaming && !streamText && (
          <div className="flex gap-1 px-3 py-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}

        {/* Suggestions (only when no messages from user yet) */}
        {messages.filter(m => m.role === 'user').length === 0 && !streaming && (
          <div className="space-y-1.5 mt-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Try asking</p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => { setInput(s); }}
                className="w-full text-left text-xs text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700
                  border border-slate-200 hover:border-indigo-200 rounded-lg px-3 py-2 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-xl
          focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything about your research…"
            rows={2}
            className="flex-1 bg-transparent px-3 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400
              resize-none focus:outline-none leading-relaxed"
          />
          <div className="flex items-center gap-1 p-2">
            {streaming ? (
              <button onClick={stop}
                className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                <div className="w-3 h-3 bg-red-600 rounded-sm" />
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  input.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}>
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          {jobId ? '📄 Answering about current paper' : 'General research mode'} · Enter to send
        </p>
      </div>
    </aside>
  );
}

function ChatBubble({ msg, streaming = false }: { msg: ChatMsg; streaming?: boolean }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={12} className="text-indigo-600" />
      </div>
      <div className={`max-w-[88%] bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5
        text-[13px] text-slate-700 leading-relaxed shadow-sm ${streaming ? 'border-indigo-100' : ''}`}>
        {msg.content}
        {streaming && <span className="inline-block w-1 h-3.5 bg-indigo-500 ml-0.5 animate-pulse rounded-sm" />}
      </div>
    </div>
  );
}

// ── Top Navigation ────────────────────────────────────────────────────────────
function TopNav({ user, showUserMenu, onToggleUserMenu,
  onCloseUserMenu, onLogout, initials, chatOpen, onToggleChat, onOpenAuth }: any) {
  const navigate = useNavigate();
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0 z-10">
      <div className="flex items-center gap-5">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white text-lg shadow-sm select-none">
            P<span className="text-indigo-300">L</span>
          </div>
          <span className="font-bold text-slate-800 text-lg tracking-tight">PaperLens</span>
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
        <Link to="/profile" className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Settings">
          <Settings size={17} />
        </Link>

        {/* Chat toggle button */}
        <button onClick={onToggleChat}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${chatOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          title="AI Research Assistant">
          <MessageSquare size={17} />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* User menu / Sign in */}
        {user ? (
          <div className="relative">
            <button onClick={onToggleUserMenu} className="flex items-center gap-1.5 hover:bg-slate-50 p-1 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs select-none">
                {initials}
              </div>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-sm font-bold text-slate-800">{user.username}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  {user.is_admin && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded mt-1 inline-block">Admin</span>}
                </div>
                <Link to="/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={onCloseUserMenu}>
                  <User size={14} /> Profile & Settings
                </Link>
                {user.is_admin && (
                  <Link to="/admin" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors" onClick={onCloseUserMenu}>
                    <ShieldCheck size={14} /> Admin Dashboard
                  </Link>
                )}
                <div className="border-t border-slate-100" />
                <button onClick={onLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={onOpenAuth}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-semibold text-sm transition-colors shadow-sm">
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}

// ── Sidebar nav link ──────────────────────────────────────────────────────────
function SideNavLink({ to, label, icon, current }: { to: string; label: string; icon: React.ReactNode; current: string }) {
  const active = current === to || (to !== '/' && current.startsWith(to));
  return (
    <Link to={to} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors
      ${active ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
      {icon}{label}
    </Link>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-2">
      <div className="mb-2">{icon}</div>
      <p className="text-[11px] font-semibold text-slate-400">{title}</p>
      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{sub}</p>
    </div>
  );
}
function TimelineGroup({ date, children }: { date: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">{date}</p>
      <div className="relative">{children}</div>
    </div>
  );
}
function TimelineItem({ time, icon, iconBg, title, subtitle, user, isLast }: any) {
  return (
    <div className="relative pl-6 pb-4">
      {!isLast && <div className="absolute left-[10px] top-5 bottom-0 w-px bg-[#2d3559]" />}
      <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-[#1b213b] border border-[#2d3559] flex items-center justify-center z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      </div>
      <div className="bg-[#1b213b] border border-[#2d3559] rounded-lg p-2 hover:bg-[#202642] transition-colors">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-md ${iconBg} text-white flex items-center justify-center flex-shrink-0`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-200 truncate">{title}</p>
              <span className="text-[9px] text-slate-500 ml-1 shrink-0">{time}</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
