import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getProducts, addProduct, updateProduct, deleteProduct, updateProductStock, getProductStats, getSuppliers, adjustSupplierBalance } from '../firebase/firestore';
import { Product, Supplier } from '../store/posStore';
import BarcodeScanner from '../components/BarcodeScanner';
import { useForm } from 'react-hook-form';
import {
  Plus, Search, Barcode, Edit2, Trash2, Package, X,
  AlertTriangle, Save, Grid3X3, List, TrendingUp,
  ArrowUpDown, ChevronLeft, ChevronRight, Minus,
  LayoutGrid, DollarSign, PackageX, Tag, Filter,
  RefreshCw, MoreVertical, Eye, PackagePlus, Check,
  Image as LucideImage, ImageIcon, User
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['Electronics', 'Accessories', 'Clothing', 'Food & Beverage', 'Health & Beauty', 'Home & Garden', 'Sports', 'Toys', 'Books', 'Other'];
const ITEMS_PER_PAGE = 12;

interface ProductStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  totalCostValue: number;
  categoriesCount: number;
}

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanTarget, setScanTarget] = useState<'form' | 'search'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock' | 'category'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showStockModal, setShowStockModal] = useState<Product | null>(null);
  const [stockAdjust, setStockAdjust] = useState(0);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');

  // Supplier transaction states
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [isPaidInFull, setIsPaidInFull] = useState<boolean>(true);
  const [amountPaid, setAmountPaid] = useState<number>(0);

  const [adjustSupplierId, setAdjustSupplierId] = useState<string>('');
  const [adjustIsPaidInFull, setAdjustIsPaidInFull] = useState<boolean>(true);
  const [adjustAmountPaid, setAdjustAmountPaid] = useState<number>(0);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>();

  const generateNextBarcode = useCallback(() => {
    const numericBarcodes = products
      .map(p => p.barcode)
      .filter(b => b && /^\d+$/.test(b))
      .map(b => parseInt(b, 10));

    const maxVal = numericBarcodes.length > 0 ? Math.max(...numericBarcodes) : 0;
    const nextVal = maxVal + 1;
    return nextVal.toString().padStart(3, '0');
  }, [products]);

  const watchPrice = watch('price');
  const watchCostPrice = watch('costPrice');
  const watchImageUrl = watch('imageUrl');

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterCategory, filterStock]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (activeDropdown) setActiveDropdown(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeDropdown]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([getProducts(), getProductStats()]);
      setProducts(data);
      setStats(statsData);
    } catch (error) { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };



  const handleBarcodeScanned = (barcode: string) => {
    setShowScanner(false);
    if (scanTarget === 'form') {
      setValue('barcode', barcode);
    } else {
      setSearchQuery(barcode);
    }
  };

  const handleOpenAddForm = () => {
    setEditingProduct(null);
    const nextCode = generateNextBarcode();
    reset({
      name: '',
      barcode: nextCode,
      category: '',
      price: 0,
      costPrice: 0,
      stock: 0,
      minStock: 5,
      unit: 'pcs',
      description: '',
      warrantyMonths: 0,
      imageUrl: ''
    });
    setSelectedSupplierId('');
    setIsPaidInFull(true);
    setAmountPaid(0);
    setShowForm(true);
  };

  const handleOpenStockAdjust = (product: Product) => {
    setShowStockModal(product);
    setStockAdjust(0);
    setAdjustSupplierId(product.supplierId || '');
    setAdjustIsPaidInFull(true);
    setAdjustAmountPaid(0);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    reset(product);
    setSelectedSupplierId(product.supplierId || '');
    setIsPaidInFull(true);
    setAmountPaid(0);
    setShowForm(true);
    setActiveDropdown(null);
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
        toast.success('Product updated successfully!');
      } else {
        await addProduct(productData as any);
        toast.success('Product added successfully!');
      }
      setShowForm(false);
      setEditingProduct(null);
      reset();
      loadProducts();
    } catch (error) { toast.error('Failed to save product'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteProduct(id);
      toast.success(`"${name}" deleted`);
      setShowDeleteConfirm(null);
      loadProducts();
    } catch (error) { toast.error('Failed to delete'); }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Delete ${selectedProducts.size} selected products?`)) return;
    try {
      for (const id of selectedProducts) {
        await deleteProduct(id);
      }
      toast.success(`${selectedProducts.size} products deleted`);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (error) { toast.error('Failed to delete some products'); }
  };

  const handleStockAdjust = async () => {
    if (!showStockModal) return;
    try {
      await updateProductStock(showStockModal.id, showStockModal.stock + stockAdjust);
      toast.success('Stock updated!');
      setShowStockModal(null);
      setStockAdjust(0);
      loadProducts();
    } catch (error) { toast.error('Failed to update stock'); }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedProducts(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filtered.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filtered.map(p => p.id)));
    }
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  // Filter & sort
  const filtered = useMemo(() => {
    let result = products.filter(p => {
      if (!p) return false;
      const name = p.name || '';
      const barcode = p.barcode || '';
      const category = p.category || '';
      const stock = p.stock || 0;
      const minStock = p.minStock || 0;

      const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barcode.includes(searchQuery) || category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = !filterCategory || category === filterCategory;
      const matchStock =
        filterStock === 'all' ? true :
        filterStock === 'low' ? (stock <= minStock && stock > 0) :
        stock <= 0;
      return matchSearch && matchCat && matchStock;
    });

    result.sort((a, b) => {
      if (!a || !b) return 0;
      let cmp = 0;
      switch (sortBy) {
        case 'name': cmp = (a.name || '').localeCompare(b.name || ''); break;
        case 'price': cmp = (a.price || 0) - (b.price || 0); break;
        case 'stock': cmp = (a.stock || 0) - (b.stock || 0); break;
        case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, searchQuery, filterCategory, filterStock, sortBy, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const profitMargin = useMemo(() => {
    const p = Number(watchPrice) || 0;
    const c = Number(watchCostPrice) || 0;
    if (p <= 0) return 0;
    return ((p - c) / p * 100);
  }, [watchPrice, watchCostPrice]);

  const getStockBadge = (product: Product) => {
    if (!product) return { label: 'Unknown', cls: 'bg-gray-100 text-gray-700 border-gray-200', icon: PackageX };
    const stock = product.stock || 0;
    const minStock = product.minStock || 0;
    if (stock <= 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-700 border-red-200', icon: PackageX };
    if (stock <= minStock) return { label: 'Low Stock', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle };
    return { label: 'In Stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Check };
  };

  return (
    <div className="min-h-0">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
              <Package className="w-5 h-5 text-white" />
            </div>
            Product Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage your inventory, track stock levels, and organize products</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
            className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-all text-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAddForm}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalProducts ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Products</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-amber-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Warning</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats ? stats.lowStockCount + stats.outOfStockCount : '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Low / Out of Stock</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Value</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats ? `Rs. ${stats.totalValue.toLocaleString()}` : '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Inventory Value</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-violet-50 rounded-xl">
              <Tag className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Groups</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.categoriesCount ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Categories</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-5">
        <div className="flex flex-col lg:flex-row gap-3 p-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
              placeholder="Search by name, barcode, or category..."
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Barcode Scan */}
            <button
              onClick={() => { setScanTarget('search'); setShowScanner(true); }}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all text-sm"
            >
              <Barcode className="w-4 h-4" /> Scan
            </button>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600 cursor-pointer"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Stock Filter */}
            <select
              value={filterStock}
              onChange={e => setFilterStock(e.target.value as any)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-600 cursor-pointer"
            >
              <option value="all">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:text-indigo-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:text-indigo-600'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-t border-indigo-100">
            <span className="text-sm font-medium text-indigo-700">
              {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProducts(new Set())}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Deselect All
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-400 mt-3">Loading products...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-4 bg-gray-50 rounded-2xl mb-4">
            <PackageX className="w-12 h-12 text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium">No products found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery || filterCategory || filterStock !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add your first product to get started'}
          </p>
          {!searchQuery && !filterCategory && filterStock === 'all' && (
            <button
              onClick={handleOpenAddForm}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-violet-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Add First Product
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="py-3 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedProducts.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600 transition-colors" onClick={() => handleSort('name')}>
                    <span className="flex items-center gap-1">Product {sortBy === 'name' && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600 transition-colors" onClick={() => handleSort('category')}>
                    <span className="flex items-center gap-1">Category {sortBy === 'category' && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600 transition-colors" onClick={() => handleSort('price')}>
                    <span className="flex items-center justify-end gap-1">Price {sortBy === 'price' && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-indigo-600 transition-colors" onClick={() => handleSort('stock')}>
                    <span className="flex items-center justify-center gap-1">Stock {sortBy === 'stock' && <ArrowUpDown className="w-3 h-3" />}</span>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Warranty</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(product => {
                  if (!product) return null;
                  const badge = getStockBadge(product);
                  const price = product.price || 0;
                  const costPrice = product.costPrice || 0;
                  const margin = price > 0 ? ((price - costPrice) / price * 100) : 0;
                  return (
                    <tr key={product.id} className={`border-b border-gray-50 hover:bg-indigo-50/30 transition-colors ${selectedProducts.has(product.id) ? 'bg-indigo-50/50' : ''}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 shadow-sm bg-white">
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-indigo-100">
                              <Package className="w-5 h-5 text-indigo-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{product.name}</p>
                            {product.supplierName && <p className="text-[10px] text-violet-600 font-semibold">Supplier: {product.supplierName}</p>}
                            {product.description && <p className="text-xs text-gray-400 truncate max-w-40">{product.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-gray-500">{product.barcode}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium border border-indigo-100">{product.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-gray-800 text-sm">Rs. {(product.price || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-gray-500 text-sm">Rs. {(product.costPrice || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-semibold ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenStockAdjust(product)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity ${badge.cls}`}
                          >
                            {product.stock <= product.minStock && product.stock > 0 && <AlertTriangle className="w-3 h-3" />}
                            {product.stock <= 0 && <PackageX className="w-3 h-3" />}
                            {product.stock} {product.unit}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">
                        {product.warrantyMonths ? `${product.warrantyMonths}mo` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(product)} className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleOpenStockAdjust(product)} className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-500 transition-colors" title="Adjust Stock">
                            <PackagePlus className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowDeleteConfirm({ id: product.id, name: product.name })} className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-colors" title="Delete">
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
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map(product => {
            if (!product) return null;
            const badge = getStockBadge(product);
            const price = product.price || 0;
            const costPrice = product.costPrice || 0;
            const margin = price > 0 ? ((price - costPrice) / price * 100) : 0;
            const BadgeIcon = badge.icon;
            return (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden group ${
                  selectedProducts.has(product.id) ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100'
                }`}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedProducts.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    {product.imageUrl ? (
                      <div className="w-10 h-10 bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-indigo-100">
                        <Package className="w-5 h-5 text-indigo-600" />
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === product.id ? null : product.id); }}
                      className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {activeDropdown === product.id && (
                      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30">
                        <button onClick={() => handleEdit(product)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => { handleOpenStockAdjust(product); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <PackagePlus className="w-3.5 h-3.5" /> Adjust Stock
                        </button>
                        <hr className="my-1 border-gray-100" />
                        <button onClick={() => { setShowDeleteConfirm({ id: product.id, name: product.name }); setActiveDropdown(null); }} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate">{product.name}</h3>
                  {product.supplierName && <p className="text-[10px] text-violet-600 font-semibold mb-1">Supplier: {product.supplierName}</p>}
                  <p className="text-xs text-gray-400 font-mono mb-3">{product.barcode}</p>

                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-xs font-medium">{product.category}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${badge.cls}`}>
                      <BadgeIcon className="w-3 h-3" />
                      {product.stock} {product.unit}
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-lg font-bold text-gray-900">Rs. {(product.price || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Cost: Rs. {(product.costPrice || 0).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                        {margin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-400">margin</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-gray-700">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-gray-700">{filtered.length}</span> products
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add/Edit Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl">
                  {editingProduct ? <Edit2 className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                  <p className="text-xs text-gray-400">{editingProduct ? 'Update product details' : 'Fill in the product information'}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
              {/* Basic Info Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-500" /> Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name <span className="text-red-400">*</span></label>
                    <input {...register('name', { required: 'Product name is required' })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`} placeholder="e.g. Wireless Bluetooth Headphones" />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Barcode <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <input {...register('barcode', { required: 'Barcode is required' })} className={`flex-1 px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono ${errors.barcode ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="e.g. 8901234567890" />
                      <button type="button" onClick={() => { setScanTarget('form'); setShowScanner(true); }} className="px-3 py-2.5 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                        <Barcode className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {errors.barcode && <p className="text-xs text-red-500 mt-1">{errors.barcode.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Category <span className="text-red-400">*</span></label>
                    <select {...register('category', { required: 'Category is required' })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer ${errors.category ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> Pricing
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Selling Price (Rs.) <span className="text-red-400">*</span></label>
                    <input type="number" step="0.01" {...register('price', { required: 'Price is required', min: { value: 0, message: 'Must be ≥ 0' } })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${errors.price ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="0.00" />
                    {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost Price (Rs.) <span className="text-red-400">*</span></label>
                    <input type="number" step="0.01" {...register('costPrice', { required: 'Cost price is required', min: { value: 0, message: 'Must be ≥ 0' } })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${errors.costPrice ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="0.00" />
                    {errors.costPrice && <p className="text-xs text-red-500 mt-1">{errors.costPrice.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Profit Margin</label>
                    <div className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm font-semibold ${profitMargin >= 30 ? 'text-emerald-600' : profitMargin >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                      {profitMargin.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Stock Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-500" /> Stock & Inventory
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock Qty <span className="text-red-400">*</span></label>
                    <input type="number" {...register('stock', { required: 'Stock is required', min: { value: 0, message: 'Must be ≥ 0' } })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${errors.stock ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="0" />
                    {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Stock Alert <span className="text-red-400">*</span></label>
                    <input type="number" {...register('minStock', { required: 'Min stock is required', min: { value: 0, message: 'Must be ≥ 0' } })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm ${errors.minStock ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} placeholder="5" />
                    {errors.minStock && <p className="text-xs text-red-500 mt-1">{errors.minStock.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit <span className="text-red-400">*</span></label>
                    <select {...register('unit', { required: 'Unit is required' })} className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer ${errors.unit ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
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
                    {errors.unit && <p className="text-xs text-red-500 mt-1">{errors.unit.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Warranty (months)</label>
                    <input type="number" {...register('warrantyMonths')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Media Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <LucideImage className="w-4 h-4 text-indigo-500" /> Product Image
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
                    <input {...register('imageUrl')} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all" placeholder="e.g. https://images.unsplash.com/... or relative path" />
                  </div>
                  <div className="flex justify-center sm:justify-end">
                    {watchImageUrl ? (
                      <div className="relative w-16 h-16 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex-shrink-0">
                        <img src={watchImageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150'; }} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-white flex-shrink-0">
                        <ImageIcon className="w-5 h-5 mb-0.5" />
                        <span className="text-[9px]">No image</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea {...register('description')} rows={3} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" placeholder="Optional product description..." />
              </div>

              {/* Supplier & Purchase Info Section */}
              {suppliers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-violet-500" /> Supplier &amp; Purchase Info
                  </h3>
                  <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier (Optional)</label>
                      <select
                        value={selectedSupplierId}
                        onChange={e => setSelectedSupplierId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white cursor-pointer"
                      >
                        <option value="">-- Select Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>
                        ))}
                      </select>
                      {selectedSupplierId && (
                        <p className="text-[11px] text-violet-600 font-semibold mt-1">
                          Current Outstanding Balance: Rs. {suppliers.find(s => s.id === selectedSupplierId)?.balance.toLocaleString() || 0}
                        </p>
                      )}
                    </div>
                    {selectedSupplierId && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPaidInFull(true)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${isPaidInFull ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                          >
                            Paid in Full
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPaidInFull(false)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!isPaidInFull ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                          >
                            Partial Payment
                          </button>
                        </div>
                        {!isPaidInFull && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid (Rs.)</label>
                            <input
                              type="number"
                              min="0"
                              value={amountPaid}
                              onChange={e => setAmountPaid(Number(e.target.value))}
                              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                              placeholder="0"
                            />
                            <p className="text-xs text-amber-600 mt-1">Remaining unpaid balance will be added to the supplier\'s outstanding amount.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-60 shadow-lg shadow-indigo-200">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowStockModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <PackagePlus className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Adjust Stock</h2>
              </div>
              <p className="text-sm text-gray-500 mt-2">{showStockModal.name}</p>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 mb-1">Current Stock</p>
                <p className="text-3xl font-bold text-gray-800">{showStockModal.stock} <span className="text-lg font-normal text-gray-400">{showStockModal.unit}</span></p>
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setStockAdjust(a => a - 1)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500 hover:bg-red-50 transition-all text-xl font-bold"
                >
                  −
                </button>
                <div className="text-center">
                  <input
                    type="number"
                    value={stockAdjust}
                    onChange={e => setStockAdjust(Number(e.target.value))}
                    className="w-24 text-center text-2xl font-bold border-b-2 border-gray-200 focus:border-indigo-500 focus:outline-none py-1 bg-transparent text-gray-800"
                  />
                  <p className="text-xs text-gray-400 mt-1">adjustment</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStockAdjust(a => a + 1)}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border-2 border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all text-xl font-bold"
                >
                  +
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 text-center mb-6">
                <p className="text-sm text-gray-500">New Stock Level</p>
                <p className={`text-2xl font-bold ${showStockModal.stock + stockAdjust <= 0 ? 'text-red-500' : showStockModal.stock + stockAdjust <= showStockModal.minStock ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {Math.max(0, showStockModal.stock + stockAdjust)} {showStockModal.unit}
                </p>
              </div>

              {/* Supplier Selection for Stock Adjustment (Only if adding stock) */}
              {stockAdjust > 0 && suppliers.length > 0 && (
                <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-4 space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier (Optional)</label>
                    <select
                      value={adjustSupplierId}
                      onChange={e => setAdjustSupplierId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white cursor-pointer"
                    >
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>
                      ))}
                    </select>
                    {adjustSupplierId && (
                      <p className="text-[11px] text-violet-600 font-semibold mt-1">
                        Current Outstanding Balance: Rs. {suppliers.find(s => s.id === adjustSupplierId)?.balance.toLocaleString() || 0}
                      </p>
                    )}
                  </div>
                  {adjustSupplierId && (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setAdjustIsPaidInFull(true)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${adjustIsPaidInFull ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                        >
                          Paid in Full
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustIsPaidInFull(false)}
                          className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!adjustIsPaidInFull ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'}`}
                        >
                          Partial Payment
                        </button>
                      </div>
                      {!adjustIsPaidInFull && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid (Rs.)</label>
                          <input
                            type="number"
                            min="0"
                            value={adjustAmountPaid}
                            onChange={e => setAdjustAmountPaid(Number(e.target.value))}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                            placeholder="0"
                          />
                          <p className="text-xs text-amber-600 mt-1">Remaining unpaid balance (Cost Price: Rs. {(showStockModal.costPrice * stockAdjust).toLocaleString()}) will be added to the supplier\'s outstanding amount.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowStockModal(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStockAdjust}
                  disabled={stockAdjust === 0}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-40 shadow-lg shadow-emerald-200"
                >
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Product</h3>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <span className="font-semibold text-gray-700">"{showDeleteConfirm.name}"</span>? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm.id, showDeleteConfirm.name)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
