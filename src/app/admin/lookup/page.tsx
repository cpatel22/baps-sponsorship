'use client'

import { useState, useEffect, useRef } from 'react';
import { getRegistrations, getCurrentUser, sendEmailReminder } from '@/app/actions';
import { Mail } from 'lucide-react';
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
    const tableRef = useRef<HTMLTableElement>(null);
    const dataTableRef = useRef<any>(null);
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
        loadAll();
    }, []);

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
        };
    }, []);

    useEffect(() => {
        // Initialize or reinitialize DataTable when registrations change
        if (!loading && registrations.length > 0 && window.jQuery && window.$.fn.DataTable) {
            const timer = setTimeout(() => {
                initializeDataTable();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [registrations, loading]);

    const initializeDataTable = () => {
        if (!tableRef.current || !window.jQuery || !window.$.fn.DataTable) {
            return;
        }

        try {
            // Check if DataTable is already initialized
            if (window.$.fn.DataTable.isDataTable(tableRef.current)) {
                // Destroy existing instance and clear reference
                const dt = window.$(tableRef.current).DataTable();
                dt.destroy();
                dataTableRef.current = null;
            }

            // Clear any existing DataTable classes/attributes
            window.$(tableRef.current).removeClass('dataTable');

            // Initialize new DataTable
            dataTableRef.current = window.$(tableRef.current).DataTable({
                pageLength: 10,
                responsive: true,
                destroy: true, // Allow re-initialization
                order: [[1, 'asc']],
                columnDefs: [
                    { orderable: false, targets: 0 }
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
        setLoading(true);
        const data = await getRegistrations();
        setRegistrations(data);
        setSelectedUsers(new Set());
        setLoading(false);
    }

    const handleCheckboxChange = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    return (
        <div className="container min-h-screen bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe] py-12">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-[#1e293b] mb-2">Sponsorship Lookup</h1>
                <p className="text-[#64748b] text-lg hidden">Manage and monitor event registrations with ease.</p>
            </header>

            <div className="max-w-7xl mx-auto space-y-8">
                {/* DataTable */}
                <div className="bg-white rounded-3xl shadow-xl border border-[#e2e8f0] overflow-hidden">
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
