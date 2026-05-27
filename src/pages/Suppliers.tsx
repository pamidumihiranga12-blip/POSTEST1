import React, { useState, useEffect } from 'react';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier, adjustSupplierBalance } from '../firebase/firestore';
import { Supplier } from '../store/posStore';
import { useForm } from 'react-hook-form';
import { Truck, Plus, Search, Edit2, Trash2, X, Save, Mail, Phone, MapPin, DollarSign, Building, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState<Supplier | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settling, setSettling] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterOutstandingOnly, setFilterOutstandingOnly] = useState(false);

  const { register, handleSubmit, reset } = useForm<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>();

  useEffect(() => { loadSuppliers(); }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (error) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    reset({
      name: supplier.name,
      company: supplier.company || '',
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      balance: supplier.balance
    });
    setShowForm(true);
  };

  const onSubmit = async (data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true);
    try {
      const formattedData = {
        ...data,
        balance: Number(data.balance || 0)
      };

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, formattedData);
        toast.success('Supplier updated!');
      } else {
        await addSupplier(formattedData);
        toast.success('Supplier added!');
      }
      setShowForm(false);
      setEditingSupplier(null);
      reset();
      loadSuppliers();
    } catch (error) {
      toast.error('Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"?`)) return;
    try {
      await deleteSupplier(id);
      toast.success('Supplier deleted');
      loadSuppliers();
    } catch {
      toast.error('Failed to delete supplier');
    }
  };

  const handleSettlePayment = async () => {
    if (!showSettleModal) return;
    if (settleAmount <= 0) {
      toast.error('Please enter a valid amount to settle');
      return;
    }
    if (settleAmount > showSettleModal.balance) {
      if (!confirm(`You are paying Rs. ${settleAmount.toLocaleString()} which exceeds the outstanding balance of Rs. ${showSettleModal.balance.toLocaleString()}. Proceed?`)) {
        return;
      }
    }

    setSettling(true);
    try {
      // Reduce the outstanding balance of the supplier by subtracting the settleAmount
      await adjustSupplierBalance(showSettleModal.id, -settleAmount);
      toast.success(`Paid Rs. ${settleAmount.toLocaleString()} to ${showSettleModal.name}. Balance updated!`);
      setShowSettleModal(null);
      setSettleAmount(0);
      loadSuppliers();
    } catch (error) {
      toast.error('Failed to settle payment');
    } finally {
      setSettling(false);
    }
  };

  const filtered = suppliers.filter(s => {
    const matchQuery = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.company && s.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.phone.includes(searchQuery);

    const matchFilter = !filterOutstandingOnly || s.balance > 0;

    return matchQuery && matchFilter;
  });

  const totalOutstanding = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
  const activeCompanies = new Set(suppliers.map(s => s.company).filter(Boolean)).size;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
          <p className="text-gray-500 text-sm mt-1">{suppliers.length} commercial suppliers registered</p>
        </div>
        <button
          onClick={() => { setEditingSupplier(null); reset({ name: '', company: '', phone: '', email: '', address: '', balance: 0 }); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200 hover:shadow-violet-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Suppliers', value: suppliers.length, icon: Truck, color: 'text-violet-600 bg-violet-50 border-violet-100' },
          { label: 'Owed Amount (Outstanding)', value: `Rs. ${totalOutstanding.toLocaleString()}`, icon: Wallet, color: 'text-red-600 bg-red-50 border-red-100' },
          { label: 'Active Partner Brands', value: activeCompanies, icon: Building, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${card.color} flex-shrink-0`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-400 font-medium mb-0.5">{card.label}</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm transition-all"
            placeholder="Search suppliers by name, phone, company..."
          />
        </div>
        <button
          onClick={() => setFilterOutstandingOnly(!filterOutstandingOnly)}
          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${filterOutstandingOnly ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
        >
          {filterOutstandingOnly ? 'Showing Outstanding Only' : 'Show Outstanding Only'}
        </button>
      </div>

      {/* Suppliers Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center justify-center text-center text-gray-400">
          <Truck className="w-16 h-16 mb-4 opacity-20 text-violet-600" />
          <h3 className="font-bold text-gray-700 text-lg mb-1">No Suppliers Found</h3>
          <p className="text-sm max-w-xs mb-4">Try altering your search text or outstanding filters to locate partner suppliers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all overflow-hidden flex flex-col justify-between">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      {supplier.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">{supplier.name}</h3>
                      <p className="text-xs text-violet-600 font-semibold">{supplier.company || 'Independent Supplier'}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(supplier)} className="p-1.5 hover:bg-violet-50 rounded-lg text-violet-500 transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(supplier.id, supplier.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm pt-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>{supplier.phone}</span>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs">{supplier.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Balances & Settlement Payment block */}
              <div className="px-5 pb-5 pt-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Owed Balance</p>
                  <p className={`font-bold text-lg ${supplier.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    Rs. {(supplier.balance || 0).toLocaleString()}
                  </p>
                </div>
                {supplier.balance > 0 && (
                  <button
                    onClick={() => { setShowSettleModal(supplier); setSettleAmount(supplier.balance); }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-xs font-semibold hover:from-emerald-600 hover:to-teal-600 shadow-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
                  >
                    Settle Payment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editingSupplier ? 'Edit Supplier Details' : 'Register New Supplier'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name *</label>
                <input {...register('name', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Brand Name</label>
                <input {...register('company')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. Acme Corporation" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                  <input {...register('phone', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. +94..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <input type="email" {...register('email')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="e.g. sales@acme.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Street Address</label>
                <input {...register('address')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="Supplier corporate address" />
              </div>
              {!editingSupplier && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Starting Owed Balance (Rs.)</label>
                  <input type="number" step="0.01" {...register('balance')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" placeholder="0" />
                  <p className="text-[11px] text-gray-400 mt-1">Starting unpaid balance already owed to this supplier.</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-lg shadow-violet-100">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSettleModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Settle Balance</h2>
              </div>
              <button onClick={() => setShowSettleModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Total Outstanding Balance</p>
                <p className="text-2xl font-black text-gray-800">Rs. {(showSettleModal.balance || 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 mt-1">{showSettleModal.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount (Rs.)</label>
                <input
                  type="number"
                  min="1"
                  max={showSettleModal.balance}
                  value={settleAmount}
                  onChange={e => setSettleAmount(Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-800 bg-white font-bold"
                  placeholder="Enter paid amount"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettlePayment}
                  disabled={settling || settleAmount <= 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
                >
                  {settling ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
                  Confirm Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
