import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { getUserProfile, createUserProfile } from '../../firebase/firestore';
import { useAuthStore, ADMIN_EMAIL } from '../../store/authStore';
import { Eye, EyeOff, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser, setUserProfile } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      let profile = await getUserProfile(user.uid) as any;
      if (!profile) {
        const newProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || data.email.split('@')[0],
          role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        await createUserProfile(user.uid, newProfile);
        profile = newProfile;
      }

      if (!profile.isActive && profile.email !== ADMIN_EMAIL) {
        toast.error('Your account has been deactivated. Contact admin.');
        await auth.signOut();
        return;
      }

      setUser(user);
      setUserProfile(profile);
      toast.success(`Welcome back, ${profile.displayName}!`);
      navigate('/dashboard');
    } catch (error: any) {
      const msg = error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password'
        ? 'Invalid email or password' : error.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src="/images/auth-bg.jpg" alt="POS" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-purple-900/80 to-violet-900/90"></div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
              <Zap className="w-10 h-10 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">SmartZone</h1>
              <p className="text-indigo-200 font-medium">Point of Sale</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-center mb-4">Manage Your Business Smarter</h2>
          <p className="text-indigo-200 text-center text-lg leading-relaxed max-w-md">
            Complete POS solution with real-time analytics, inventory management, customer tracking, and offline support.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-sm">
            {[
              { label: 'Products', icon: '📦' },
              { label: 'Analytics', icon: '📊' },
              { label: 'Customers', icon: '👥' },
              { label: 'Reports', icon: '📈' },
            ].map(item => (
              <div key={item.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Zap className="w-7 h-7 text-yellow-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">SmartZone POS</h1>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Welcome back</h2>
              <p className="text-gray-500 mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-gray-50"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-gray-50 pr-12"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Create account</Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            © 2024 SmartZone POS. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
