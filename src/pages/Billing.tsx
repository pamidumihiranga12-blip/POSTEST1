import React, { useState, useEffect, useRef } from 'react';
import { usePosStore } from '../store/posStore';
import { getProducts, getProductByBarcode, createInvoice, getVoucherByCode, getCustomers, generateInvoiceNumber } from '../firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { Product, Customer, Voucher } from '../store/posStore';
import BarcodeScanner from '../components/BarcodeScanner';
import {
  Search, Barcode, Plus, Minus, Trash2, Tag, User, CreditCard,
  Banknote, Smartphone, Printer, ShoppingCart, X, CheckCircle, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Billing: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const { userProfile } = useAuthStore();
  const { cart, selectedCustomer, appliedVoucher, addToCart, removeFromCart, updateQuantity, updateDiscount, clearCart, setCustomer, setVoucher, getSubtotal, getTotal, getDiscount } = usePosStore();
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, custs] = await Promise.all([getProducts(), getCustomers()]);
      setProducts(prods);
      setCustomers(custs);
    } catch (error) {
      toast.error('Failed to load data');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode.includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
    c.phone.includes(customerQuery) ||
    c.email.toLowerCase().includes(customerQuery.toLowerCase())
  );

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    try {
      const product = await getProductByBarcode(barcode);
      if (product) {
        if (product.stock <= 0) {
          toast.error(`${product.name} is out of stock!`);
          return;
        }
        addToCart(product);
        toast.success(`Added: ${product.name}`);
      } else {
        toast.error('Product not found for barcode: ' + barcode);
      }
    } catch (error) {
      toast.error('Error scanning barcode');
    }
  };

  const applyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const voucher = await getVoucherByCode(voucherCode);
      if (!voucher) { toast.error('Invalid voucher code'); return; }
      if (!voucher.isActive) { toast.error('Voucher is inactive'); return; }
      if (new Date(voucher.expiryDate) < new Date()) { toast.error('Voucher has expired'); return; }
      if (voucher.usedCount >= voucher.maxUses) { toast.error('Voucher usage limit reached'); return; }
      if (getSubtotal() < voucher.minPurchase) {
        toast.error(`Minimum purchase of Rs. ${voucher.minPurchase} required`);
        return;
      }
      setVoucher(voucher as Voucher);
      toast.success(`Voucher applied! You save ${voucher.type === 'percentage' ? voucher.value + '%' : 'Rs. ' + voucher.value}`);
    } catch (error) {
      toast.error('Error applying voucher');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setLoading(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const invoice = {
        invoiceNumber,
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        items: cart,
        subtotal: getSubtotal(),
        discount: getDiscount(),
        tax: 0,
        total: getTotal(),
        paymentMethod,
        voucherId: appliedVoucher?.id,
        status: 'paid' as const,
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.displayName || 'Staff',
      };
      await createInvoice(invoice);
      setLastInvoice(invoice);
      clearCart();
      setShowSuccess(true);
      await loadData();
      toast.success('Invoice created successfully!');
    } catch (error) {
      toast.error('Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (showSuccess && lastInvoice) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Payment Successful!</h2>
          <p className="text-gray-500 mb-6">Invoice {lastInvoice.invoiceNumber} has been created</p>

          <div ref={invoiceRef} className="bg-gray-50 rounded-xl p-6 text-left mb-6 border border-gray-100">
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-indigo-600">SmartZone POS</h3>
              <p className="text-sm text-gray-500">Invoice Receipt</p>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mb-4">
              <div>
                <p><span className="font-medium">Invoice#:</span> {lastInvoice.invoiceNumber}</p>
                <p><span className="font-medium">Date:</span> {format(new Date(lastInvoice.createdAt), 'MMM d, yyyy h:mm a')}</p>
              </div>
              <div className="text-right">
                <p><span className="font-medium">Customer:</span> {lastInvoice.customerName}</p>
                <p><span className="font-medium">Payment:</span> {lastInvoice.paymentMethod}</p>
              </div>
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600">Item</th>
                  <th className="text-center py-2 text-gray-600">Qty</th>
                  <th className="text-right py-2 text-gray-600">Price</th>
                  <th className="text-right py-2 text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {lastInvoice.items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">{item.product.name}</td>
                    <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-600">Rs. {item.product.price.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium">Rs. {item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1.5 text-sm border-t border-gray-200 pt-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>Rs. {lastInvoice.subtotal.toLocaleString()}</span>
              </div>
              {lastInvoice.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-Rs. {lastInvoice.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-800 border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>Rs. {lastInvoice.total.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">Thank you for shopping at SmartZone!</p>
          </div>

          <div className="flex gap-3">
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
            <button onClick={() => setShowSuccess(false)} className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all">
              New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}

      {/* Product Search */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Billing / POS</h1>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                placeholder="Search products by name, barcode, or category..."
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Barcode className="w-5 h-5" />
              <span className="hidden sm:block">Scan</span>
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => {
                  if (product.stock <= 0) { toast.error('Out of stock!'); return; }
                  addToCart(product);
                  toast.success(`Added ${product.name}`);
                }}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="font-semibold text-gray-800 text-sm line-clamp-1">{product.name}</p>
                <p className="text-xs text-gray-400 mb-2">{product.category}</p>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-600 font-bold text-sm">Rs. {product.price.toLocaleString()}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${product.stock <= product.minStock ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                    {product.stock <= 0 ? 'Out' : `${product.stock} left`}
                  </span>
                </div>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">{searchQuery ? 'No products found' : 'No products added yet'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart / Order Panel */}
      <div className="w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Current Order</h2>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-red-400 hover:text-red-500 text-xs flex items-center gap-1">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <button
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:border-indigo-300 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-left text-gray-600">{selectedCustomer?.name || 'Walk-in Customer'}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showCustomerSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                <div className="p-2">
                  <input
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search customers..."
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { setCustomer(null); setShowCustomerSearch(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Walk-in Customer
                  </button>
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); setShowCustomerSearch(false); setCustomerQuery(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                    >
                      <p className="font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400">Rs. {item.product.price.toLocaleString()} each</p>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-500 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                      disabled={item.quantity >= item.product.stock}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        value={item.discount}
                        onChange={e => updateDiscount(item.product.id, Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center bg-white"
                        placeholder="0%"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 w-20 text-right">
                      Rs. {item.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Voucher */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={voucherCode}
                onChange={e => setVoucherCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Voucher code..."
                disabled={!!appliedVoucher}
              />
            </div>
            {appliedVoucher ? (
              <button onClick={() => { setVoucher(null); setVoucherCode(''); }} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm hover:bg-red-100 transition-colors">
                Remove
              </button>
            ) : (
              <button onClick={applyVoucher} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors">
                Apply
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>Rs. {getSubtotal().toLocaleString()}</span>
            </div>
            {getDiscount() > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-Rs. {getDiscount().toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-800 border-t border-gray-100 pt-2">
              <span>Total</span>
              <span className="text-indigo-600">Rs. {getTotal().toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { method: 'cash', label: 'Cash', icon: Banknote },
              { method: 'card', label: 'Card', icon: CreditCard },
              { method: 'mobile', label: 'Mobile', icon: Smartphone },
            ].map(({ method, label, icon: Icon }) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method as any)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                  paymentMethod === method
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold text-sm hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Processing...
              </span>
            ) : `Charge Rs. ${getTotal().toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Billing;
