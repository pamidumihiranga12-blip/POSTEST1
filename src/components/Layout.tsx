import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, ShoppingCart, Package, Shield, Ticket,
  Users, FileText, BarChart3, LogOut, Menu,
  Zap, ChevronDown, Bell, Wifi, WifiOff, ShieldCheck, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/billing', label: 'Billing', icon: ShoppingCart },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/warranty', label: 'Warranty Claims', icon: Shield },
  { path: '/vouchers', label: 'Vouchers', icon: Ticket },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/invoices', label: 'Invoices', icon: FileText },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { userProfile, setUser, setUserProfile, isAdmin, setCustomAuth } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setCustomAuth(false);
      navigate('/login');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  const allNavItems = isAdmin()
    ? [...navItems,
        { path: '/admin', label: 'Admin Panel', icon: ShieldCheck },
        { path: '/invoice-settings', label: 'Receipt Settings', icon: Settings },
      ]
    : navItems;

  const NavItem = ({ path, label, icon: Icon }: { path: string; label: string; icon: any }) => (
    <NavLink
      to={path}
      onClick={() => setMobileOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
          isActive
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
            : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {sidebarOpen && <span>{label}</span>}
    </NavLink>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${!sidebarOpen && 'justify-center'}`}>
        <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex-shrink-0">
          <Zap className="w-5 h-5 text-yellow-300" />
        </div>
        {sidebarOpen && (
          <div>
            <p className="font-bold text-gray-800 leading-tight">SmartZone</p>
            <p className="text-xs text-indigo-500 font-medium">Point of Sale</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {allNavItems.map(item => (
          <NavItem key={item.path} {...item} />
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-gray-100">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors ${!sidebarOpen && 'justify-center'}`}
          onClick={() => navigate('/profile')}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{userProfile?.displayName || 'User'}</p>
              <p className="text-xs text-gray-400 truncate">{userProfile?.role === 'admin' ? 'Administrator' : 'Staff'}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors w-full mt-1 ${!sidebarOpen && 'justify-center'}`}
        >
          <LogOut className="w-4 h-4" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className={`hidden lg:flex flex-col bg-white border-r border-gray-100 shadow-sm transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(!mobileOpen); }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {isOnline ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <Wifi className="w-3 h-3" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-semibold text-sm">
                  {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{userProfile?.displayName}</span>
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <button onClick={() => { navigate('/profile'); setProfileOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    My Profile
                  </button>
                  <hr className="my-1 border-gray-100" />
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
