import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { createUserProfile } from '../../firebase/firestore';
import { ADMIN_EMAIL } from '../../store/authStore';
import { Eye, EyeOff, Zap, User, Mail, Phone, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface RegisterForm {
  displayName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();

  const onSubmit = async (data: RegisterForm) => {
    if (data.email === ADMIN_EMAIL) {
      toast.error('This email is reserved for admin use.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: data.displayName });
      await createUserProfile(user.uid, {
        uid: user.uid,
        email: data.email,
        displayName: data.displayName,
        phone: data.phone,
        password: data.password,
        role: 'user',
        isActive: true,
      });
      toast.success('Account created successfully! Please sign in.');
      await auth.signOut();
      navigate('/login');
    } catch (error: any) {
      const msg = error.code === 'auth/email-already-in-use'
        ? 'Email already registered' : error.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
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
          <h2 className="text-4xl font-bold text-center mb-4">Join SmartZone POS Today</h2>
          <p className="text-indigo-200 text-center text-lg leading-relaxed max-w-md">
            Start managing your business with our powerful and intuitive POS system. Free to get started.
          </p>
          <div className="mt-12 space-y-4 w-full max-w-sm">
            {[
              { text: 'Real-time inventory tracking', icon: '✅' },
              { text: 'Offline mode support', icon: '✅' },
              { text: 'Barcode scanning', icon: '✅' },
              { text: 'Customer management', icon: '✅' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                <span>{item.icon}</span>
                <p className="text-sm font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <Zap className="w-7 h-7 text-yellow-300" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">SmartZone POS</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create account</h2>
              <p className="text-gray-500 mt-1">Fill in your details to get started</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('displayName', { required: 'Name is required', minLength: { value: 2, message: 'Min 2 characters' } })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="pamidu mihiranga"
                  />
                </div>
                {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    {...register('phone', { required: 'Phone is required' })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="+94 78 680 0086"
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    {...register('confirmPassword', { required: 'Confirm your password', validate: v => v === watch('password') || 'Passwords do not match' })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    placeholder="••••••••"
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60 mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-gray-500 text-sm mt-5">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
