'use client'

import { useState, useEffect } from 'react';
import { getEmailTemplates, saveEmailTemplate, deleteEmailTemplate } from '@/app/actions';
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

export default function EmailTemplates() {
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
        loadTemplates();
    }, []);

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

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="grid" style={{ gridTemplateColumns: '300px minmax(0, 1fr)', gap: '2rem', alignItems: 'start', width: '100%' }}>
            <div style={{ width: '300px', flexShrink: 0 }}>
                <div className="card">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold hidden">Email Templates</h2>
                        <button
                            onClick={handleNewTemplate}
                            className="btn-primary"
                            style={{ padding: '0.5rem', display: 'flex' }}
                            title="New Template"
                        >
                            <Plus size={18} /> Add New Email Template
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
                }
            `}</style>
        </div>
    );
}
