'use client'


import { useState, useEffect, Suspense } from 'react';
import { getCurrentUser } from '@/app/actions';
import { useRouter, useSearchParams } from 'next/navigation';

import EventMaster from '@/components/admin/EventMaster';
import UserManagement from '@/components/admin/UserManagement';
import EmailConfiguration from '@/components/admin/EmailConfiguration';
import EmailTemplates from '@/components/admin/EmailTemplates';


function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = (searchParams.get('tab') as any) || 'event-master';
    const [activeTab, setActiveTab] = useState<'event-master' | 'user-manager' | 'email-settings' | 'email-template'>(initialTab);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const paramTab = searchParams.get('tab');
        if (paramTab && ['event-master', 'user-manager', 'email-settings', 'email-template'].includes(paramTab)) {
            setActiveTab(paramTab as any);
        }
    }, [searchParams]);

    const handleTabChange = (tab: 'event-master' | 'user-manager' | 'email-settings' | 'email-template') => {
        setActiveTab(tab);
        const newUrl = `/admin/settings?tab=${tab}`;
        router.push(newUrl, { scroll: false });
    };

    useEffect(() => {
        async function checkAuth() {
            const user = await getCurrentUser();
            if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
                router.push('/');
            } else {
                setLoading(false);
            }
        }
        checkAuth();
    }, []);

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <header className="page-header hidden">
                <h1 className="page-title">Settings</h1>
                <p className="page-description hidden">System Configuration</p>
            </header>

            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Tab Navigation */}
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    borderBottom: '2px solid #e2e8f0',
                    marginBottom: '0.5rem',
                    flexWrap: 'wrap'
                }}>
                    <button
                        onClick={() => handleTabChange('event-master')}
                        className={activeTab === 'event-master' ? 'btn-primary' : 'btn-secondary'}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'event-master' ? '3px solid #3b82f6' : 'none',
                            marginBottom: '-2px'
                        }}
                    >
                        Event Master
                    </button>
                    <button
                        onClick={() => handleTabChange('user-manager')}
                        className={activeTab === 'user-manager' ? 'btn-primary' : 'btn-secondary'}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'user-manager' ? '3px solid #3b82f6' : 'none',
                            marginBottom: '-2px'
                        }}
                    >
                        User Manager
                    </button>
                    <button
                        onClick={() => handleTabChange('email-settings')}
                        className={activeTab === 'email-settings' ? 'btn-primary' : 'btn-secondary'}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'email-settings' ? '3px solid #3b82f6' : 'none',
                            marginBottom: '-2px'
                        }}
                    >
                        Email Settings
                    </button>
                    <button
                        onClick={() => handleTabChange('email-template')}
                        className={activeTab === 'email-template' ? 'btn-primary' : 'btn-secondary'}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'email-template' ? '3px solid #3b82f6' : 'none',
                            marginBottom: '-2px'
                        }}
                    >
                        Email Templates
                    </button>
                </div>

                {/* Tab Content */}
                <div>
                    {activeTab === 'event-master' && <EventMaster />}
                    {activeTab === 'user-manager' && <UserManagement />}
                    {activeTab === 'email-settings' && <EmailConfiguration />}
                    {activeTab === 'email-template' && <EmailTemplates />}
                </div>
            </div>
        </div>
    );
}

export default function Settings() {
    return (
        <Suspense fallback={<div className="container">Loading...</div>}>
            <SettingsContent />
        </Suspense>
    );
}

