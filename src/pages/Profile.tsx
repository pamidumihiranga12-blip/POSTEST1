import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { updateUserProfile } from '../firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { User, Mail, Phone, Lock, Save, ShieldCheck, Calendar, Edit2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Profile: React.FC = () => {
  const { user, userProfile, setUserProfile } = useAuthStore();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    displayName: userProfile?.displayName || '',
    phone: userProfile?.phone || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSaveProfile = async () => {
    if (!profileForm.displayName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const uid = user?.uid;
      if (!uid) return;
      await updateUserProfile(uid, { displayName: profileForm.displayName, phone: profileForm.phone });
      setUserProfile({ ...userProfile!, ...profileForm });
      setEditingProfile(false);
      toast.success('Profile updated!');
    } catch (error) { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    setSaving(true);
    try {
      if (!user || !user.email) return;
      const credential = EmailAuthProvider.credential(user.email, passwordForm.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setEditingPassword(false);
      toast.success('Password changed successfully!');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect');
      } else {
        toast.error(error.message);
      }
    } finally { setSaving(false); }
  };

  const initials = userProfile?.displayName?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="h-28 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 relative">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 left-10 w-20 h-20 bg-white rounded-full"></div>
            <div className="absolute bottom-2 right-20 w-12 h-12 bg-white rounded-full"></div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-5">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
            <div className="flex items-center gap-2 pb-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${userProfile?.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                {userProfile?.role === 'admin' ? '⚡ Administrator' : '👤 Staff'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${userProfile?.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                {userProfile?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {!editingProfile ? (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-800">{userProfile?.displayName}</h2>
                <p className="text-gray-500 text-sm">{userProfile?.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {userProfile?.email || '—'}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {userProfile?.phone || 'Not set'}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {userProfile?.createdAt ? `Joined ${format(new Date(userProfile.createdAt), 'MMMM yyyy')}` : '—'}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShieldCheck className="w-4 h-4 text-gray-400" />
                  {userProfile?.role === 'admin' ? 'Full Access' : 'Standard Access'}
                </div>
              </div>
              <button
                onClick={() => { setProfileForm({ displayName: userProfile?.displayName || '', phone: userProfile?.phone || '' }); setEditingProfile(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Edit Profile
              </button>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
                <input
                  value={profileForm.displayName}
                  onChange={e => setProfileForm({ ...profileForm, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <input
                  value={profileForm.phone}
                  onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <input
                  value={userProfile?.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-100 rounded-xl bg-gray-50 text-sm text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingProfile(false)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-60">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Lock className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Password & Security</h3>
              <p className="text-xs text-gray-400">Keep your account secure</p>
            </div>
          </div>
          {!editingPassword && (
            <button
              onClick={() => setEditingPassword(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Change Password
            </button>
          )}
        </div>

        {editingPassword && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="••••••••"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setEditingPassword(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
              <button onClick={handleChangePassword} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-60">
                {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                Update Password
              </button>
            </div>
          </div>
        )}

        {!editingPassword && (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Password is set</p>
              <p className="text-xs text-gray-400">Your account is protected with a password</p>
            </div>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Account Information</h3>
        <div className="space-y-3">
          {[
            { label: 'User ID', value: user?.uid?.substring(0, 12) + '...', icon: User },
            { label: 'Email Verified', value: user?.emailVerified ? 'Yes' : 'No', icon: Mail },
            { label: 'Last Sign In', value: user?.metadata?.lastSignInTime ? format(new Date(user.metadata.lastSignInTime), 'MMM d, yyyy h:mm a') : '—', icon: Calendar },
            { label: 'Account Created', value: user?.metadata?.creationTime ? format(new Date(user.metadata.creationTime), 'MMM d, yyyy') : '—', icon: Calendar },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <item.icon className="w-4 h-4 text-gray-400" />
                {item.label}
              </div>
              <span className="text-sm font-medium text-gray-800">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Profile;
