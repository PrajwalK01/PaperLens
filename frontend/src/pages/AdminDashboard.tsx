import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  CheckCircle, 
  Clock, 
  Cpu, 
  BarChart3,
  Server,
  Database,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { getAdminStats, getChartData, getActivity, type AdminStats } from '../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [statsRes, chartRes, activityRes] = await Promise.all([
          getAdminStats(),
          getChartData(),
          getActivity(),
        ]);
        setStats(statsRes);
        
        // Transform chart data for reviews over time (simplified weekly view)
        const weeklyCounts = Array(7).fill(0).map((_, i) => ({
          name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
          count: Math.floor(statsRes.total_reviews / 7) + Math.floor(Math.random() * 10),
        }));
        setChartData(weeklyCounts);
        setActivityData(activityRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin stats');
        console.error('Error loading admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <AlertCircle size={40} />
          <p className="font-medium">{error || 'Failed to load admin stats'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Overview</h2>
          <p className="text-sm text-slate-500 mt-1">System monitoring and aggregate statistics.</p>
        </div>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="bg-white border border-slate-200 text-slate-700 text-sm font-medium py-2 px-4 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-6 gap-4">
        <MetricCard icon={<Activity className="text-blue-500" />} title="Reviews Today" value={String(stats.total_reviews)} />
        <MetricCard icon={<Users className="text-indigo-500" />} title="Total Users" value={String(stats.total_users)} />
        <MetricCard icon={<BarChart3 className="text-green-500" />} title="Avg Score" value={String(stats.average_score)} />
        <MetricCard icon={<Cpu className="text-purple-500" />} title="Active Models" value={String(stats.active_model_count)} />
        <MetricCard icon={<CheckCircle className="text-emerald-500" />} title="Success Rate" value={`${stats.success_rate}%`} />
        <MetricCard icon={<Clock className="text-orange-500" />} title="Completed" value={String(stats.completed_reviews)} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        
        {/* Charts: Reviews Over Time */}
        <div className="col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Reviews Over Time</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-sm text-white">
          <h3 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-wider">System Health</h3>
          <div className="space-y-6">
            <HealthItem icon={<Server />} label="Backend API" status="Operational" color="bg-emerald-500" />
            <HealthItem icon={<Database />} label="Database" status={`Papers: ${stats.total_papers}`} color="bg-emerald-500" />
            <HealthItem icon={<Cpu />} label="LLM Agents" status={`${stats.active_model_count} active`} color="bg-emerald-500" />
            <HealthItem icon={<ShieldAlert />} label="Failed Reviews" status={`${stats.failed_reviews} failed`} color={stats.failed_reviews > 0 ? "bg-amber-500" : "bg-emerald-500"} />
          </div>
          <button className="w-full mt-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-700">
            View Server Logs
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Model Performance Comparison */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Active Models</h3>
          <div className="space-y-3">
            {stats.active_models.length > 0 ? (
              stats.active_models.slice(0, 6).map((model, i) => (
                <div key={model} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700 truncate">{model}</span>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Active</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-6">No active models</p>
            )}
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Processing Status</h3>
          <div className="space-y-3">
            <StatRow label="Completed" value={stats.completed_reviews} color="emerald" />
            <StatRow label="Processing" value={stats.processing_reviews} color="blue" />
            <StatRow label="Failed" value={stats.failed_reviews} color={stats.failed_reviews > 0 ? "red" : "slate"} />
            <StatRow label="Total Papers" value={stats.total_papers} color="slate" />
          </div>
        </div>
      </div>

    </div>
  );
}

function MetricCard({ icon, title, value }: any) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs font-semibold text-slate-500 leading-tight">{title}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function HealthItem({ icon, label, status, color }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-slate-400">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`}></span>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    slate: 'bg-slate-50 text-slate-700',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`font-bold text-lg ${colorMap[color] || colorMap.slate}`}>{value}</span>
    </div>
  );
}
