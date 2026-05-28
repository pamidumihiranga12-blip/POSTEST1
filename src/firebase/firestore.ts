import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  getDocs, query, where, orderBy, limit,
  setDoc, increment, arrayRemove, arrayUnion
} from 'firebase/firestore';
import { db } from './config';
import { Product, Customer, Invoice, Voucher, WarrantyClaim, Supplier, SupplierPayment } from '../store/posStore';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  VOUCHERS: 'vouchers',
  WARRANTY_CLAIMS: 'warrantyClaims',
  SUPPLIERS: 'suppliers',
  SUPPLIER_PAYMENTS: 'supplierPayments',
};

// Generate invoice number
export const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SZ-${year}${month}${day}-${random}`;
};

// Generate claim number
export const generateClaimNumber = () => {
  const date = new Date();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `WC-${date.getFullYear()}-${random}`;
};

// Products
export const getProducts = async () => {
  const q = query(collection(db, COLLECTIONS.PRODUCTS), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getProductByBarcode = async (barcode: string) => {
  const q = query(collection(db, COLLECTIONS.PRODUCTS), where('barcode', '==', barcode));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
};

export const addProduct = async (product: Omit<Product, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
    ...product,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateProduct = async (id: string, data: Partial<Product>) => {
  await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProduct = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.PRODUCTS, id));
};

export const getProductById = async (id: string) => {
  const docRef = doc(db, COLLECTIONS.PRODUCTS, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Product;
};

export const updateProductStock = async (id: string, newStock: number) => {
  await updateDoc(doc(db, COLLECTIONS.PRODUCTS, id), {
    stock: Math.max(0, newStock),
    updatedAt: new Date().toISOString(),
  });
};

export const getProductStats = async () => {
  const snapshot = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
  const products = snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      name: data.name || '',
      price: Number(data.price) || 0,
      costPrice: Number(data.costPrice) || 0,
      stock: Number(data.stock) || 0,
      minStock: Number(data.minStock) || 0,
      category: data.category || 'Other',
    } as Product;
  });

  const totalProducts = products.length;
  const lowStockCount = products.filter(p => (p.stock || 0) <= (p.minStock || 0) && (p.stock || 0) > 0).length;
  const outOfStockCount = products.filter(p => (p.stock || 0) <= 0).length;
  const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  const totalCostValue = products.reduce((sum, p) => sum + ((p.costPrice || 0) * (p.stock || 0)), 0);
  const categories = [...new Set(products.map(p => p.category || 'Other'))];

  return {
    totalProducts,
    lowStockCount,
    outOfStockCount,
    totalValue,
    totalCostValue,
    categoriesCount: categories.length,
  };
};

// Customers
export const getCustomers = async () => {
  const q = query(collection(db, COLLECTIONS.CUSTOMERS), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
};

export const addCustomer = async (customer: Omit<Customer, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.CUSTOMERS), {
    ...customer,
    createdAt: new Date().toISOString(),
    totalPurchases: 0,
    loyaltyPoints: 0,
  });
  return docRef.id;
};

export const updateCustomer = async (id: string, data: Partial<Customer>) => {
  await updateDoc(doc(db, COLLECTIONS.CUSTOMERS, id), data);
};

export const deleteCustomer = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.CUSTOMERS, id));
};

// Utility: remove all undefined values recursively (Firestore rejects undefined)
const stripUndefined = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return obj;
};

// Invoices
export const createInvoice = async (invoice: any) => {
  // Clean invoice — remove any undefined fields before saving to Firestore
  const cleanInvoice = stripUndefined({
    ...invoice,
    createdAt: new Date().toISOString(),
  });

  let docRef: any;
  try {
    docRef = await addDoc(collection(db, COLLECTIONS.INVOICES), cleanInvoice);
  } catch (err) {
    console.error('Error adding invoice document:', err);
    throw err;
  }

  // Update stock for each item (non-blocking — don't fail invoice if stock update fails)
  for (const item of invoice.items) {
    try {
      if (!item?.product?.id) continue;
      const productRef = doc(db, COLLECTIONS.PRODUCTS, item.product.id);
      if (item.imeiNumber) {
        // IMEI product: remove the specific IMEI from the array and decrement stock
        await updateDoc(productRef, {
          imeiNumbers: arrayRemove(item.imeiNumber),
          stock: Math.max(0, (item.product.stock || 0) - 1),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(productRef, {
          stock: Math.max(0, (item.product.stock || 0) - (item.quantity || 1)),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Stock update failed for product:', item?.product?.id, err);
    }
  }

  // Update customer loyalty points if customer exists (non-blocking)
  if (invoice.customerId) {
    try {
      const customerRef = doc(db, COLLECTIONS.CUSTOMERS, invoice.customerId);
      await updateDoc(customerRef, {
        totalPurchases: increment(invoice.total || 0),
        loyaltyPoints: increment(Math.floor((invoice.total || 0) / 100)),
      });
    } catch (err) {
      console.warn('Customer loyalty update failed:', err);
    }
  }

  // Update voucher usage if applied (non-blocking)
  if (invoice.voucherId) {
    try {
      const voucherRef = doc(db, COLLECTIONS.VOUCHERS, invoice.voucherId);
      await updateDoc(voucherRef, {
        usedCount: increment(1),
      });
    } catch (err) {
      console.warn('Voucher usage update failed:', err);
    }
  }

  return docRef.id;
};

export const getInvoices = async (limitCount = 100) => {
  const q = query(
    collection(db, COLLECTIONS.INVOICES),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
};

export const getInvoicesByDateRange = async (startDate: string, endDate: string) => {
  const q = query(
    collection(db, COLLECTIONS.INVOICES),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
};

// Vouchers
export const getVouchers = async () => {
  const q = query(collection(db, COLLECTIONS.VOUCHERS), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voucher));
};

export const getVoucherByCode = async (code: string) => {
  const q = query(collection(db, COLLECTIONS.VOUCHERS), where('code', '==', code.toUpperCase()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Voucher;
};

export const addVoucher = async (voucher: Omit<Voucher, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.VOUCHERS), {
    ...voucher,
    code: voucher.code.toUpperCase(),
    usedCount: 0,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateVoucher = async (id: string, data: Partial<Voucher>) => {
  await updateDoc(doc(db, COLLECTIONS.VOUCHERS, id), data);
};

export const deleteVoucher = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.VOUCHERS, id));
};

// Warranty Claims
export const getWarrantyClaims = async () => {
  const q = query(collection(db, COLLECTIONS.WARRANTY_CLAIMS), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarrantyClaim));
};

export const addWarrantyClaim = async (claim: Omit<WarrantyClaim, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.WARRANTY_CLAIMS), {
    ...claim,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateWarrantyClaim = async (id: string, data: Partial<WarrantyClaim>) => {
  await updateDoc(doc(db, COLLECTIONS.WARRANTY_CLAIMS, id), data);
};

// Users
export const getUsers = async () => {
  const q = query(collection(db, COLLECTIONS.USERS), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUserProfile = async (uid: string) => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const createUserProfile = async (uid: string, data: any) => {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    ...data,
    createdAt: new Date().toISOString(),
    isActive: true,
  });
};

export const updateUserProfile = async (uid: string, data: any) => {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), data);
};

export const deleteUserProfile = async (uid: string) => {
  await deleteDoc(doc(db, COLLECTIONS.USERS, uid));
};

// Dashboard stats
export const getDashboardStats = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [products, customers, invoices] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.PRODUCTS)),
    getDocs(collection(db, COLLECTIONS.CUSTOMERS)),
    getDocs(query(collection(db, COLLECTIONS.INVOICES), where('status', '==', 'paid'))),
  ]);

  const allInvoices = invoices.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
  const todayInvoices = allInvoices.filter(inv => inv.createdAt >= todayStr);
  const monthInvoices = allInvoices.filter(inv => inv.createdAt >= monthStart);

  const productsData = products.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  const lowStockProducts = productsData.filter(p => p.stock <= p.minStock);

  const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthSales = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const todayProfit = todayInvoices.reduce((sum, inv) => {
    const cost = inv.items.reduce((c, item) => c + (item.product.costPrice || 0) * item.quantity, 0);
    return sum + (inv.total - cost);
  }, 0);
  const monthProfit = monthInvoices.reduce((sum, inv) => {
    const cost = inv.items.reduce((c, item) => c + (item.product.costPrice || 0) * item.quantity, 0);
    return sum + (inv.total - cost);
  }, 0);

  return {
    todaySales,
    monthSales,
    todayProfit,
    monthProfit,
    totalProducts: productsData.length,
    lowStockCount: lowStockProducts.length,
    totalCustomers: customers.size,
    todayTransactions: todayInvoices.length,
    monthTransactions: monthInvoices.length,
    recentInvoices: allInvoices.slice(0, 5),
    lowStockProducts: lowStockProducts.slice(0, 5),
  };
};

// Invoice Settings
export const DEFAULT_INVOICE_SETTINGS = {
  businessName: 'SMART ZONE',
  tagline: 'Your Trusted Shopping Destination',
  address: '123 Main Street, City',
  phone: '+94 77 123 4567',
  email: 'info@smartzone.lk',
  website: 'www.smartzone.lk',
  thankYouMessage: 'Thank you for shopping with us!',
  returnPolicy: 'Returns accepted within 7 days with receipt.',
  footerNote: 'Powered by SMART ZONE',
  showLogo: true,
  showBarcode: false,
  primaryColor: '#111111',
  logoUrl: '',
  fontFamilySelection: 'English (Courier)',
  fontSizeSelection: 'medium',
};

export const getInvoiceSettings = async () => {
  const docRef = doc(db, 'settings', 'invoice');
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return DEFAULT_INVOICE_SETTINGS;
  return { ...DEFAULT_INVOICE_SETTINGS, ...snapshot.data() };
};

export const saveInvoiceSettings = async (settings: typeof DEFAULT_INVOICE_SETTINGS) => {
  await setDoc(doc(db, 'settings', 'invoice'), settings);
};

// Suppliers CRUD
export const getSuppliers = async () => {
  const q = query(collection(db, COLLECTIONS.SUPPLIERS), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
};

export const addSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.SUPPLIERS), {
    ...supplier,
    balance: Number(supplier.balance || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id;
};

export const updateSupplier = async (id: string, data: Partial<Supplier>) => {
  const updateData = { ...data };
  if (data.balance !== undefined) {
    updateData.balance = Number(data.balance);
  }
  await updateDoc(doc(db, COLLECTIONS.SUPPLIERS, id), {
    ...updateData,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteSupplier = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.SUPPLIERS, id));
};

export const adjustSupplierBalance = async (id: string, amount: number) => {
  await updateDoc(doc(db, COLLECTIONS.SUPPLIERS, id), {
    balance: increment(amount),
    updatedAt: new Date().toISOString(),
  });
};

// Supplier Payments
export const generateSupplierInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SP-${year}${month}${day}-${random}`;
};

