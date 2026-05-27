import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  description?: string;
  warrantyMonths?: number;
  imageUrl?: string;
  supplierId?: string;
  supplierName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  totalPurchases: number;
  loyaltyPoints: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  voucherId?: string;
  status: 'paid' | 'pending' | 'cancelled';
  createdAt: string;
  createdBy: string;
}

export interface Voucher {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  expiryDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface WarrantyClaim {
  id: string;
  claimNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  productId: string;
  productName: string;
  barcode: string;
  invoiceNumber: string;
  purchaseDate: string;
  claimDate: string;
  issue: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  resolution?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  company?: string;
  balance: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCompany?: string;
  productId?: string;
  productName?: string;
  unitsPaid: number;
  costPerUnit: number;
  totalAmount: number;
  paymentMethod: string;
  note?: string;
  invoiceNumber: string;
  createdAt: string;
}

interface CartState {
  cart: CartItem[];
  selectedCustomer: Customer | null;
  appliedVoucher: Voucher | null;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateDiscount: (productId: string, discount: number) => void;
  clearCart: () => void;
  setCustomer: (customer: Customer | null) => void;
  setVoucher: (voucher: Voucher | null) => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getDiscount: () => number;
}

export const usePosStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],
      selectedCustomer: null,
      appliedVoucher: null,
      addToCart: (product, quantity = 1) => {
        const { cart } = get();
        const existingItem = cart.find(item => item.product.id === product.id);
        if (existingItem) {
          set({
            cart: cart.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + quantity, total: (item.quantity + quantity) * item.product.price * (1 - item.discount / 100) }
                : item
            )
          });
        } else {
          set({
            cart: [...cart, {
              product,
              quantity,
              discount: 0,
              total: quantity * product.price
            }]
          });
        }
      },
      removeFromCart: (productId) => {
        set({ cart: get().cart.filter(item => item.product.id !== productId) });
      },
      updateQuantity: (productId, quantity) => {
        set({
          cart: get().cart.map(item =>
            item.product.id === productId
              ? { ...item, quantity, total: quantity * item.product.price * (1 - item.discount / 100) }
              : item
          ).filter(item => item.quantity > 0)
        });
      },
      updateDiscount: (productId, discount) => {
        set({
          cart: get().cart.map(item =>
            item.product.id === productId
              ? { ...item, discount, total: item.quantity * item.product.price * (1 - discount / 100) }
              : item
          )
        });
      },
      clearCart: () => set({ cart: [], selectedCustomer: null, appliedVoucher: null }),
      setCustomer: (customer) => set({ selectedCustomer: customer }),
      setVoucher: (voucher) => set({ appliedVoucher: voucher }),
      getSubtotal: () => get().cart.reduce((sum, item) => sum + item.total, 0),
      getTotal: () => {
        const subtotal = get().getSubtotal();
        const voucher = get().appliedVoucher;
        if (!voucher) return subtotal;
        if (voucher.type === 'percentage') return subtotal * (1 - voucher.value / 100);
        return Math.max(0, subtotal - voucher.value);
      },
      getDiscount: () => {
        const subtotal = get().getSubtotal();
        return subtotal - get().getTotal();
      },
    }),
    { name: 'pos-cart' }
  )
);
