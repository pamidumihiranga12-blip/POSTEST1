import React, { useState, useEffect } from 'react';
import { usePosStore } from '../store/posStore';
import {
  getProducts, getProductByBarcode, createInvoice,
  getVoucherByCode, getCustomers, generateInvoiceNumber, getInvoiceSettings
} from '../firebase/firestore';
import { useAuthStore } from '../store/authStore';
import { Product, Customer, Voucher } from '../store/posStore';
import BarcodeScanner from '../components/BarcodeScanner';
import {
  Search, Barcode, Plus, Minus, Trash2, Tag, User, CreditCard,
  Banknote, Smartphone, Printer, ShoppingCart, X, CheckCircle,
  ChevronDown, UserCheck, Receipt
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
  const [invoiceSettings, setInvoiceSettings] = useState<any>(null);
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cashierName, setCashierName] = useState('');
  const { userProfile } = useAuthStore();
  const {
    cart, selectedCustomer, appliedVoucher, addToCart, removeFromCart,
    updateQuantity, updateDiscount, clearCart, setCustomer, setVoucher,
    getSubtotal, getTotal, getDiscount
  } = usePosStore();

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  useEffect(() => {
    if (userProfile?.displayName) {
      setCashierName(userProfile.displayName);
    } else {
      setCashierName('Staff');
    }
  }, [userProfile]);

  const loadData = async () => {
    try {
      const [prods, custs] = await Promise.all([getProducts(), getCustomers()]);
      setProducts(prods);
      setCustomers(custs);
    } catch {
      toast.error('Failed to load data');
    }
  };

  const loadSettings = async () => {
    try {
      const settings = await getInvoiceSettings();
      setInvoiceSettings(settings);
    } catch {
      // use defaults silently
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
    c.phone?.includes(customerQuery) ||
    c.email?.toLowerCase().includes(customerQuery.toLowerCase())
  );

  const handleBarcodeScanned = async (barcode: string) => {
    setShowScanner(false);
    setSearchQuery(barcode); // fall into search box
    try {
      const product = await getProductByBarcode(barcode);
      if (product) {
        if (product.stock <= 0) { toast.error(`${product.name} is out of stock!`); return; }
        addToCart(product);
        toast.success(`Added: ${product.name}`);
      } else {
        toast.error('Product not found for barcode: ' + barcode);
      }
    } catch { toast.error('Error scanning barcode'); }
  };

  // Hardware Scanner detection
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock' || e.key === 'Tab' || e.key === 'Backspace' || e.key === 'Escape') {
        return;
      }

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      if (e.key.length > 1 && e.key !== 'Enter') return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (timeDiff > 50) {
        buffer = e.key === 'Enter' ? '' : e.key;
      } else {
        if (e.key === 'Enter') {
          if (buffer.length >= 3) {
            handleBarcodeScanned(buffer);
            buffer = '';
            e.preventDefault();
          }
        } else {
          buffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

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
    } catch { toast.error('Error applying voucher'); }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setLoading(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const invoice: any = {
        invoiceNumber,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        items: cart.map(item => ({
          product: {
            id: item.product.id,
            name: item.product.name,
            price: item.product.price,
            costPrice: item.product.costPrice || 0,
            stock: item.product.stock,
            minStock: item.product.minStock || 0,
            category: item.product.category,
            barcode: item.product.barcode || ''
          },
          quantity: item.quantity,
          discount: item.discount,
          total: item.total
        })),
        subtotal: getSubtotal(),
        discount: getDiscount(),
        tax: 0,
        total: getTotal(),
        paymentMethod,
        status: 'paid' as const,
        createdAt: new Date().toISOString(),
        createdBy: cashierName || 'Staff',
        cashierId: userProfile?.uid || '',
      };

      if (selectedCustomer?.id) {
        invoice.customerId = selectedCustomer.id;
      }
      if (appliedVoucher?.id) {
        invoice.voucherId = appliedVoucher.id;
      }
      if (paymentMethod === 'cash' && cashReceived) {
        invoice.cashReceived = Number(cashReceived);
        invoice.cashChange = Math.max(0, Number(cashReceived) - getTotal());
      }

      await createInvoice(invoice);
      setLastInvoice(invoice);
      clearCart();
      setShowSuccess(true);
      setCashReceived('');
      // Auto-print after a short delay
      setTimeout(() => printReceipt(invoice, invoiceSettings), 600);
      await loadData();
      toast.success('Invoice created! Printing receipt...');
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      toast.error('Failed to create invoice: ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = (invoice: any, settings: any) => {
    const s = settings || {};
    const businessName = s.businessName || 'SmartZone POS';
    const tagline = s.tagline || 'Your Trusted Shopping Destination';
    const address = s.address || '';
    const phone = s.phone || '';
    const email = s.email || '';
    const thankYou = s.thankYouMessage || 'Thank you for shopping with us!';
    const returnPolicy = s.returnPolicy || '';
    const footerNote = s.footerNote || 'Powered by SmartZone POS';
    const primaryColor = s.primaryColor || '#4f46e5';
    const logoUrl = s.logoUrl || '';

    const itemsHtml = invoice.items.map((item: any) => `
      <tr>
        <td style="padding:3px 0;vertical-align:top;">${item.product.name}${item.discount > 0 ? `<br><small style="color:#666;">-${item.discount}% disc.</small>` : ''}</td>
        <td style="text-align:center;padding:3px 2px;white-space:nowrap;">${item.quantity}</td>
        <td style="text-align:right;padding:3px 0;white-space:nowrap;">Rs.${item.product.price.toLocaleString()}</td>
        <td style="text-align:right;padding:3px 0;font-weight:600;white-space:nowrap;">Rs.${item.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const payIcons: any = { cash: '💵', card: '💳', mobile: '📱' };

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${invoice.invoiceNumber}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #111;
      background: #fff;
    }
    .center { text-align: center; }
    .logo-area { text-align: center; padding: 4mm 0 2mm; }
    .logo-img { width: 30mm; height: auto; margin-bottom: 2mm; }
    .business-name {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
      color: ${primaryColor};
      text-transform: uppercase;
    }
    .tagline { font-size: 9px; color: #555; margin-top: 1mm; }
    .contact { font-size: 9px; color: #444; margin-top: 1mm; line-height: 1.5; }
    .divider { border: none; border-top: 1px dashed #999; margin: 2mm 0; }
    .divider-solid { border: none; border-top: 1px solid #333; margin: 2mm 0; }
    .section { margin: 1mm 0; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1px 0; }
    .label { color: #555; }
    .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { border-bottom: 1px solid #333; }
    thead th { font-size: 9px; padding: 2px 0; text-align: left; text-transform: uppercase; color: #444; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    tbody td { font-size: 10px; color: #222; }
    tfoot tr { border-top: 1px dashed #999; }
    tfoot td { padding: 2px 0; }
    .total-row { font-size: 13px; font-weight: 900; border-top: 1px solid #333; border-bottom: 1px solid #333; }
    .total-row td { padding: 3px 0; }
    .badge {
      display: inline-block;
      background: ${primaryColor};
      color: #fff;
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .thank-you { text-align: center; margin: 4mm 0 2mm; font-size: 12px; font-weight: 700; color: ${primaryColor}; }
    .return-policy { text-align: center; font-size: 8px; color: #666; line-height: 1.4; }
    .footer { text-align: center; font-size: 8px; color: #999; margin-top: 3mm; padding-bottom: 4mm; }
    .inv-number { font-size: 10px; font-weight: 700; color: ${primaryColor}; }
    .cashier-badge { background: #f0f0f0; border-radius: 4px; padding: 1px 4px; font-size: 9px; }
    @media print {
      body { width: 72mm; margin: 0 auto; padding: 2mm 1mm; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="logo-area">
    ${logoUrl ? `<img class="logo-img" src="${logoUrl}" alt="Logo" onerror="this.style.display='none'">` : ''}
    <div class="business-name">${businessName}</div>
    ${tagline ? `<div class="tagline">${tagline}</div>` : ''}
    <div class="contact">
      ${address ? address + '<br>' : ''}${phone ? '📞 ' + phone : ''}${email ? ' | ✉ ' + email : ''}
    </div>
  </div>

  <hr class="divider-solid">

  <div class="section">
    <div class="row"><span class="label">RECEIPT</span><span class="inv-number">${invoice.invoiceNumber}</span></div>
    <div class="row"><span class="label">Date:</span><span>${format(new Date(invoice.createdAt), 'dd/MM/yyyy hh:mm a')}</span></div>
    <div class="row"><span class="label">Customer:</span><span class="value">${invoice.customerName}</span></div>
    ${invoice.customerPhone ? `<div class="row"><span class="label">Phone:</span><span>${invoice.customerPhone}</span></div>` : ''}
    <div class="row"><span class="label">Cashier:</span><span class="cashier-badge">👤 ${invoice.createdBy}</span></div>
    <div class="row"><span class="label">Payment:</span><span class="badge">${payIcons[invoice.paymentMethod] || ''} ${invoice.paymentMethod.toUpperCase()}</span></div>
  </div>

  <hr class="divider">

  <table>
    <thead>
      <tr>
        <th style="width:42%;">Item</th>
        <th style="width:10%;text-align:center;">Qty</th>
        <th style="width:22%;text-align:right;">Price</th>
        <th style="width:26%;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right;color:#555;font-size:10px;padding-top:3px;">Subtotal:</td>
        <td style="text-align:right;padding-top:3px;">Rs.${invoice.subtotal.toLocaleString()}</td>
      </tr>
      ${invoice.discount > 0 ? `
      <tr>
        <td colspan="3" style="text-align:right;color:#059669;">Discount:</td>
        <td style="text-align:right;color:#059669;">-Rs.${invoice.discount.toLocaleString()}</td>
      </tr>` : ''}
      ${invoice.tax > 0 ? `
      <tr>
        <td colspan="3" style="text-align:right;color:#555;">Tax:</td>
        <td style="text-align:right;">Rs.${invoice.tax.toLocaleString()}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TOTAL:</td>
        <td style="text-align:right;color:${primaryColor};">Rs.${invoice.total.toLocaleString()}</td>
      </tr>
      ${invoice.cashReceived ? `
      <tr>
        <td colspan="3" style="text-align:right;color:#555;padding-top:2px;">Cash Received:</td>
        <td style="text-align:right;padding-top:2px;">Rs.${Number(invoice.cashReceived).toLocaleString()}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align:right;color:#059669;font-weight:700;">Change:</td>
        <td style="text-align:right;color:#059669;font-weight:700;">Rs.${Number(invoice.cashChange || 0).toLocaleString()}</td>
      </tr>` : ''}
    </tfoot>
  </table>

  <hr class="divider">
  <div class="thank-you">⭐ ${thankYou} ⭐</div>
  ${returnPolicy ? `<div class="return-policy">${returnPolicy}</div>` : ''}
  <hr class="divider">
  <div class="footer">${footerNote}<br>🕐 ${format(new Date(invoice.createdAt), 'dd MMM yyyy, hh:mm a')}</div>

  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=340,height=600,scrollbars=yes');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const change = paymentMethod === 'cash' && cashReceived
    ? Math.max(0, Number(cashReceived) - getTotal())
    : null;

  if (showSuccess && lastInvoice) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold">Payment Successful!</h2>
            <p className="text-green-100 text-sm mt-1">Invoice {lastInvoice.invoiceNumber}</p>
          </div>

          {/* Summary */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Customer', value: lastInvoice.customerName },
                { label: 'Cashier', value: lastInvoice.createdBy },
                { label: 'Payment', value: lastInvoice.paymentMethod.toUpperCase() },
                { label: 'Items', value: lastInvoice.items.length + ' item(s)' },
              ].map(d => (
                <div key={d.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{d.label}</p>
                  <p className="font-semibold text-gray-800 text-sm">{d.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 rounded-xl p-4 mb-5 flex items-center justify-between">
              <span className="font-medium text-gray-700">Total Charged</span>
              <span className="text-2xl font-bold text-indigo-600">Rs. {lastInvoice.total.toLocaleString()}</span>
            </div>
            {lastInvoice.cashReceived && (
              <div className="bg-green-50 rounded-xl p-3 mb-4 flex items-center justify-between text-sm">
                <span className="text-gray-600">Cash Received: <strong>Rs. {Number(lastInvoice.cashReceived).toLocaleString()}</strong></span>
                <span className="text-green-700 font-bold">Change: Rs. {Number(lastInvoice.cashChange || 0).toLocaleString()}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => printReceipt(lastInvoice, invoiceSettings)}
                className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-indigo-200 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
              >
                <Printer className="w-5 h-5" /> Reprint Receipt
              </button>
              <button
                onClick={() => setShowSuccess(false)}
                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-5 h-[calc(100vh-8rem)]">
      {showScanner && <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />}

      {/* LEFT: Product Search Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-800">Billing / POS</h1>
            {/* Cashier Badge */}
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              <div>
                <p className="text-xs text-gray-400">Cashier</p>
                <input
                  type="text"
                  value={cashierName}
                  onChange={e => setCashierName(e.target.value)}
                  className="text-sm font-semibold text-indigo-700 bg-transparent border-b border-dashed border-indigo-300 focus:border-indigo-600 focus:outline-none w-28 p-0"
                  placeholder="Cashier Name"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
                placeholder="Search by name, barcode, or category..."
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
                className="bg-white rounded-xl p-4 border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all text-left group relative"
              >
                {product.stock <= 0 && (
                  <span className="absolute top-2 right-2 bg-red-100 text-red-500 text-xs px-1.5 py-0.5 rounded-full font-medium">Out</span>
                )}
                {product.stock > 0 && product.stock <= product.minStock && (
                  <span className="absolute top-2 right-2 bg-orange-100 text-orange-500 text-xs px-1.5 py-0.5 rounded-full font-medium">Low</span>
                )}
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="font-semibold text-gray-800 text-sm line-clamp-1">{product.name}</p>
                <p className="text-xs text-gray-400 mb-1">{product.category}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-indigo-600 font-bold text-sm">Rs. {product.price.toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{product.stock} left</span>
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

      {/* RIGHT: Cart Panel */}
      <div className="w-96 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            <h2 className="font-semibold">Current Order</h2>
            {cart.length > 0 && (
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">{cart.length}</span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Customer Selection */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <button
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-indigo-300 transition-colors bg-gray-50"
            >
              <User className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-left text-gray-700 font-medium">{selectedCustomer?.name || 'Walk-in Customer'}</span>
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
                    👤 Walk-in Customer
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
              <p className="text-xs text-gray-300 mt-1">Click products to add</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.product.name}</p>
                    <p className="text-xs text-gray-400">Rs. {item.product.price.toLocaleString()} each</p>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-500 ml-2 p-0.5 hover:bg-red-50 rounded">
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
                    <span className="w-8 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
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
                        min={0} max={100}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
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

        {/* Bottom: Voucher + Summary + Payment */}
        <div className="p-3 border-t border-gray-100 space-y-3">
          {/* Voucher */}
          <div className="flex gap-2">
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
              <button onClick={() => { setVoucher(null); setVoucherCode(''); }} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm hover:bg-red-100 transition-colors">Remove</button>
            ) : (
              <button onClick={applyVoucher} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors">Apply</button>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>Rs. {getSubtotal().toLocaleString()}</span>
            </div>
            {getDiscount() > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span><span>-Rs. {getDiscount().toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-800 border-t border-gray-200 pt-1.5 mt-1">
              <span>Total</span>
              <span className="text-indigo-600 text-lg">Rs. {getTotal().toLocaleString()}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { method: 'cash', label: 'Cash', icon: Banknote },
              { method: 'card', label: 'Card', icon: CreditCard },
              { method: 'mobile', label: 'Mobile', icon: Smartphone },
            ].map(({ method, label, icon: Icon }) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method as any)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                  paymentMethod === method
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                    : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Cash calculation */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Cash received from customer..."
                />
              </div>
              {change !== null && change >= 0 && cashReceived && (
                <div className={`flex justify-between text-sm font-semibold rounded-lg px-3 py-2 ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Change to Return:</span>
                  <span>Rs. {change.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={loading || cart.length === 0}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold text-sm hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Processing...</>
            ) : (
              <><Printer className="w-4 h-4" /> Charge & Print Rs. {getTotal().toLocaleString()}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Billing;
