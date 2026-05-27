import React, { useState, useEffect } from 'react';
import { getUsers, updateUserProfile, deleteUserProfile } from '../firebase/firestore';
import { useAuthStore, ADMIN_EMAIL } from '../store/authStore';
import { ShieldCheck, Users, Edit2, Trash2, X, Save, CheckCircle, XCircle, Mail, Phone, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ displayName: '', phone: '', isActive: true, role: 'user' });
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/dashboard');
      return;
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const handleEdit = (usr: any) => {
    setEditingUser(usr);
    setEditForm({ displayName: usr.displayName, phone: usr.phone || '', isActive: usr.isActive, role: usr.role });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      await updateUserProfile(editingUser.uid || editingUser.id, editForm);
      toast.success('User updated!');
      setEditingUser(null);
      loadUsers();
    } catch (error) { toast.error('Failed to update user'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (usr: any) => {
    if (usr.email === ADMIN_EMAIL) { toast.error("Can't delete admin account"); return; }
    if (!confirm(`Delete user ${usr.displayName}?`)) return;
    try {
      await deleteUserProfile(usr.uid || usr.id);
      toast.success('User deleted from database');
      loadUsers();
    } catch { toast.error('Failed to delete'); }
  };

  const toggleActive = async (usr: any) => {
    if (usr.email === ADMIN_EMAIL) { toast.error("Can't deactivate admin"); return; }
    try {
      await updateUserProfile(usr.uid || usr.id, { isActive: !usr.isActive });
      toast.success(`User ${usr.isActive ? 'deactivated' : 'activated'}!`);
      loadUsers();
    } catch { toast.error('Failed to update'); }
  };

  const nonAdminUsers = users.filter(u => u.email !== ADMIN_EMAIL);
  const activeUsers = nonAdminUsers.filter(u => u.isActive);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-100 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-500 text-sm">Manage system users and permissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: nonAdminUsers.length, color: 'text-indigo-600 bg-indigo-50', icon: Users },
          { label: 'Active Users', value: activeUsers.length, color: 'text-green-600 bg-green-50', icon: CheckCircle },
          { label: 'Inactive Users', value: nonAdminUsers.length - activeUsers.length, color: 'text-red-500 bg-red-50', icon: XCircle },
          { label: 'Admin Accounts', value: 1, color: 'text-violet-600 bg-violet-50', icon: ShieldCheck },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center mb-2`}>
              <card.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Registered Users</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <div className="flex flex-col items-center text-gray-400 gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-sm">Loading users...</p>
                </div>
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No users found</p>
              </td></tr>
            ) : users.map(usr => (
              <tr key={usr.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${usr.email === ADMIN_EMAIL ? 'bg-indigo-50/30' : ''}`}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm ${usr.email === ADMIN_EMAIL ? 'bg-gradient-to-br from-indigo-500 to-violet-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                      {usr.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{usr.displayName}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {usr.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500">
                  {usr.phone ? (
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {usr.phone}</span>
                  ) : '—'}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${usr.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                    {usr.role === 'admin' ? '⚡ Admin' : 'Staff'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() => toggleActive(usr)}
                    disabled={usr.email === ADMIN_EMAIL}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${usr.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-red-50 text-red-500 hover:bg-red-100'} disabled:cursor-not-allowed`}
                  >
                    {usr.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {usr.createdAt ? format(new Date(usr.createdAt), 'MMM d, yyyy') : '—'}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handleEdit(usr)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {usr.email !== ADMIN_EMAIL && (
                      <button onClick={() => handleDelete(usr)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Edit User</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
                <input
                  value={editForm.displayName}
                  onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              {editingUser.email !== ADMIN_EMAIL && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="user">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={editForm.isActive}
                      onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <label htmlFor="isActive" className="text-sm text-gray-700">Account Active</label>
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
