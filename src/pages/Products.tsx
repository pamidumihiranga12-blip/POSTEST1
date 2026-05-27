import React, { useState, useEffect } from 'react';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../firebase/firestore';
import { Product } from '../store/posStore';
import BarcodeScanner from '../components/BarcodeScanner';
import { useForm } from 'react-hook-form';
import {
  Plus, Search, Barcode, Edit2, Trash2, Package, X,
  AlertTriangle, Save
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['Electronics', 'Accessories', 'Clothing', 'Food & Beverage', 'Health & Beauty', 'Home & Garden', 'Sports', 'Toys', 'Books', 'Other'];

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'form' | 'search'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue } = useForm<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>();

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    reset(product);
    setShowForm(true);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    if (scanTarget === 'form') {
      setValue('barcode', barcode);
    } else {
      setSearchQuery(barcode);
    }
  };

  const onSubmit = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    setSaving(true);
    try {
      const productData = {
        ...data,
        price: Number(data.price),
        costPrice: Number(data.costPrice),
        stock: Number(data.stock),
        minStock: Number(data.minStock),
        warrantyMonths: Number(data.warrantyMonths || 0),
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast.success('Product updated!');
      } else {
        await addProduct(productData as any);
        toast.success('Product added!');
      }
      setShowForm(false);
      setEditingProduct(null);
      reset();
      loadProducts();
    } catch (error) { toast.error('Failed to save product'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteProduct(id);
      toast.success('Product deleted');
      loadProducts();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) || p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div>
      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Products</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} total products</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); reset({ stock: 0, minStock: 5, warrantyMonths: 0 } as any); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="Search products..."
          />
        </div>
        <button
          onClick={() => { setScanTarget('search'); setShowScanner(true); }}
          className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-600 hover:border-indigo-300 transition-colors text-sm"
        >
          <Barcode className="w-4 h-4" /> Scan
        </button>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Warranty</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-sm">Loading products...</p>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No products found</p>
                </td>
              </tr>
            ) : filtered.map(product => (
              <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{product.name}</p>
                      {product.description && <p className="text-xs text-gray-400 truncate max-w-32">{product.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm font-mono text-gray-500">{product.barcode}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium">{product.category}</span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-gray-800 text-sm">Rs. {product.price.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-gray-500 text-sm">Rs. {product.costPrice.toLocaleString()}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.stock <= 0 ? 'bg-red-100 text-red-600' :
                    product.stock <= product.minStock ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                  }`}>
                    {product.stock <= product.minStock && product.stock > 0 && <AlertTriangle className="w-3 h-3" />}
                    {product.stock} {product.unit}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-500">
                  {product.warrantyMonths ? `${product.warrantyMonths}mo` : '-'}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleEdit(product)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(product.id, product.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name *</label>
                  <input {...register('name', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Product name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Barcode *</label>
                  <div className="flex gap-2">
                    <input {...register('barcode', { required: true })} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Barcode" />
                    <button type="button" onClick={() => { setScanTarget('form'); setShowScanner(true); }} className="px-3 py-2.5 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors">
                      <Barcode className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category *</label>
                  <select {...register('category', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Selling Price (Rs.) *</label>
                  <input type="number" step="0.01" {...register('price', { required: true, min: 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost Price (Rs.) *</label>
                  <input type="number" step="0.01" {...register('costPrice', { required: true, min: 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Quantity *</label>
                  <input type="number" {...register('stock', { required: true, min: 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum Stock Alert *</label>
                  <input type="number" {...register('minStock', { required: true, min: 0 })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="5" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit *</label>
                  <select {...register('unit', { required: true })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm">
                    <option value="">Select unit</option>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kilograms</option>
                    <option value="g">Grams</option>
                    <option value="l">Liters</option>
                    <option value="ml">Milliliters</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Warranty (months)</label>
                  <input type="number" {...register('warrantyMonths')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea {...register('description')} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" placeholder="Product description..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-60">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
