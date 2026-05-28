import React, { useState, useEffect } from 'react';
import { getWarrantyClaims, addWarrantyClaim, updateWarrantyClaim, getProductByBarcode, generateClaimNumber } from '../firebase/firestore';
import { WarrantyClaim } from '../store/posStore';
import BarcodeScanner from '../components/BarcodeScanner';
import { useForm } from 'react-hook-form';
import { Shield, Plus, Barcode, Search, X, CheckCircle, Clock, AlertCircle, XCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

type ClaimStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-50 text-yellow-600', icon: Clock },
  processing: { label: 'Processing', color: 'bg-blue-50 text-blue-600', icon: AlertCircle },
  resolved: { label: 'Resolved', color: 'bg-green-50 text-green-600', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-600', icon: XCircle },
};

const Warranty: React.FC = () => {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClaim, setEditingClaim] = useState<WarrantyClaim | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<Omit<WarrantyClaim, 'id' | 'claimNumber' | 'createdAt' | 'status'>>();

  useEffect(() => { loadClaims(); }, []);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const data = await getWarrantyClaims();
      setClaims(data);
    } catch (error) { toast.error('Failed to load claims'); }
    finally { setLoading(false); }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    const clean = barcode.replace(/[\r\n\t]/g, '').replace(/^[^0-9]*/,'').replace(/[^0-9]*$/,'').trim();
    if (!clean) return;
    setShowScanner(false);
    try {
      const product = await getProductByBarcode(clean);
      if (product) {
        setValue('barcode', clean);
        setValue('productName', product.name);
        setValue('productId', product.id);
        toast.success(`Product found: ${product.name}`);
      } else {
        setValue('barcode', clean);
        toast('Barcode set. Product not found in system.');
      }
    } catch (error) {
      setValue('barcode', clean);
    }
  };

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      if (editingClaim) {
        await updateWarrantyClaim(editingClaim.id, { ...data, status: editingClaim.status });
        toast.success('Claim updated!');
      } else {
        await addWarrantyClaim({
          ...data,
          claimNumber: generateClaimNumber(),
          status: 'pending',
          claimDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        toast.success('Warranty claim submitted!');
      }
      setShowForm(false);
      setEditingClaim(null);
      reset();
      loadClaims();
    } catch (error) { toast.error('Failed to save claim'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: ClaimStatus, resolution?: string) => {
    try {
      await updateWarrantyClaim(id, { status, ...(resolution && { resolution }) });
      toast.success('Status updated!');
      loadClaims();
    } catch (error) { toast.error('Failed to update status'); }
  };

  const filtered = claims.filter(c => {
    const matchSearch = c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claimNumber.includes(searchQuery) || c.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.barcode.includes(searchQuery);
    const matchStatus = !filterStatus || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Warranty Claims</h1>
          <p className="text-gray-500 text-sm mt-1">{claims.length} total claims</p>
        </div>
        <button
          onClick={() => { setEditingClaim(null); reset(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" /> New Claim
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = claims.filter(c => c.status === status).length;
          const Icon = config.icon;
          return (
            <div key={status} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${config.color.split(' ')[1]}`} />
                <span className="text-sm font-medium text-gray-600">{config.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Search claims..." />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600">
          <option value="">All Status</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl p-16 flex flex-col items-center text-gray-400 border border-gray-100">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
            <p className="text-sm">Loading claims...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 flex flex-col items-center text-gray-400 border border-gray-100">
            <Shield className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No warranty claims found</p>
          </div>
        ) : filtered.map(claim => {
          const config = statusConfig[claim.status];
          const Icon = config.icon;
          return (
            <div key={claim.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-800">{claim.claimNumber}</h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                      <Icon className="w-3 h-3" /> {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Customer: <span className="text-gray-700 font-medium">{claim.customerName}</span> · {claim.customerPhone}</p>
                </div>
                <p className="text-xs text-gray-400">{format(new Date(claim.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div><p className="text-gray-400 text-xs">Product</p><p className="font-medium text-gray-700">{claim.productName}</p></div>
                <div><p className="text-gray-400 text-xs">Barcode</p><p className="font-mono text-gray-700">{claim.barcode}</p></div>
                <div><p className="text-gray-400 text-xs">Invoice</p><p className="text-gray-700">{claim.invoiceNumber}</p></div>
                <div><p className="text-gray-400 text-xs">Purchase Date</p><p className="text-gray-700">{claim.purchaseDate ? format(new Date(claim.purchaseDate), 'MMM d, yyyy') : '-'}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-400 mb-1">Issue Description</p>
                <p className="text-sm text-gray-700">{claim.issue}</p>
              </div>
              {claim.resolution && (
                <div className="bg-green-50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-green-600 mb-1">Resolution</p>
                  <p className="text-sm text-green-700">{claim.resolution}</p>
                </div>
              )}
              <div className="flex gap-2">
                {claim.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(claim.id, 'processing')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">Mark Processing</button>
                    <button onClick={() => updateStatus(claim.id, 'rejected')} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">Reject</button>
                  </>
                )}
                {claim.status === 'processing' && (
                  <button
                    onClick={() => {
                      const resolution = prompt('Enter resolution details:');
                      if (resolution) updateStatus(claim.id, 'resolved', resolution);
                    }}
                    className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Claim Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">New Warranty Claim</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Name *</label>
                  <input {...register('customerName', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
                  <input {...register('customerPhone', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Barcode *</label>
                  {showScanner && (
                    <div className="mb-2">
                      <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} inline />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input {...register('barcode', { required: true })} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <button type="button" onClick={() => setShowScanner(true)} className="px-3 py-2.5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors">
                      <Barcode className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name *</label>
                  <input {...register('productName', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice Number *</label>
                  <input {...register('invoiceNumber', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="SZ-XXXXXX-XXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Date *</label>
                  <input type="date" {...register('purchaseDate', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Issue Description *</label>
                  <textarea {...register('issue', { required: true })} rows={4} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" placeholder="Describe the issue..." />
                </div>
                <input type="hidden" {...register('productId')} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Warranty;
