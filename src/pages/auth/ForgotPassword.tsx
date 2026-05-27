import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Zap, Mail, ArrowLeft, CheckCircle, Phone, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'verify' | 'new-password' | 'sent';

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<Step>('verify');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    let valid = true;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      valid = false;
    } else setEmailError('');
    if (!phone || phone.trim().length < 6) {
      setPhoneError('Please enter your registered phone number');
      valid = false;
    } else setPhoneError('');
    return valid;
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('No account found with this email address.');
        setLoading(false);
        return;
      }
      const userData = snap.docs[0].data();
      const storedPhone = (userData.phone || '').replace(/\s+/g, '').replace(/-/g, '');
      const inputPhone = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
      if (storedPhone !== inputPhone) {
        toast.error('Phone number does not match our records.');
        setLoading(false);
        return;
      }
      setStep('new-password');
      toast.success('Identity verified! Enter your new password.');
    } catch (error: any) {
      toast.error(error.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('Account not found.');
        setLoading(false);
        return;
      }
      const userDoc = snap.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        password: newPassword
      });
      setStep('sent');
      toast.success('Password reset successful!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-200">
            <Zap className="w-7 h-7 text-yellow-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SmartZone POS</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {step === 'verify' ? (
            <>
              <div className="mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-7 h-7 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Verify Your Identity</h2>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  Enter your registered email and phone number. If they match, you'll be allowed to enter a new password.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-indigo-400" /> Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 transition-colors ${emailError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    placeholder="you@example.com"
                  />
                  {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-indigo-400" /> Registered Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 transition-colors ${phoneError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    placeholder="e.g. 0771234567"
                  />
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Both email and phone must match your account records to change your password.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Verifying...
                    </span>
                  ) : 'Verify & Continue'}
                </button>
              </form>
            </>
          ) : step === 'new-password' ? (
            <>
              <div className="mb-6">
                <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
                  <KeyRound className="w-7 h-7 text-violet-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Set New Password</h2>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  Your identity has been verified. Choose a secure new password for your account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 pr-12 transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-violet-200 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Saving Password...
                    </span>
                  ) : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Changed!</h2>
              <p className="text-gray-500 text-sm mb-4 leading-relaxed">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="w-full inline-block py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200"
              >
                Sign In Now
              </Link>
            </div>
          )}

          {step !== 'sent' && (
            <Link to="/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
