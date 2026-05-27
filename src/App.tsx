import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { getUserProfile, createUserProfile, updateUserProfile } from './firebase/firestore';
import { useAuthStore, ADMIN_EMAIL } from './store/authStore';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Main Pages
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Products from './pages/Products';
import Warranty from './pages/Warranty';
import Vouchers from './pages/Vouchers';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import Profile from './pages/Profile';
import Suppliers from './pages/Suppliers';
import InvoiceSettings from './pages/InvoiceSettings';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium">Loading SmartZone POS...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  const { setUser, setUserProfile, setLoading } = useAuthStore();

  useEffect(() => {
    const state = useAuthStore.getState();
    if (state.isCustomAuth && state.user && state.userProfile) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let profile = await getUserProfile(firebaseUser.uid) as any;
          if (!profile) {
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              role: firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              isActive: true,
            };
            await createUserProfile(firebaseUser.uid, newProfile);
            profile = newProfile;
          }
          if (profile.email === ADMIN_EMAIL && !profile.isActive) {
            profile.isActive = true;
            await updateUserProfile(firebaseUser.uid, { isActive: true });
          }
          setUserProfile(profile);
        } catch (error) {
          console.error('Failed to load user profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            background: '#1e293b',
            color: '#f8fafc',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#f8fafc' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f8fafc' },
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute><Suppliers /></ProtectedRoute>} />
        <Route path="/warranty" element={<ProtectedRoute><Warranty /></ProtectedRoute>} />
        <Route path="/vouchers" element={<ProtectedRoute><Vouchers /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Admin Only */}
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="/invoice-settings" element={<AdminRoute><InvoiceSettings /></AdminRoute>} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
