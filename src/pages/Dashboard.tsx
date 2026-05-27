import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../firebase/firestore';
import { useAuthStore } from '../store/authStore';
import {
  TrendingUp, DollarSign, ShoppingBag, Package,
  AlertTriangle, Users, BarChart3, ArrowUpRight, Clock, RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuthStore();

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  const sampleChartData = [
    { name: 'Mon', sales: 4200, profit: 1200 },
    { name: 'Tue', sales: 5800, profit: 1800 },
    { name: 'Wed', sales: 3900, profit: 900 },
    { name: 'Thu', sales: 7100, profit: 2100 },
    { name: 'Fri', sales: 8500, profit: 2800 },
    { name: 'Sat', sales: 9200, profit: 3100 },
    { name: 'Sun', sales: 6300, profit: 2000 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats?.todaySales || 0),
      icon: ShoppingBag,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12.5%',
      up: true,
    },
    {
      title: "Today's Profit",
      value: formatCurrency(stats?.todayProfit || 0),
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-600',
      bg: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: '+8.2%',
      up: true,
    },
    {
      title: "Monthly Sales",
      value: formatCurrency(stats?.monthSales || 0),
      icon: BarChart3,
      color: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      trend: '+15.3%',
      up: true,
    },
    {
      title: "Monthly Profit",
      value: formatCurrency(stats?.monthProfit || 0),
      icon: DollarSign,
      color: 'from-indigo-500 to-indigo-600',
      bg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      trend: '+10.1%',
      up: true,
    },
    {
      title: "Total Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      trend: `${stats?.totalProducts || 0} items`,
      up: true,
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockCount || 0,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bg: 'bg-red-50',
      iconColor: 'text-red-600',
      trend: 'Need restock',
      up: false,
    },
    {
      title: "Total Customers",
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'from-teal-500 to-teal-600',
      bg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      trend: `${stats?.todayTransactions || 0} today`,
      up: true,
    },
    {
      title: "Monthly Transactions",
      value: stats?.monthTransactions || 0,
      icon: ShoppingBag,
      color: 'from-pink-500 to-pink-600',
      bg: 'bg-pink-50',
      iconColor: 'text-pink-600',
      trend: `${stats?.todayTransactions || 0} today`,
      up: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {userProfile?.displayName?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · Here's what's happening today
          </p>
        </div>
        <button
          onClick={loadStats}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 ${card.bg} rounded-xl`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${card.up ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {card.up ? <ArrowUpRight className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {card.trend}
              </span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Weekly Performance</h2>
              <p className="text-sm text-gray-400 mt-0.5">Sales & Profit this week</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sampleChartData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} fill="url(#colorSales)" name="Sales" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#colorProfit)" name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Low Stock Alert</h2>
            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-xs font-medium">
              {stats?.lowStockCount || 0} items
            </span>
          </div>
          {stats?.lowStockProducts?.length > 0 ? (
            <div className="space-y-3">
              {stats.lowStockProducts.map((product: any) => (
                <div key={product.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                  <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-red-500">{product.stock} left (min: {product.minStock})</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Package className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">All items well stocked!</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800">Recent Transactions</h2>
          <button onClick={() => window.location.href = '/invoices'} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View all
          </button>
        </div>
        {stats?.recentInvoices?.length > 0 ? (
          <div className="space-y-3">
            {stats.recentInvoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(inv.createdAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{formatCurrency(inv.total)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    inv.status === 'paid' ? 'bg-green-50 text-green-600' :
                    inv.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
