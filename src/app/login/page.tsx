'use client'

import { useState } from 'react';
import { login } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const result = await login(formData);

        if (result.success) {
            router.push('/admin/lookup');
            router.refresh();
        } else {
            setError(result.error || 'Login failed');
        }
        setLoading(false);
    }

    return (
        <div className="container flex items-center justify-center" style={{ minHeight: '80vh' }}>
            <div className="card animate-fade-in" style={{ maxWidth: '400px', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--secondary)', color: 'var(--primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <Lock size={32} />
                    </div>
                    <h1 className="page-title" style={{ fontSize: '1.75rem' }}>Admin Login</h1>
                    <p className="page-description">Enter your credentials to access the portal.</p>
                </div>

                {error && (
                    <div style={{ background: 'var(--destructive)', color: 'white', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid">
                    <div>
                        <label className="label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                            <input name="email" type="email" placeholder="admin@example.com" style={{ paddingLeft: '2.5rem' }} required />
                        </div>
                    </div>

                    <div>
                        <label className="label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                            <input name="password" type="password" placeholder="••••••••" style={{ paddingLeft: '2.5rem' }} required />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
