import React, { useState, useEffect } from 'react';
import { getVouchers, addVoucher, updateVoucher, deleteVoucher } from '../firebase/firestore';
import { Voucher } from '../store/posStore';
import { useForm } from 'react-hook-form';
import { Ticket, Plus, X, Edit2, Trash2, Save, Copy, CheckCircle, Clock, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

const Vouchers: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string>('');

  const { register, handleSubmit, reset, watch } = useForm<Omit<Voucher, 'id' | 'usedCount' | 'createdAt'>>();

  useEffect(() => { loadVouchers(); }, []);

  const loadVouchers = async () => {
    setLoading(true);
    try {
      const data = await getVouchers();
      setVouchers(data);
    } catch (error) { toast.error('Failed to load vouchers'); }
    finally { setLoading(false); }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    reset({
      code: voucher.code,
      type: voucher.type,
      value: voucher.value,
      minPurchase: voucher.minPurchase,
      maxUses: voucher.maxUses,
      expiryDate: voucher.expiryDate,
      isActive: voucher.isActive,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const voucherData = {
        ...data,
        value: Number(data.value),
        minPurchase: Number(data.minPurchase),
        maxUses: Number(data.maxUses),
        code: data.code.toUpperCase(),
      };
      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, voucherData);
        toast.success('Voucher updated!');
      } else {
        await addVoucher({ ...voucherData, usedCount: 0, createdAt: new Date().toISOString() });
        toast.success('Voucher created!');
      }
      setShowForm(false);
      setEditingVoucher(null);
      reset();
      loadVouchers();
    } catch (error) { toast.error('Failed to save voucher'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voucher?')) return;
    try {
      await deleteVoucher(id);
      toast.success('Voucher deleted');
      loadVouchers();
    } catch { toast.error('Failed to delete'); }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
    toast.success('Code copied!');
  };

  const toggleActive = async (voucher: Voucher) => {
    try {
      await updateVoucher(voucher.id, { isActive: !voucher.isActive });
      toast.success(`Voucher ${voucher.isActive ? 'deactivated' : 'activated'}!`);
      loadVouchers();
    } catch { toast.error('Failed to update'); }
  };

  const getVoucherStatus = (voucher: Voucher) => {
    if (!voucher.isActive) return { label: 'Inactive', color: 'bg-gray-100 text-gray-500' };
    if (isPast(new Date(voucher.expiryDate))) return { label: 'Expired', color: 'bg-red-50 text-red-500' };
    if (voucher.usedCount >= voucher.maxUses) return { label: 'Exhausted', color: 'bg-orange-50 text-orange-500' };
    return { label: 'Active', color: 'bg-green-50 text-green-600' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vouchers</h1>
          <p className="text-gray-500 text-sm mt-1">{vouchers.length} total vouchers</p>
        </div>
        <button
          onClick={() => {
            setEditingVoucher(null);
            reset({ code: generateCode(), isActive: true, minPurchase: 0, maxUses: 100 } as any);
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" /> Create Voucher
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: vouchers.length, color: 'bg-indigo-50 text-indigo-600', icon: Ticket },
          { label: 'Active', value: vouchers.filter(v => v.isActive && !isPast(new Date(v.expiryDate))).length, color: 'bg-green-50 text-green-600', icon: CheckCircle },
          { label: 'Expired', value: vouchers.filter(v => isPast(new Date(v.expiryDate))).length, color: 'bg-red-50 text-red-500', icon: Clock },
          { label: 'Used Today', value: 0, color: 'bg-orange-50 text-orange-500', icon: Tag },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center mb-2`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Vouchers Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center text-gray-400">
          <Ticket className="w-12 h-12 mb-3 opacity-30" />
          <p>No vouchers created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vouchers.map(voucher => {
            const status = getVoucherStatus(voucher);
            const usagePercent = Math.min(100, (voucher.usedCount / voucher.maxUses) * 100);
            return (
              <div key={voucher.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Voucher Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/10 rounded-full"></div>
                  <div className="absolute -right-2 top-6 w-12 h-12 bg-white/10 rounded-full"></div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(voucher)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                        <Edit2 className="w-3.5 h-3.5 text-white" />
                      </button>
                      <button onClick={() => handleDelete(voucher.id)} className="p-1.5 bg-white/20 rounded-lg hover:bg-red-500/50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-white/70 text-xs mb-1">
                        {voucher.type === 'percentage' ? 'Percentage Discount' : 'Fixed Discount'}
                      </p>
                      <p className="text-3xl font-bold text-white">
                        {voucher.type === 'percentage' ? `${voucher.value}%` : `Rs. ${voucher.value.toLocaleString()}`}
                      </p>
                    </div>
                    <Ticket className="w-8 h-8 text-white/30" />
                  </div>
                </div>

                {/* Voucher Body */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-gray-800 tracking-wider">{voucher.code}</span>
                      <button onClick={() => handleCopy(voucher.code)} className="p-1 hover:bg-gray-100 rounded">
                        {copied === voucher.code ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    </div>
                    <button onClick={() => toggleActive(voucher)} className={`relative w-10 h-5 rounded-full transition-colors ${voucher.isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${voucher.isActive ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
                    <div><span className="text-gray-400">Min. Purchase:</span> Rs. {voucher.minPurchase.toLocaleString()}</div>
                    <div><span className="text-gray-400">Expires:</span> {format(new Date(voucher.expiryDate), 'MMM d, yyyy')}</div>
                  </div>

                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>Usage: {voucher.usedCount}/{voucher.maxUses}</span>
                    <span>{Math.round(usagePercent)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${usagePercent}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Voucher Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">{editingVoucher ? 'Edit Voucher' : 'Create Voucher'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Voucher Code *</label>
                <div className="flex gap-2">
                  <input {...register('code', { required: true })} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono uppercase" />
                  <button type="button" onClick={() => reset({ ...watch(), code: generateCode() })} className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 hover:border-indigo-300 transition-colors">
                    Generate
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type *</label>
                  <select {...register('type', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rs.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Value *</label>
                  <input type="number" step="0.01" {...register('value', { required: true, min: 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Min. Purchase (Rs.)</label>
                  <input type="number" {...register('minPurchase')} defaultValue={0} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Uses</label>
                  <input type="number" {...register('maxUses', { required: true, min: 1 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiry Date *</label>
                <input type="date" {...register('expiryDate', { required: true })} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" {...register('isActive')} className="rounded text-indigo-600" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;
