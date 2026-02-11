'use client'

import { useState, useEffect } from 'react';
import { getEmailSettings, saveEmailSettings, testEmailConfiguration } from '@/app/actions';
import { Save, CheckCircle2 } from 'lucide-react';

export default function EmailConfiguration() {
    const [emailFrom, setEmailFrom] = useState('');
    const [smtpServer, setSmtpServer] = useState('smtp.gmail.com');
    const [smtpPortTLS, setSmtpPortTLS] = useState(587);
    const [smtpPortSSL, setSmtpPortSSL] = useState(465);
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [connectionSecurity, setConnectionSecurity] = useState('TLS');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [testingEmail, setTestingEmail] = useState(false);

    useEffect(() => {
        loadEmailSettings();
    }, []);

    async function loadEmailSettings() {
        const settings = await getEmailSettings();
        if (settings) {
            setEmailFrom(settings.email_from || '');
            setSmtpServer(settings.smtp_server || 'smtp.gmail.com');
            setSmtpPortTLS(settings.smtp_port_tls || 587);
            setSmtpPortSSL(settings.smtp_port_ssl || 465);
            setSmtpUsername(settings.smtp_username || '');
            setSmtpPassword(settings.smtp_password || '');
            setConnectionSecurity(settings.connection_security || 'TLS');
            setReplyToEmail(settings.reply_to_email || '');
        }
    }

    async function handleSaveEmailSettings() {
        const result = await saveEmailSettings({
            emailFrom,
            smtpServer,
            smtpPortTLS,
            smtpPortSSL,
            smtpUsername,
            smtpPassword,
            connectionSecurity,
            replyToEmail
        });

        if (result.success) {
            alert('Email settings saved successfully!');
        }
    }

    async function handleTestEmailConfiguration() {
        if (!emailFrom || !smtpServer || !smtpUsername || !smtpPassword) {
            alert('Please fill in all required fields before testing.');
            return;
        }

        const testEmailTo = prompt('Enter email address to send test email to:', smtpUsername);
        if (!testEmailTo) return;

        setTestingEmail(true);
        try {
            const result = await testEmailConfiguration({
                emailFrom,
                smtpServer,
                smtpPortTLS,
                smtpPortSSL,
                smtpUsername,
                smtpPassword,
                connectionSecurity,
                replyToEmail,
                testEmailTo
            });

            if (result.success) {
                alert('✅ ' + result.message);
            } else {
                alert('❌ ' + result.message);
            }
        } catch (error: any) {
            alert('❌ Failed to test email configuration: ' + error.message);
        } finally {
            setTestingEmail(false);
        }
    }

    return (
        <div className="card">
            <h2 className="text-lg font-bold mb-4">Email Settings</h2>

            <div className="flex" style={{ flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                    <label className="block mb-2 font-medium">Email From</label>
                    <input
                        type="email"
                        value={emailFrom}
                        onChange={(e) => setEmailFrom(e.target.value)}
                        placeholder="e.g., noreply@yourdomain.com"
                        style={{ width: '100%' }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">The email address that will appear as the sender</p>
                </div>

                <div>
                    <label className="block mb-2 font-medium">SMTP Server Address</label>
                    <input
                        type="text"
                        value={smtpServer}
                        onChange={(e) => setSmtpServer(e.target.value)}
                        placeholder="smtp.gmail.com"
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label className="block mb-2 font-medium">SMTP Port (TLS)</label>
                        <input
                            type="number"
                            value={smtpPortTLS}
                            onChange={(e) => setSmtpPortTLS(parseInt(e.target.value) || 587)}
                            placeholder="587"
                            style={{ width: '100%' }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">Recommended</p>
                    </div>

                    <div>
                        <label className="block mb-2 font-medium">SMTP Port (SSL)</label>
                        <input
                            type="number"
                            value={smtpPortSSL}
                            onChange={(e) => setSmtpPortSSL(parseInt(e.target.value) || 465)}
                            placeholder="465"
                            style={{ width: '100%' }}
                        />
                        <p className="text-sm text-muted-foreground mt-1">Alternative</p>
                    </div>
                </div>

                <div>
                    <label className="block mb-2 font-medium">Authentication</label>
                    <div style={{
                        padding: '0.75rem',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '0.375rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        <strong>Required: Yes</strong>
                        <p className="text-sm text-muted-foreground mt-1">SMTP authentication is required for sending emails</p>
                    </div>
                </div>

                <div>
                    <label className="block mb-2 font-medium">Username</label>
                    <input
                        type="text"
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                        placeholder="user@gmail.com"
                        style={{ width: '100%' }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">Your full Gmail address</p>
                </div>

                <div>
                    <label className="block mb-2 font-medium">Password</label>
                    <input
                        type="password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        placeholder="App Password (16-character code)"
                        style={{ width: '100%' }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        Your App Password (16-character code).
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                            Generate App Password
                        </a>
                    </p>
                </div>

                <div>
                    <label className="block mb-2 font-medium">Connection Security</label>
                    <select
                        value={connectionSecurity}
                        onChange={(e) => setConnectionSecurity(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    >
                        <option value="TLS">TLS (Recommended)</option>
                        <option value="SSL">SSL</option>
                    </select>
                </div>

                <div>
                    <label className="block mb-2 font-medium">Default Reply-To Email</label>
                    <input
                        type="email"
                        value={replyToEmail}
                        onChange={(e) => setReplyToEmail(e.target.value)}
                        placeholder="e.g., support@yourdomain.com"
                        style={{ width: '100%' }}
                    />
                    <p className="text-sm text-muted-foreground mt-1">Email address for replies (optional)</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '1rem' }}>
                    <button
                        onClick={handleTestEmailConfiguration}
                        className="btn-secondary"
                        disabled={testingEmail}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            backgroundColor: testingEmail ? '#d1d5db' : '#10b981',
                            color: 'white',
                            border: 'none'
                        }}
                        title="Send test email to verify configuration"
                    >
                        {testingEmail ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Testing...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={18} />
                                Test Configuration
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleSaveEmailSettings}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Save size={18} />
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
