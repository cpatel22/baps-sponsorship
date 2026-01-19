'use client'

import { useState, useEffect } from 'react';
import { getAllUsers, updateUser, addUser, deleteUser, getCurrentUser } from '@/app/actions';
import { User, Shield, Mail, Key, Trash2, Plus, X, Save, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UserManagement() {
    const [users, setUsers] = useState<any[]>([]);
    const [currAdmin, setCurrAdmin] = useState<any>(null);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const user = await getCurrentUser();
            if (!user) {
                router.push('/login');
            }
        }
        checkAuth();
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const [allUsers, me] = await Promise.all([getAllUsers(), getCurrentUser()]);
        setUsers(allUsers);
        setCurrAdmin(me);
        setLoading(false);
    }

    const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        if (editingUser) {
            await updateUser(editingUser.id, data);
        } else {
            await addUser(data);
        }

        setEditingUser(null);
        setShowAddForm(false);
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (id === currAdmin?.id) {
            alert("You cannot delete your own account!");
            return;
        }
        if (confirm('Are you sure you want to delete this user?')) {
            await deleteUser(id);
            loadData();
        }
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <header className="page-header flex justify-between items-center">
                <div>
                    <h1 className="page-title">Admin User Management</h1>
                    <p className="page-description">Manage access, roles, and security settings for the admin portal.</p>
                </div>
                <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2">
                    <Plus size={18} /> Add New User
                </button>
            </header>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {users.map(user => (
                    <div key={user.id} className="card animate-fade-in">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-secondary p-3 rounded-full">
                                    <User size={20} className="text-primary" />
                                </div>
                                <div>
                                    <div className="font-bold">{user.email}</div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground uppercase tracking-wider font-bold">
                                        <Shield size={12} /> {user.role.replace('_', ' ')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingUser(user)} className="btn-secondary p-2">
                                    <Settings size={16} />
                                </button>
                                {user.id !== currAdmin?.id && (
                                    <button onClick={() => handleDelete(user.id)} className="btn-secondary p-2 text-destructive">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid" style={{ gap: '0.5rem', fontSize: '0.875rem' }}>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail size={14} /> Recovery: {user.recovery_email || 'Not set'}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {(editingUser || showAddForm) && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div className="card animate-fade-in" style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <button onClick={() => { setEditingUser(null); setShowAddForm(false); }} className="btn-secondary p-2">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveUser} className="grid">
                            <div>
                                <label className="label">Email Address</label>
                                <input name="email" type="email" defaultValue={editingUser?.email} required />
                            </div>

                            <div>
                                <label className="label">{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                                <input name="password" type="password" required={!editingUser} />
                            </div>

                            <div>
                                <label className="label">Role</label>
                                <select name="role" defaultValue={editingUser?.role || 'admin'}>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">Recovery Email</label>
                                <input name="recovery_email" type="email" defaultValue={editingUser?.recovery_email} required />
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => { setEditingUser(null); setShowAddForm(false); }} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary flex items-center gap-2">
                                    <Save size={18} /> {editingUser ? 'Update User' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
