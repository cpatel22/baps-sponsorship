'use client'

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getRegistrations, getCurrentUser, sendEmailReminder, getRegistrationEventsWithDetails, getRegistrationsByYear, getRegistrationsByDate, getEmailTemplates } from '@/app/actions';
import { format } from 'date-fns';
import { Mail, Eye, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

// DataTables types
declare global {
    interface Window {
        $: any;
        jQuery: any;
    }
}

export default function Lookup() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    // Email reminder states
    const [emailTemplates, setEmailTemplates] = useState<any[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [sendingEmail, setSendingEmail] = useState(false);

    // View Details Modal State
    const [viewingRegistration, setViewingRegistration] = useState<any | null>(null);
    const [viewedEvents, setViewedEvents] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const tableRef = useRef<HTMLTableElement>(null);
    const dataTableRef = useRef<any>(null);

    const modalTableRef = useRef<HTMLTableElement>(null);
    const modalDataTableRef = useRef<any>(null);

    const router = useRouter();

    useEffect(() => {
        async function checkAuth() {
            const user = await getCurrentUser();
            if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
                router.push('/');
            }
        }
        checkAuth();
    }, []);

    useEffect(() => {
        loadAll();
        loadEmailTemplates();
    }, [selectedDate]);

    async function loadEmailTemplates() {
        try {
            const templates = await getEmailTemplates();
            setEmailTemplates(templates);
            if (templates.length > 0) {
                setSelectedTemplateId(templates[0].id);
            }
        } catch (error) {
            console.error('Error loading email templates:', error);
        }
    }

    useEffect(() => {
        // Load DataTables scripts and styles only once
        if (typeof window !== 'undefined' && !window.jQuery) {
            const jqueryScript = document.createElement('script');
            jqueryScript.id = 'jquery-script';
            jqueryScript.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
            jqueryScript.async = true;
            jqueryScript.onload = () => {
                const dtScript = document.createElement('script');
                dtScript.id = 'datatables-script';
                dtScript.src = 'https://cdn.datatables.net/1.13.7/js/jquery.dataTables.min.js';
                dtScript.async = true;
                document.body.appendChild(dtScript);
            };
            document.body.appendChild(jqueryScript);

            const dtStyles = document.createElement('link');
            dtStyles.id = 'datatables-styles';
            dtStyles.rel = 'stylesheet';
            dtStyles.href = 'https://cdn.datatables.net/1.13.7/css/jquery.dataTables.min.css';
            document.head.appendChild(dtStyles);
        }
    }, []);

    useEffect(() => {
        // Destroy DataTable on unmount
        return () => {
            if (dataTableRef.current) {
                try {
                    dataTableRef.current.destroy();
                    dataTableRef.current = null;
                } catch (e) {
                    console.log('DataTable cleanup error:', e);
                }
            }
            if (modalDataTableRef.current) {
                try {
                    modalDataTableRef.current.destroy();
                    modalDataTableRef.current = null;
                } catch (e) {
                    console.log('Modal DataTable cleanup error:', e);
                }
            }
        };
    }, []);

    useEffect(() => {
        // Initialize Modal DataTable when modal is open and data is loaded
        if (viewingRegistration && !loadingDetails && viewedEvents.length > 0 && window.jQuery && window.$.fn.DataTable) {
            // Use a slightly longer timeout to ensure React has fully rendered the table DOM
            const timer = setTimeout(() => {
                const tableEl = document.getElementById('modal-details-table');
                if (tableEl) {
                    // Clean up any potential existing instance
                    if (window.$.fn.DataTable.isDataTable(tableEl)) {
                        window.$(tableEl).DataTable().destroy();
                    }

                    modalDataTableRef.current = window.$(tableEl).DataTable({
                        pageLength: 5,
                        responsive: true,
                        destroy: true,
                        searching: true, // Enable search
                        info: true,      // Enable info
                        paging: true,    // Enable paging
                        lengthChange: false,
                        order: [[0, 'asc']], // Default sort by Date
                        language: {
                            emptyTable: "No events found",
                            search: "Filter events:"
                        }
                    });
                }
            }, 300);
            return () => {
                clearTimeout(timer);
                if (modalDataTableRef.current) {
                    // Check if table still exists before destroying to avoid errors
                    const tableEl = document.getElementById('modal-details-table');
                    if (tableEl && window.$.fn.DataTable.isDataTable(tableEl)) {
                        try {
                            modalDataTableRef.current.destroy();
                        } catch (e) { console.error(e); }
                    }
                    modalDataTableRef.current = null;
                }
            };
        }
    }, [viewingRegistration, loadingDetails, viewedEvents]);

    useEffect(() => {
        // Initialize DataTable only when we have registrations
        if (!loading && registrations.length > 0 && window.jQuery && window.$.fn.DataTable) {
            const timer = setTimeout(() => {
                initializeDataTable();
            }, 300);
            return () => {
                clearTimeout(timer);
            };
        }
    }, [registrations, loading]);

    const initializeDataTable = () => {
        if (!tableRef.current || !window.jQuery || !window.$.fn.DataTable) {
            return;
        }

        try {
            // Clear any existing DataTable classes/attributes
            window.$(tableRef.current).removeClass('dataTable');

            // Initialize new DataTable
            dataTableRef.current = window.$(tableRef.current).DataTable({
                pageLength: 10,
                responsive: true,
                destroy: true, // Allow re-initialization
                order: [[1, 'asc']],
                columnDefs: [
                    { orderable: false, targets: [0, 7] }
                ],
                language: {
                    search: "Search:",
                    lengthMenu: "_MENU_ entries per page",
                    info: "Showing _START_ to _END_ of _TOTAL_ entries",
                    paginate: {
                        first: "First",
                        last: "Last",
                        next: "Next",
                        previous: "Previous"
                    }
                }
            });
        } catch (error) {
            console.error('DataTable initialization error:', error);
            dataTableRef.current = null;
        }
    };

    async function loadAll() {
        // Destroy DataTable before loading new data
        if (dataTableRef.current && tableRef.current && window.jQuery && window.$.fn.DataTable) {
            try {
                if (window.$.fn.DataTable.isDataTable(tableRef.current)) {
                    dataTableRef.current.destroy();
                    dataTableRef.current = null;
                }
            } catch (e) {
                console.log('DataTable cleanup error:', e);
            }
        }

        setLoading(true);
        try {
            const data = await getRegistrationsByDate(selectedDate);
            setRegistrations(data || []);
            setSelectedUsers(new Set());
        } catch (error) {
            console.error('Error loading registrations:', error);
            setRegistrations([]);
            setSelectedUsers(new Set());
        } finally {
            setLoading(false);
        }
    }

    const handleViewDetails = async (reg: any) => {
        setViewingRegistration(reg);
        setLoadingDetails(true);
        try {
            const events = await getRegistrationEventsWithDetails(reg.id);
            setViewedEvents(events);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCheckboxChange = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleSendEmailReminder = async () => {
        if (selectedUsers.size === 0) {
            alert('Please select at least one user to send email reminder.');
            return;
        }

        if (!selectedTemplateId) {
            alert('Please select an email template.');
            return;
        }

        if (!confirm(`Send email reminder to ${selectedUsers.size} selected user(s)?`)) {
            return;
        }

        setSendingEmail(true);
        try {
            const userIds = Array.from(selectedUsers);
            const result = await sendEmailReminder(userIds, selectedTemplateId);
            
            if (result.success) {
                let message = `✅ Email sent successfully to ${result.count} user(s)!`;
                if (result.warning) {
                    message += `\n\n⚠️ ${result.warning}`;
                }
                alert(message);
                setSelectedUsers(new Set());
            } else {
                alert('❌ Failed to send emails: ' + result.error);
            }
        } catch (error: any) {
            alert('❌ Error sending emails: ' + error.message);
        } finally {
            setSendingEmail(false);
        }
    };

    return (
        <div className="container min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe] py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-[#1e293b] mb-2">Sponsorship Lookup</h1>
                <p className="text-[#64748b] text-lg hidden">Manage and monitor event registrations with ease.</p>
            </header>


            <div className="max-w-7xl mx-auto space-y-8">
                {/* Date Filter */}
                <div className="flex justify-end px-4">
                    <div className="relative flex items-center gap-3">
                       <label className="text-[#475569] font-semibold text-base hidden">Select Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="appearance-none bg-white border border-[#cbd5e1] hover:border-[#94a3b8] text-[#1e293b] py-2.5 pl-4 pr-4 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-[#3b82f6/20] focus:border-[#3b82f6] font-semibold shadow-sm transition-all cursor-pointer text-base"
                        />                        
                    </div>
                </div>
<hr className="mt-2"/>
                {/* DataTable */}
                <div
                    className="bg-white rounded-3xl shadow-xl border border-[#e2e8f0] overflow-hidden"
                    onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const btn = target.closest('.view-details-btn');
                        if (btn) {
                            const userId = btn.getAttribute('data-userid');
                            if (userId) {
                                const reg = registrations.find(r => String(r.id) === String(userId));
                                if (reg) {
                                    handleViewDetails(reg);
                                }
                            }
                        }
                    }}
                >
                    <div className="p-8">
                        <h2 className="text-2xl font-extrabold text-[#1e293b] mb-6 hidden">Registration Records</h2>

                        {loading ? (
                            <div className="py-20 text-center text-[#94a3b8]">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b82f6] mx-auto mb-4"></div>
                                Loading registrations...
                            </div>
                        ) : registrations.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="text-[#94a3b8] text-lg mb-2">No registration records found</div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table ref={tableRef} className="w-full display" style={{ width: '100%' }}>
                                    <thead>
                                        <tr className="bg-[#f1f5f9]">
                                            <th className="px-4 py-4 text-left">
                                                <input
                                                    type="checkbox"
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedUsers(new Set(registrations.map(r => r.id)));
                                                        } else {
                                                            setSelectedUsers(new Set());
                                                        }
                                                    }}
                                                    checked={selectedUsers.size === registrations.length && registrations.length > 0}
                                                    className="w-5 h-5 rounded border-2 border-[#cbd5e1] text-[#3b82f6] focus:ring-2 focus:ring-[#60a5fa]"
                                                />
                                            </th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">First Name</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Spouse Name</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Last Name</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Email</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Phone</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Sponsorship</th>
                                            <th className="px-4 py-4 text-left font-bold text-[#475569]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.map((reg) => (
                                            <tr key={reg.id} className="border-t border-[#e2e8f0] hover:bg-[#f8fafc] transition-colors">
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedUsers.has(reg.id)}
                                                        onChange={() => handleCheckboxChange(reg.id)}
                                                        className="w-5 h-5 rounded border-2 border-[#cbd5e1] text-[#3b82f6] focus:ring-2 focus:ring-[#60a5fa]"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 font-semibold text-[#1e293b]">{reg.first_name}</td>
                                                <td className="px-4 py-4 text-[#475569]">{reg.spouse_first_name}</td>
                                                <td className="px-4 py-4 text-[#475569]">{reg.last_name}</td>
                                                <td className="px-4 py-4 text-[#475569]">{reg.email}</td>
                                                <td className="px-4 py-4 text-[#475569]">{reg.phone}</td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${reg.sponsorship_type === 'gold' ? 'bg-[#fef3c7] text-[#92400e]' :
                                                        reg.sponsorship_type === 'silver' ? 'bg-[#e0f2fe] text-[#075985]' :
                                                            'bg-[#f1f5f9] text-[#475569]'
                                                        }`}>
                                                        {reg.sponsorship_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <button
                                                        data-userid={reg.id}
                                                        className="view-details-btn p-2 text-[#3b82f6] hover:bg-[#eff6ff] rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={20} className="pointer-events-none" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Email Reminder Section */}
                        {!loading && registrations.length > 0 && selectedUsers.size > 0 && (
                            <div style={{ 
                                borderTop: '2px solid #e2e8f0', 
                                paddingTop: '1.5rem', 
                                marginTop: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1', minWidth: '300px' }}>
                                    <label className="font-semibold text-[#475569]">
                                        Send Email to {selectedUsers.size} selected user(s):
                                    </label>
                                    <select
                                        value={selectedTemplateId}
                                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        className="flex-1 max-w-xs"
                                        style={{
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '0.5rem',
                                            border: '2px solid #cbd5e1',
                                            backgroundColor: 'white',
                                            color: '#1e293b',
                                            fontSize: '0.875rem',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                        disabled={sendingEmail}
                                    >
                                        {emailTemplates.length === 0 ? (
                                            <option value="">No templates available</option>
                                        ) : (
                                            emailTemplates.map((template) => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <button
                                    onClick={handleSendEmailReminder}
                                    disabled={sendingEmail || !selectedTemplateId || emailTemplates.length === 0}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '0.75rem',
                                        backgroundColor: sendingEmail ? '#94a3b8' : '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        cursor: sendingEmail ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
                                        transition: 'all 0.2s'
                                    }}
                                    className="hover:bg-[#2563eb] disabled:hover:bg-[#94a3b8]"
                                >
                                    {sendingEmail ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Mail size={18} />
                                            Send Email Reminder
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* View Details Modal */}
            {viewingRegistration && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex-col md:min-w-[500px]"
                        style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '42rem', maxHeight: '90vh', borderRadius: '1.5rem', overflow: 'hidden' }}
                    >
                        <div
                            className="p-6 border-b border-[#e2e8f0] flex justify-between items-center bg-[#f8fafc]"
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.8rem', borderBottom: '1px solid #e2e8f0' }}
                        >
                            <div>
                                <h3 className="text-2xl font-bold text-[#1e293b]">Registration Details</h3>
                                <p className="text-[#64748b]">
                                    {viewingRegistration.first_name} {viewingRegistration.spouse_first_name} {viewingRegistration.last_name}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setViewingRegistration(null);
                                    setViewedEvents([]);
                                }}
                                className="p-2 hover:bg-[#e2e8f0] rounded-full transition-colors text-[#64748b]"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div
                            className="p-6 overflow-y-auto"
                            style={{ padding: '0rem', overflowY: 'auto' }}
                        >
                            {loadingDetails ? (
                                <div className="py-10 text-center text-[#94a3b8]">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6] mx-auto mb-2"></div>
                                    Loading details...
                                </div>
                            ) : viewedEvents.length > 0 ? (
                                <table id="modal-details-table" ref={modalTableRef} className="w-full display" style={{ width: '100%' }}>
                                    <thead>
                                        <tr className="border-b border-[#e2e8f0]">
                                            <th className="text-left py-3 px-4 font-bold text-[#475569]">Date</th>
                                            <th className="text-left py-3 px-4 font-bold text-[#475569]">Event Type</th>
                                            <th className="text-left py-3 px-4 font-bold text-[#475569]">Event Name</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewedEvents.map((event, index) => {
                                            // For events without date selection, display quantity
                                            if (event.dateSelectionRequired === false || !event.date) {
                                                const quantityText = event.quantity === -1 ? 'All' : event.quantity || 1;
                                                return (
                                                    <tr key={index} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                                        <td className="py-3 px-4 text-[#1e293b]">
                                                            -
                                                        </td>
                                                        <td className="py-3 px-4 text-[#334155] font-medium">
                                                            {event.event_name}
                                                        </td>
                                                        <td className="py-3 px-4 text-[#64748b]">
                                                            {quantityText}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            
                                            // For events with date selection, display dates
                                            // Parse date as local date to avoid timezone issues
                                            const [year, month, day] = event.date.split('-').map(Number);
                                            const localDate = new Date(year, month - 1, day);
                                            
                                            return (
                                            <tr key={index} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                                <td className="py-3 px-4 text-[#1e293b]" data-order={localDate.getTime()}>
                                                    {format(localDate, 'MM/dd/yyyy')}
                                                </td>
                                                <td className="py-3 px-4 text-[#334155] font-medium">
                                                    {event.event_name}
                                                </td>
                                                <td className="py-3 px-4 text-[#64748b]">
                                                    {event.date_title || ''}
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-10 text-[#94a3b8]">
                                    No events found for this registration.
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
