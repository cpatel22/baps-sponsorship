'use client'

import { useState, useEffect } from 'react';
import { getEmailTemplates, saveEmailTemplate, deleteEmailTemplate, getCurrentUser, getEmailSettings, saveEmailSettings, testEmailConfiguration } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Image } from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Save, Trash2, Plus, X, Image as ImageIcon, Minus, Mail, CheckCircle2 } from 'lucide-react';

const PLACEHOLDER_FIELDS = [
    { label: 'First Name', value: '{{first_name}}' },
    { label: 'Spouse First Name', value: '{{spouse_first_name}}' },
    { label: 'Last Name', value: '{{last_name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Phone', value: '{{phone}}' },
    { label: 'Address', value: '{{address}}' },
    { label: 'Sponsorship Type', value: '{{sponsorship_type}}' },
    { label: 'Event Name', value: '{{event_name}}' },
    { label: 'Event Date', value: '{{event_date}}' },
    { label: 'Event Title', value: '{{event_title}}' },
];

export default function Settings() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [templateName, setTemplateName] = useState('');
    const [toField, setToField] = useState('{{email}}');
    const [ccField, setCcField] = useState('');
    const [bccField, setBccField] = useState('');
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [showNewForm, setShowNewForm] = useState(false);
    const [focusedField, setFocusedField] = useState<'to' | 'cc' | 'bcc' | 'subject' | 'body'>('body');
    const [subjectCursorPos, setSubjectCursorPos] = useState(0);
    const [activeTab, setActiveTab] = useState<'email-settings' | 'email-template'>('email-settings');
    
    // Email Settings states
    const [emailFrom, setEmailFrom] = useState('');
    const [smtpServer, setSmtpServer] = useState('smtp.gmail.com');
    const [smtpPortTLS, setSmtpPortTLS] = useState(587);
    const [smtpPortSSL, setSmtpPortSSL] = useState(465);
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [connectionSecurity, setConnectionSecurity] = useState('TLS');
    const [replyToEmail, setReplyToEmail] = useState('');
    const [testingEmail, setTestingEmail] = useState(false);
    
    const router = useRouter();

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Image,
            TextStyle,
            FontFamily
        ],
        content: '',
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none min-h-[300px] p-4',
            },
        },
    });

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
        loadTemplates();
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

    async function loadTemplates() {
        const data = await getEmailTemplates();
        setTemplates(data);
        setLoading(false);
    }

    function handleNewTemplate() {
        setSelectedTemplate(null);
        setTemplateName('');
        setToField('{{email}}');
        setCcField('');
        setBccField('');
        setSubject('');
        editor?.commands.setContent('');
        setShowNewForm(true);
    }

    function handleSelectTemplate(template: any) {
        setSelectedTemplate(template);
        setTemplateName(template.name);
        setToField(template.to_field || '{{email}}');
        setCcField(template.cc_field || '');
        setBccField(template.bcc_field || '');
        setSubject(template.subject);
        editor?.commands.setContent(template.body);
        setShowNewForm(true);
    }

    function insertPlaceholder(placeholder: string) {
        if (focusedField === 'subject') {
            // Insert into subject field at cursor position
            const newSubject = subject.slice(0, subjectCursorPos) + placeholder + subject.slice(subjectCursorPos);
            setSubject(newSubject);
            setSubjectCursorPos(subjectCursorPos + placeholder.length);
        } else if (focusedField === 'to') {
            setToField(toField + placeholder);
        } else if (focusedField === 'cc') {
            setCcField(ccField + placeholder);
        } else if (focusedField === 'bcc') {
            setBccField(bccField + placeholder);
        } else {
            // Insert into editor
            editor?.commands.insertContent(placeholder);
        }
    }

    async function handleSave() {
        if (!templateName || !subject || !editor) return;

        const body = editor.getHTML();
        const result = await saveEmailTemplate(
            selectedTemplate?.id || null,
            templateName,
            toField,
            ccField,
            bccField,
            subject,
            body
        );

        if (result.success) {
            await loadTemplates();
            setShowNewForm(false);
            setSelectedTemplate(null);
            setTemplateName('');
            setToField('{{email}}');
            setCcField('');
            setBccField('');
            setSubject('');
            editor.commands.setContent('');
        }
    }

    async function handleDelete(id: string) {
        if (confirm('Are you sure you want to delete this template?')) {
            await deleteEmailTemplate(id);
            await loadTemplates();
            if (selectedTemplate?.id === id) {
                setShowNewForm(false);
                setSelectedTemplate(null);
                setTemplateName('');
                setSubject('');
                editor?.commands.setContent('');
            }
        }
    }

    function handleCancel() {
        setShowNewForm(false);
        setSelectedTemplate(null);
        setTemplateName('');
        setToField('{{email}}');
        setCcField('');
        setBccField('');
        setSubject('');
        editor?.commands.setContent('');
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

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <header className="page-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-description hidden">Settings</p>
            </header>

            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Tab Navigation */}
                <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    borderBottom: '2px solid #e2e8f0',
                    marginBottom: '2rem'
                }}>
                    <button
                        onClick={() => setActiveTab('email-settings')}
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
                        onClick={() => setActiveTab('email-template')}
                        className={activeTab === 'email-template' ? 'btn-primary' : 'btn-secondary'}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'email-template' ? '3px solid #3b82f6' : 'none',
                            marginBottom: '-2px'
                        }}
                    >
                        Email Template
                    </button>
                </div>

                {/* Email Settings Tab */}
                {activeTab === 'email-settings' && (
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
                )}

                {/* Email Template Tab */}
                {activeTab === 'email-template' && (
                <div className="grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr)', gap: '2rem', alignItems: 'start', width: '100%' }}>
                <div style={{ width: '300px', flexShrink: 0 }}>
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">Email Templates</h2>
                            <button
                                onClick={handleNewTemplate}
                                className="btn-primary"
                                style={{ padding: '0.5rem', display: 'flex' }}
                                title="New Template"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                        <div className="flex" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                            {templates.map(template => (
                                <div key={template.id} className="flex gap-2">
                                    <button
                                        onClick={() => handleSelectTemplate(template)}
                                        className={`flex-1 ${selectedTemplate?.id === template.id ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                                    >
                                        {template.name}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id)}
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', color: 'var(--destructive)' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {templates.length === 0 && (
                                <p className="text-muted-foreground text-sm">No templates yet. Create one!</p>
                            )}
                        </div>
                    </div>
                </div>

                {showNewForm && (
                    <div className="card" style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">
                                {selectedTemplate ? 'Edit Template' : 'New Template'}
                            </h2>
                            <button
                                onClick={handleCancel}
                                className="btn-secondary"
                                style={{ padding: '0.5rem', display: 'flex' }}
                                title="Cancel"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex" style={{ flexDirection: 'column', gap: '1.5rem' }}>
                            <div>
                                <label className="block mb-2 font-medium">Template Name</label>
                                <input
                                    type="text"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="e.g., Reminder Email"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">To</label>
                                <input
                                    type="text"
                                    value={toField}
                                    onChange={(e) => setToField(e.target.value)}
                                    onFocus={() => setFocusedField('to')}
                                    placeholder="Recipient email (use {{email}} for user's email)"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">CC (optional)</label>
                                <input
                                    type="text"
                                    value={ccField}
                                    onChange={(e) => setCcField(e.target.value)}
                                    onFocus={() => setFocusedField('cc')}
                                    placeholder="CC emails (comma separated)"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">BCC (optional)</label>
                                <input
                                    type="text"
                                    value={bccField}
                                    onChange={(e) => setBccField(e.target.value)}
                                    onFocus={() => setFocusedField('bcc')}
                                    placeholder="BCC emails (comma separated)"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    onFocus={(e) => {
                                        setFocusedField('subject');
                                        setSubjectCursorPos(e.target.selectionStart || 0);
                                    }}
                                    onClick={(e) => {
                                        setSubjectCursorPos((e.target as HTMLInputElement).selectionStart || 0);
                                    }}
                                    onKeyUp={(e) => {
                                        setSubjectCursorPos((e.target as HTMLInputElement).selectionStart || 0);
                                    }}
                                    placeholder="Email subject (you can use placeholders like {{first_name}})"
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Insert Fields</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {PLACEHOLDER_FIELDS.map(field => (
                                        <button
                                            key={field.value}
                                            onClick={() => insertPlaceholder(field.value)}
                                            className="btn-secondary"
                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                                        >
                                            {field.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block mb-2 font-medium">Email Body</label>
                                
                                {/* Unified Toolbar */}
                                <div style={{ 
                                    border: '1px solid #d1d5db', 
                                    borderRadius: '0.375rem 0.375rem 0 0',
                                    borderBottom: 'none',
                                    padding: '0.5rem',
                                    backgroundColor: '#f9fafb',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                    alignItems: 'center'
                                }}>
                                    {/* Text Formatting */}
                                    <button
                                        onClick={() => editor?.chain().focus().toggleBold().run()}
                                        className={`btn-secondary ${editor?.isActive('bold') ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Bold"
                                    >
                                        <strong>B</strong>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                                        className={`btn-secondary ${editor?.isActive('italic') ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Italic"
                                    >
                                        <em>I</em>
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleUnderline().run()}
                                        className={`btn-secondary ${editor?.isActive('underline') ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Underline"
                                    >
                                        <u>U</u>
                                    </button>
                                    
                                    <span style={{ borderLeft: '1px solid #d1d5db', height: '1.5rem' }}></span>
                                    
                                    {/* Headings */}
                                    <button
                                        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                                        className={`btn-secondary ${editor?.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Heading 1"
                                    >
                                        H1
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                                        className={`btn-secondary ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Heading 2"
                                    >
                                        H2
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                                        className={`btn-secondary ${editor?.isActive('heading', { level: 3 }) ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Heading 3"
                                    >
                                        H3
                                    </button>
                                    
                                    <span style={{ borderLeft: '1px solid #d1d5db', height: '1.5rem' }}></span>
                                    
                                    {/* Font Family */}
                                    <select
                                        onChange={(e) => {
                                            if (e.target.value === 'default') {
                                                editor?.chain().focus().unsetFontFamily().run();
                                            } else {
                                                editor?.chain().focus().setFontFamily(e.target.value).run();
                                            }
                                        }}
                                        className="btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', width: 'auto', minWidth: '100px' }}
                                        title="Font Family"
                                    >
                                        <option value="default">Default</option>
                                        <option value="Arial">Arial</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Georgia">Georgia</option>
                                        <option value="Courier New">Courier New</option>
                                        <option value="Verdana">Verdana</option>
                                    </select>
                                    
                                    <span style={{ borderLeft: '1px solid #d1d5db', height: '1.5rem' }}></span>
                                    
                                    {/* Lists */}
                                    <button
                                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                                        className={`btn-secondary ${editor?.isActive('bulletList') ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Bullet List"
                                    >
                                        • List
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                                        className={`btn-secondary ${editor?.isActive('orderedList') ? 'bg-gray-300' : ''}`}
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                        title="Numbered List"
                                    >
                                        1. List
                                    </button>
                                    
                                    <span style={{ borderLeft: '1px solid #d1d5db', height: '1.5rem' }}></span>
                                    
                                    {/* Media & Elements */}
                                    <button
                                        onClick={() => {
                                            const url = window.prompt('Enter image URL:');
                                            if (url) {
                                                editor?.chain().focus().setImage({ src: url }).run();
                                            }
                                        }}
                                        className="btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}
                                        title="Insert Image"
                                    >
                                        <ImageIcon size={14} />
                                    </button>
                                    <button
                                        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                                        className="btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}
                                        title="Horizontal Line"
                                    >
                                        <Minus size={14} />
                                    </button>
                                </div>
                                
                                {/* Editor Content */}
                                <div style={{ border: '1px solid #d1d5db', borderRadius: '0 0 0.375rem 0.375rem' }} onFocus={() => setFocusedField('body')}>
                                    <EditorContent editor={editor} />
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Use the buttons above to insert user fields and event dates. They will be replaced with actual values when sending emails.
                                </p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button
                                    onClick={handleSave}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                    disabled={!templateName || !subject}
                                >
                                    <Save size={18} />
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!showNewForm && (
                    <div className="card" style={{ minWidth: 0, maxWidth: '100%' }}>
                        <div className="flex items-center justify-center" style={{ minHeight: '400px', color: 'var(--muted-foreground)' }}>
                            <div className="text-center">
                                <p className="text-lg mb-2">No template selected</p>
                                <p className="text-sm">Select a template from the list or create a new one</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            )}
            </div>

            <style jsx global>{`
                .ProseMirror {
                    min-height: 300px;
                }
                .ProseMirror:focus {
                    outline: none;
                }
                .ProseMirror p {
                    margin: 0.5rem 0;
                }
                .ProseMirror h1 {
                    font-size: 2rem;
                    font-weight: bold;
                    margin: 1.5rem 0 0.75rem;
                }
                .ProseMirror h2 {
                    font-size: 1.5rem;
                    font-weight: bold;
                    margin: 1rem 0 0.5rem;
                }
                .ProseMirror h3 {
                    font-size: 1.25rem;
                    font-weight: bold;
                    margin: 0.75rem 0 0.5rem;
                }
                .ProseMirror ul {
                    padding-left: 1.5rem;
                    list-style-type: disc;
                }
                .ProseMirror ol {
                    padding-left: 1.5rem;
                    list-style-type: decimal;
                }
                .ProseMirror strong {
                    font-weight: bold;
                }
                .ProseMirror em {
                    font-style: italic;
                }
                .ProseMirror u {
                    text-decoration: underline;
                }
                .ProseMirror img {
                    max-width: 100%;
                    height: auto;
                    margin: 1rem 0;
                }
                .ProseMirror hr {
                    margin: 1.5rem 0;
                    border: none;
                    border-top: 2px solid #d1d5db;
                }
            `}</style>
        </div>
    );
}
