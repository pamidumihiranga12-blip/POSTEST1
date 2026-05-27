import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  getDocs, query, where, orderBy, limit,
  setDoc, increment
} from 'firebase/firestore';
import { db } from './config';
import { Product, Customer, Invoice, Voucher, WarrantyClaim } from '../store/posStore';

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  PRODUCTS: 'products',
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  VOUCHERS: 'vouchers',
  WARRANTY_CLAIMS: 'warrantyClaims',
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

// Invoices
export const createInvoice = async (invoice: Omit<Invoice, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.INVOICES), {
    ...invoice,
    createdAt: new Date().toISOString(),
  });

  // Update stock for each item
  for (const item of invoice.items) {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, item.product.id);
    await updateDoc(productRef, {
      stock: Math.max(0, item.product.stock - item.quantity),
      updatedAt: new Date().toISOString(),
    });
  }

  // Update customer loyalty points if customer exists
  if (invoice.customerId) {
    const customerRef = doc(db, COLLECTIONS.CUSTOMERS, invoice.customerId);
    await updateDoc(customerRef, {
      totalPurchases: increment(invoice.total),
      loyaltyPoints: increment(Math.floor(invoice.total / 100)),
    });
  }

  // Update voucher usage if applied
  if (invoice.voucherId) {
    const voucherRef = doc(db, COLLECTIONS.VOUCHERS, invoice.voucherId);
    await updateDoc(voucherRef, {
      usedCount: increment(1),
    });
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
