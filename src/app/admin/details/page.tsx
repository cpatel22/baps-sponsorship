'use client'

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getRegistrations, getCurrentUser, sendEmailReminder, getRegistrationEventsWithDetails, getRegistrationsByYear, getAvailableEventDatesForRegistration, addManualRegistrationDates } from '@/app/actions';
import { format } from 'date-fns';
import { Mail, Eye, X, Plus, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
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
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // View Details Modal State
    const [viewingRegistration, setViewingRegistration] = useState<any | null>(null);
    const [viewedEvents, setViewedEvents] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Add Manual Event Modal State
    const [addingToRegistration, setAddingToRegistration] = useState<any | null>(null);
    const [availableDates, setAvailableDates] = useState<any[]>([]);
    const [selectedManualDates, setSelectedManualDates] = useState<Set<string>>(new Set());
    const [manualNotes, setManualNotes] = useState('');
    const [loadingAvailable, setLoadingAvailable] = useState(false);
    const [savingManual, setSavingManual] = useState(false);
    const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

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
    }, [selectedYear]);

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
            const data = await getRegistrationsByYear(selectedYear.toString());
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

    const handleStartAddEvent = async (reg: any) => {
        setAddingToRegistration(reg);
        setLoadingAvailable(true);
        setSelectedManualDates(new Set());
        setExpandedMonths(new Set());
        setManualNotes('');
        try {
            const dates = await getAvailableEventDatesForRegistration(reg.id, selectedYear.toString());
            setAvailableDates(dates);
        } catch (error) {
            console.error('Error loading available dates:', error);
            setAvailableDates([]);
        } finally {
            setLoadingAvailable(false);
        }
    };

    const handleSaveManualEvents = async () => {
        if (!addingToRegistration || selectedManualDates.size === 0) return;
        if (!manualNotes.trim()) {
            alert('Notes are required.');
            return;
        }

        setSavingManual(true);
        try {
            // Convert set of "eventId|date" to array of objects
            const selections = Array.from(selectedManualDates).map(str => {
                const [eventId, date] = str.split('|');
                return { eventId, date };
            });

            const result = await addManualRegistrationDates(addingToRegistration.id, selections, manualNotes);
            if (result.success) {
                setAddingToRegistration(null);
                setAvailableDates([]);
                setSelectedManualDates(new Set());
                setExpandedMonths(new Set());
                setManualNotes('');
                // Refresh data
                loadAll();
            } else {
                alert('Failed to save events: ' + result.error);
            }
        } catch (error) {
            console.error('Error saving manual events:', error);
            alert('An unexpected error occurred.');
        } finally {
            setSavingManual(false);
        }
    };

    return (
        <div className="container min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe] py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-[#1e293b] mb-2">Sponsorship Details</h1>
                <p className="text-[#64748b] text-lg hidden">Manage and monitor event registrations with ease.</p>
            </header>

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Year Filter */}
                <div className="flex justify-end px-4">
                    <div className="relative flex items-center gap-3">
                        <label className="text-[#475569] font-semibold text-base hidden">Year:</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="appearance-none bg-white border border-[#cbd5e1] hover:border-[#94a3b8] text-[#1e293b] py-2.5 pl-4 pr-10 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-[#3b82f6/20] focus:border-[#3b82f6] font-semibold shadow-sm transition-all cursor-pointer text-base"
                        >
                            {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i).map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <hr className="mt-2" />
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
                                                    <div className="flex gap-2">
                                                        <button
                                                            data-userid={reg.id}
                                                            className="view-details-btn p-2 text-[#3b82f6] hover:bg-[#eff6ff] rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye size={20} className="pointer-events-none" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartAddEvent(reg);
                                                            }}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Add Manual Event"
                                                        >
                                                            <Plus size={20} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
                                            if (event.dateSelectionRequired === false || !event.date || event.date.trim() === '') {
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
                                            try {
                                                // Parse date as local date to avoid timezone issues
                                                const dateParts = event.date.split('-');
                                                if (dateParts.length !== 3) {
                                                    throw new Error('Invalid date format');
                                                }
                                                const [year, month, day] = dateParts.map(Number);
                                                if (isNaN(year) || isNaN(month) || isNaN(day)) {
                                                    throw new Error('Invalid date values');
                                                }
                                                const localDate = new Date(year, month - 1, day);

                                                // Check if date is valid
                                                if (isNaN(localDate.getTime())) {
                                                    throw new Error('Invalid date');
                                                }

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
                                            } catch (err) {
                                                // If date parsing fails, show as quantity event
                                                return (
                                                    <tr key={index} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                                        <td className="py-3 px-4 text-[#1e293b]">
                                                            Invalid Date
                                                        </td>
                                                        <td className="py-3 px-4 text-[#334155] font-medium">
                                                            {event.event_name}
                                                        </td>
                                                        <td className="py-3 px-4 text-[#64748b]">
                                                            {event.date_title || event.date}
                                                        </td>
                                                    </tr>
                                                );
                                            }
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

            {/* Add Manual Event Modal */}
            {addingToRegistration && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative"
                        style={{ backgroundColor: 'white', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '48rem', maxHeight: '90vh', borderRadius: '1.5rem', overflow: 'hidden', position: 'relative' }}
                    >
                        {/* Header */}
                        <div
                            className="px-8 pt-8 pb-4 flex justify-between items-start bg-white shrink-0"
                            style={{ padding: '2rem 2rem 1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: 'white', flexShrink: 0 }}
                        >
                            <div>
                                <h3 className="text-2xl font-bold text-slate-800">Add Events</h3>
                                <p className="text-slate-500 mt-1 font-medium">
                                    {addingToRegistration.first_name} {addingToRegistration.spouse_first_name} {addingToRegistration.last_name} <span className="text-slate-400">|</span> {selectedYear}
                                </p>
                            </div>
                            <button
                                onClick={() => setAddingToRegistration(null)}
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-600"
                                aria-label="Close modal"
                            >
                                <X size={20} className="stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Body */}
                        <div
                            className="px-8 py-2 overflow-y-auto flex-1 custom-scrollbar"
                            style={{ padding: '0.5rem 2rem', overflowY: 'auto', flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}
                        >
                            {loadingAvailable ? (
                                <div className="py-20 text-center text-slate-400" style={{ padding: '5rem 0', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 className="animate-spin h-10 w-10 mx-auto mb-3 text-blue-500" style={{ height: '2.5rem', width: '2.5rem', margin: '0 auto 0.75rem auto', color: '#3b82f6' }} />
                                    Loading available events...
                                </div>
                            ) : availableDates.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200" style={{ textAlign: 'center', padding: '5rem 0', backgroundColor: '#f8fafc', borderRadius: '1rem', border: '1px dashed #e2e8f0' }}>
                                    <p className="text-slate-500 font-medium" style={{ color: '#64748b', fontWeight: 500 }}>No available events found for {selectedYear}.</p>
                                </div>
                            ) : (
                                <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {/* Month Groups */}
                                    <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {(() => {
                                            const months = Array.from(new Set(availableDates.map(d => d.date.substring(0, 7)))).sort();

                                            return months.map(month => {
                                                const monthDates = availableDates.filter(d => d.date.startsWith(month));
                                                // Create date with time to avoid timezone shift
                                                const monthLabel = format(new Date(month + '-01T12:00:00'), 'MMM yyyy');
                                                const isExpanded = expandedMonths.has(month);
                                                const selectedCount = monthDates.filter(d => selectedManualDates.has(`${d.event_id}|${d.date}`)).length;

                                                return (
                                                    <div
                                                        key={month}
                                                        className={`border transition-all duration-200 rounded-xl overflow-hidden ${isExpanded ? 'border-blue-200 shadow-sm ring-1 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newExpanded = new Set(expandedMonths);
                                                                if (isExpanded) newExpanded.delete(month);
                                                                else newExpanded.add(month);
                                                                setExpandedMonths(newExpanded);
                                                            }}
                                                            className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50'}`}
                                                            type="button"
                                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                                        >
                                                            <div className="flex items-center font-bold text-slate-700 text-lg" style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', color: '#334155', fontSize: '1.125rem' }}>
                                                                <div className={`mr-3 p-1 rounded-lg transition-transform duration-200 ${isExpanded ? 'bg-blue-200/50 text-blue-700 rotate-180' : 'bg-slate-100 text-slate-500'}`} style={{ marginRight: '0.75rem', padding: '0.25rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <ChevronDown size={18} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                                                </div>
                                                                {monthLabel}
                                                                {selectedCount > 0 && (
                                                                    <span className="ml-3 bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm" style={{ marginLeft: '0.75rem', backgroundColor: '#2563eb', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.625rem', borderRadius: '9999px' }}>
                                                                        {selectedCount} events
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8', backgroundColor: 'white', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #f1f5f9' }}>
                                                                {monthDates.length} options
                                                            </span>
                                                        </button>

                                                        {isExpanded && (
                                                            <div className="p-2 bg-white border-t border-blue-100/50" style={{ padding: '0.5rem', backgroundColor: 'white', borderTop: '1px solid rgba(219, 234, 254, 0.5)' }}>
                                                                <div className="grid grid-cols-1 gap-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: '0.25rem' }}>
                                                                    {monthDates.map(date => (
                                                                        <div
                                                                            key={`${date.event_id}|${date.date}`}
                                                                            onClick={() => {
                                                                                const val = `${date.event_id}|${date.date}`;
                                                                                const newSet = new Set(selectedManualDates);
                                                                                if (selectedManualDates.has(val)) newSet.delete(val);
                                                                                else newSet.add(val);
                                                                                setSelectedManualDates(newSet);
                                                                            }}
                                                                            className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all ${selectedManualDates.has(`${date.event_id}|${date.date}`) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', border: selectedManualDates.has(`${date.event_id}|${date.date}`) ? '1px solid #dbeafe' : '1px solid transparent', backgroundColor: selectedManualDates.has(`${date.event_id}|${date.date}`) ? '#eff6ff' : 'transparent' }}
                                                                        >
                                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedManualDates.has(`${date.event_id}|${date.date}`) ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`} style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', border: selectedManualDates.has(`${date.event_id}|${date.date}`) ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: selectedManualDates.has(`${date.event_id}|${date.date}`) ? '#2563eb' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                {selectedManualDates.has(`${date.event_id}|${date.date}`) && <Check size={12} className="text-white stroke-[3]" style={{ color: 'white' }} />}
                                                                            </div>
                                                                            <div className="flex-1" style={{ flex: '1 1 0%' }}>
                                                                                <div className="font-semibold text-slate-700" style={{ fontWeight: 600, color: '#334155' }}>
                                                                                    {date.event_name}
                                                                                </div>
                                                                                <div className="text-sm text-slate-500" style={{ fontSize: '0.875rem', color: '#64748b' }}>
                                                                                    {format(new Date(date.date + 'T12:00:00'), 'EEEE, MMMM do')}
                                                                                    {date.date_title && <span className="ml-2 text-blue-600 font-medium" style={{ marginLeft: '0.5rem', color: '#2563eb', fontWeight: 500 }}>— {date.date_title}</span>}
                                                                                </div>
                                                                            </div>
                                                                            {date.price !== undefined && (
                                                                                <div className="text-sm font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', backgroundColor: '#f1f5f9', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                                                                                    ${date.price.toLocaleString()}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    <div className="pt-2" style={{ paddingTop: '0.5rem' }}>
                                        <div className="flex justify-between items-center mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <label className="block text-sm font-bold text-slate-700" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>
                                                Notes <span className="text-red-500" style={{ color: '#ef4444' }}>*</span>
                                            </label>
                                            {selectedManualDates.size > 0 && (
                                                <div className="text-sm font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #dbeafe' }}>
                                                    Total: ${Array.from(selectedManualDates).reduce((sum, key) => {
                                                        const [eventId, dateStr] = key.split('|');
                                                        const eventDate = availableDates.find(d => d.event_id === eventId && d.date === dateStr);
                                                        return sum + (eventDate?.price || 0);
                                                    }, 0).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                        <textarea
                                            value={manualNotes}
                                            onChange={(e) => setManualNotes(e.target.value)}
                                            className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[100px] p-4 text-base resize-none bg-slate-50 focus:bg-white transition-colors"
                                            placeholder="Please provide a reason for this manual addition..."
                                            style={{ width: '100%', borderRadius: '0.75rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', minHeight: '100px', padding: '1rem', fontSize: '1rem', resize: 'none', backgroundColor: manualNotes ? 'white' : '#f8fafc' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div
                            className="p-8 pt-4 bg-white flex justify-end gap-3 shrink-0"
                            style={{ padding: '1rem 2rem 2rem 2rem', backgroundColor: 'white', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}
                        >
                            <button
                                onClick={() => setAddingToRegistration(null)}
                                className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-semibold bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
                                style={{ padding: '0.625rem 1.25rem', color: '#475569', fontWeight: 600, backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveManualEvents}
                                disabled={savingManual || selectedManualDates.size === 0 || !manualNotes.trim()}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
                                style={{ padding: '0.625rem 1.5rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2)', border: 'none', cursor: savingManual || selectedManualDates.size === 0 || !manualNotes.trim() ? 'not-allowed' : 'pointer', opacity: savingManual || selectedManualDates.size === 0 || !manualNotes.trim() ? 0.5 : 1 }}
                            >
                                {savingManual ? <Loader2 className="animate-spin h-5 w-5" /> : <Check size={20} />}
                                Save Events
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
