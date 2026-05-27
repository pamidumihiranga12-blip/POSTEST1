import React, { useState, useEffect } from 'react';
import { getInvoices, getProducts, getCustomers } from '../firebase/firestore';
import { Invoice, Product } from '../store/posStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { BarChart3, TrendingUp, Download, DollarSign, ShoppingBag, Users, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#10b981', '#34d399', '#f59e0b', '#ef4444'];

const Reports: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, prods, custs] = await Promise.all([getInvoices(500), getProducts(), getCustomers()]);
      setInvoices(invs);
      setProducts(prods);
      setCustomers(custs);
    } catch (error) { toast.error('Failed to load report data'); }
    finally { setLoading(false); }
  };

  const paidInvoices = invoices.filter(inv => inv.status === 'paid');

  // Daily sales for last 30 days
  const last30Days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
  const dailySalesData = last30Days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayInvoices = paidInvoices.filter(inv => inv.createdAt.startsWith(dateStr));
    const sales = dayInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const cost = dayInvoices.reduce((sum, inv) =>
      sum + inv.items.reduce((c, item) => c + (item.product.costPrice || 0) * item.quantity, 0), 0);
    return { date: format(day, 'MMM d'), sales, profit: sales - cost, transactions: dayInvoices.length };
  });

  // Payment method breakdown
  const paymentData = ['cash', 'card', 'mobile'].map(method => ({
    name: method.charAt(0).toUpperCase() + method.slice(1),
    value: paidInvoices.filter(inv => inv.paymentMethod === method).length,
    amount: paidInvoices.filter(inv => inv.paymentMethod === method).reduce((s, i) => s + i.total, 0),
  }));

  // Top products by revenue
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  paidInvoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!productSales[item.product.id]) {
        productSales[item.product.id] = { name: item.product.name, qty: 0, revenue: 0 };
      }
      productSales[item.product.id].qty += item.quantity;
      productSales[item.product.id].revenue += item.total;
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // Monthly comparison
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();
    const monthInvoices = paidInvoices.filter(inv => inv.createdAt >= start && inv.createdAt <= end);
    return {
      month: format(date, 'MMM'),
      sales: monthInvoices.reduce((s, i) => s + i.total, 0),
      transactions: monthInvoices.length,
    };
  });

  const totalSales = paidInvoices.reduce((s, i) => s + i.total, 0);
  const totalProfit = paidInvoices.reduce((sum, inv) => {
    const cost = inv.items.reduce((c, item) => c + (item.product.costPrice || 0) * item.quantity, 0);
    return sum + (inv.total - cost);
  }, 0);
  const avgOrderValue = paidInvoices.length ? totalSales / paidInvoices.length : 0;
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-gray-500">Generating reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Business performance overview</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Revenue', value: `Rs. ${totalSales.toLocaleString()}`, icon: DollarSign, color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50', tc: 'text-indigo-600' },
          { title: 'Total Profit', value: `Rs. ${totalProfit.toLocaleString()}`, icon: TrendingUp, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50', tc: 'text-green-600' },
          { title: 'Total Orders', value: paidInvoices.length.toString(), icon: ShoppingBag, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', tc: 'text-violet-600' },
          { title: 'Avg. Order Value', value: `Rs. ${Math.round(avgOrderValue).toLocaleString()}`, icon: BarChart3, color: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', tc: 'text-orange-600' },
          { title: 'Total Customers', value: customers.length.toString(), icon: Users, color: 'from-teal-500 to-teal-600', bg: 'bg-teal-50', tc: 'text-teal-600' },
          { title: 'Total Products', value: products.length.toString(), icon: Package, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', tc: 'text-blue-600' },
          { title: 'Low Stock Items', value: lowStockCount.toString(), icon: Package, color: 'from-red-500 to-red-600', bg: 'bg-red-50', tc: 'text-red-600' },
          { title: 'Profit Margin', value: totalSales ? `${Math.round((totalProfit / totalSales) * 100)}%` : '0%', icon: TrendingUp, color: 'from-pink-500 to-pink-600', bg: 'bg-pink-50', tc: 'text-pink-600' },
        ].map(card => (
          <div key={card.title} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className={`p-2.5 ${card.bg} rounded-xl w-fit mb-3`}>
              <card.icon className={`w-5 h-5 ${card.tc}`} />
            </div>
            <p className="text-xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Daily Sales Chart */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Daily Sales (Last 30 Days)</h2>
            <p className="text-sm text-gray-400 mt-0.5">Sales and profit trend</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={dailySalesData}>
            <defs>
              <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} fill="url(#gradSales)" name="Sales (Rs.)" />
            <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fill="url(#gradProfit)" name="Profit (Rs.)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Comparison */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Monthly Sales Comparison</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="sales" fill="#6366f1" radius={[6, 6, 0, 0]} name="Sales (Rs.)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Payment Methods</h2>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {paymentData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {paymentData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{item.value} orders</p>
                    <p className="text-xs text-gray-400">Rs. {item.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-6">Top Products by Revenue</h2>
        {topProducts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sales data yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topProducts.map((product, i) => {
              const maxRevenue = topProducts[0].revenue;
              const percent = (product.revenue / maxRevenue) * 100;
              return (
                <div key={product.name} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-gray-400 w-6 text-center">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">{product.name}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-indigo-600">Rs. {product.revenue.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-2">{product.qty} sold</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${percent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
