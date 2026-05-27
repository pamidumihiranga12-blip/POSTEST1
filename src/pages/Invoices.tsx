import React, { useState, useEffect } from 'react';
import { getInvoices, deleteInvoice } from '../firebase/firestore';
import { Invoice } from '../store/posStore';
import { FileText, Search, Eye, Printer, X, Calendar, CreditCard, Banknote, Smartphone, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const paymentIcons: Record<string, React.FC<{ className?: string }>> = {
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
};

const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  useEffect(() => { loadInvoices(); }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await getInvoices(200);
      setInvoices(data);
    } catch (error) { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  };

  const handleDeleteInvoice = async (id: string, invoiceNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This will revert product stock and customer loyalty points.`)) {
      return;
    }
    try {
      await deleteInvoice(id);
      toast.success(`Invoice ${invoiceNumber} deleted successfully`);
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }
      loadInvoices();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete invoice');
    }
  };

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !filterStatus || inv.status === filterStatus;
    const matchPayment = !filterPayment || inv.paymentMethod === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  const totalRevenue = filtered.reduce((sum, inv) => inv.status === 'paid' ? sum + inv.total : sum, 0);

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} invoices · Rs. {totalRevenue.toLocaleString()} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Search invoices..." />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600">
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600">
          <option value="">All Payment</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mobile">Mobile</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice #</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <div className="flex flex-col items-center text-gray-400 gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-sm">Loading invoices...</p>
                </div>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <div className="flex flex-col items-center text-gray-400 gap-2">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No invoices found</p>
                </div>
              </td></tr>
            ) : filtered.map(inv => {
              const PayIcon = paymentIcons[inv.paymentMethod] || CreditCard;
              return (
                <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-sm font-medium text-indigo-600">{inv.invoiceNumber}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{inv.customerName}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(inv.createdAt), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600 px-2 py-0.5 bg-gray-50 rounded-full">
                      <PayIcon className="w-3 h-3" />
                      {inv.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-800 text-sm">Rs. {inv.total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'paid' ? 'bg-green-50 text-green-600' :
                      inv.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-500'
                    }`}>{inv.status}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setSelectedInvoice(inv)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete Invoice">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{selectedInvoice.invoiceNumber}</h2>
                <p className="text-sm text-gray-400">{format(new Date(selectedInvoice.createdAt), 'MMMM d, yyyy h:mm a')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDeleteInvoice(selectedInvoice.id, selectedInvoice.invoiceNumber)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium transition-colors" title="Delete Invoice">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm transition-colors">
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Customer</p>
                  <p className="font-medium text-gray-800">{selectedInvoice.customerName}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Payment Method</p>
                  <p className="font-medium text-gray-800 capitalize">{selectedInvoice.paymentMethod}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-600' :
                    selectedInvoice.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-500'
                  }`}>{selectedInvoice.status}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Served By</p>
                  <p className="font-medium text-gray-800">{selectedInvoice.createdBy}</p>
                </div>
              </div>

              {/* Items */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Items</h3>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{item.product.name}</p>
                        <p className="text-xs text-gray-400">Rs. {item.product.price.toLocaleString()} × {item.quantity}
                          {item.discount > 0 && ` (${item.discount}% off)`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">Rs. {item.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>Rs. {selectedInvoice.subtotal.toLocaleString()}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-Rs. {selectedInvoice.discount.toLocaleString()}</span>
                  </div>
                )}
                {selectedInvoice.tax > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Tax</span>
                    <span>Rs. {selectedInvoice.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-200 pt-2 mt-2">
                  <span>Total</span>
                  <span className="text-indigo-600">Rs. {selectedInvoice.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