export const addSupplierPayment = async (payment: Omit<SupplierPayment, 'id'>) => {
  const cleanPayment = stripUndefined({
    ...payment,
    createdAt: new Date().toISOString(),
  });
  const docRef = await addDoc(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), cleanPayment);
  return docRef.id;
};

export const getSupplierPayments = async (supplierId?: string) => {
  let q;
  if (supplierId) {
    q = query(
      collection(db, COLLECTIONS.SUPPLIER_PAYMENTS),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, COLLECTIONS.SUPPLIER_PAYMENTS),
      orderBy('createdAt', 'desc')
    );
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierPayment));
};

// Delete Customer Sales Invoice
export const deleteInvoice = async (id: string) => {
  const docRef = doc(db, COLLECTIONS.INVOICES, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const invoice = snapshot.data() as Invoice;

    // 1. Revert stock for each item
    if (invoice.items && Array.isArray(invoice.items)) {
      for (const item of invoice.items) {
        try {
          if (!item?.product?.id) continue;
          const productRef = doc(db, COLLECTIONS.PRODUCTS, item.product.id);
          if (item.imeiNumber) {
            // IMEI product: restore IMEI back to the array
            await updateDoc(productRef, {
              imeiNumbers: arrayUnion(item.imeiNumber),
              stock: increment(1),
              updatedAt: new Date().toISOString(),
            });
          } else {
            await updateDoc(productRef, {
              stock: increment(item.quantity || 1),
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn('Stock reversion failed for deleted invoice item:', item?.product?.id, err);
        }
      }
    }

    // 2. Revert customer loyalty points & purchases
    if (invoice.customerId) {
      try {
        const customerRef = doc(db, COLLECTIONS.CUSTOMERS, invoice.customerId);
        await updateDoc(customerRef, {
          totalPurchases: increment(-(invoice.total || 0)),
          loyaltyPoints: increment(-Math.floor((invoice.total || 0) / 100)),
        });
      } catch (err) {
        console.warn('Customer loyalty reversion failed:', err);
      }
    }

    // 3. Revert voucher usage count
    if (invoice.voucherId) {
      try {
        const voucherRef = doc(db, COLLECTIONS.VOUCHERS, invoice.voucherId);
        await updateDoc(voucherRef, {
          usedCount: increment(-1),
        });
      } catch (err) {
        console.warn('Voucher usage reversion failed:', err);
      }
    }
  }

  // 4. Delete the invoice doc
  await deleteDoc(docRef);
};

// Delete Supplier Payment Invoice
export const deleteSupplierPayment = async (id: string) => {
  const docRef = doc(db, COLLECTIONS.SUPPLIER_PAYMENTS, id);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const payment = snapshot.data() as SupplierPayment;

    // Revert supplier balance (increase balance by the payment total amount, since we no longer paid it)
    if (payment.supplierId && payment.totalAmount) {
      try {
        await adjustSupplierBalance(payment.supplierId, payment.totalAmount);
      } catch (err) {
        console.warn('Reverting supplier balance failed for deleted payment:', payment.supplierId, err);
      }
    }
  }

  // Delete the payment document
  await deleteDoc(docRef);
};
