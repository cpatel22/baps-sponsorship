'use client'

import { useState, useEffect } from 'react';
import { getRegistrations, searchRegistrations, getRegistrationsByDate, getRegistrationDates, getCurrentUser, sendEmailReminder } from '@/app/actions';
import { format } from 'date-fns';
import { Search, Calendar as CalendarIcon, User, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';
import Calendar from '@/components/Calendar';
import { useRouter } from 'next/navigation';

export default function Lookup() {
    const [registrations, setRegistrations] = useState<any[]>([]);
    const [searchMode, setSearchMode] = useState<'info' | 'date'>('info');
    const [query, setQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [gridSearch, setGridSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedReg, setSelectedReg] = useState<any>(null);
    const [regDates, setRegDates] = useState<any[]>([]);
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

    async function loadAll() {
        setLoading(true);
        const data = await getRegistrations();
        setRegistrations(data);
        setLoading(false);
    }

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setSelectedReg(null);

        if (searchMode === 'date' && selectedDate) {
            const data = await getRegistrationsByDate(selectedDate);
            setRegistrations(data);
        } else if (searchMode === 'info' && query) {
            const data = await searchRegistrations(query);
            setRegistrations(data);
        } else {
            loadAll();
        }
        setLoading(false);
    };

    const handleDateChange = (dateStr: string) => {
        setSelectedDate(dateStr);
    };

    const viewDetails = async (reg: any) => {
        setSelectedReg(reg);
        const dates = await getRegistrationDates(reg.id);
        setRegDates(dates);
    };

    return (
        <div className="container min-h-screen bg-[#f8fafc] py-12">
            <header className="mb-10 text-center">
                <h1 className="text-3xl font-extrabold text-[#1e293b]">Sponsorship Lookup</h1>
                <p className="text-[#64748b] mt-2">Manage and monitor event registrations with ease.</p>
            </header>

            <div className="max-w-6xl mx-auto space-y-10">
                {/* Search Panel - Matching Image */}
                <div className="bg-[#eff6ff] p-8 rounded-[2rem] shadow-sm border border-[#e2e8f0]">
                    <div className="flex mb-0">
                        <button
                            onClick={() => setSearchMode('info')}
                            className={`flex items-center gap-3 px-8 py-3 rounded-t-2xl font-bold transition-all ${searchMode === 'info' ? 'bg-[#60a5fa] text-white shadow-lg' : 'bg-[#e2e8f0] text-[#475569] hover:bg-[#d1d5db]'}`}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${searchMode === 'info' ? 'border-white' : 'border-[#475569]'}`}>
                                {searchMode === 'info' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            By Info
                        </button>
                        <button
                            onClick={() => setSearchMode('date')}
                            className={`flex items-center gap-3 px-8 py-3 rounded-t-2xl font-bold transition-all ${searchMode === 'date' ? 'bg-[#60a5fa] text-white shadow-lg' : 'bg-[#e2e8f0] text-[#475569] hover:bg-[#d1d5db]'}`}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${searchMode === 'date' ? 'border-white' : 'border-[#475569]'}`}>
                                {searchMode === 'date' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            By Date
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-b-2xl rounded-tr-2xl shadow-xl border border-[#e2e8f0]">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <div className="relative flex-1">
                                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                                {searchMode === 'info' ? (
                                    <input
                                        placeholder="Search by name, email or phone..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="w-full pl-12 h-[56px] rounded-xl border-[#e2e8f0] border-2 focus:border-[#60a5fa] focus:ring-0 transition-all text-[#1e293b]"
                                    />
                                ) : (
                                    <input
                                        type="date"
                                        className="w-full pl-12 h-[56px] rounded-xl border-[#e2e8f0] border-2 focus:border-[#60a5fa] focus:ring-0 transition-all text-[#1e293b]"
                                        value={selectedDate || ''}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                    />
                                )}
                            </div>
                            <button
                                type="submit"
                                className="bg-[#3b82f6] text-white px-8 h-[56px] rounded-xl font-bold flex items-center gap-3 shadow-lg hover:bg-[#2563eb] active:scale-95 transition-all"
                            >
                                <Search size={20} /> Search
                            </button>
                        </form>
                    </div>
                </div>

                {/* Registration Records Grid */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-[#e2e8f0] overflow-hidden p-8 animate-fade-in">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-extrabold text-[#1e293b]">Registration Records</h2>
                        <div className="relative w-72">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                            <input
                                placeholder="Filter records..."
                                value={gridSearch}
                                onChange={(e) => setGridSearch(e.target.value)}
                                className="pl-10 h-10 w-full rounded-xl border-[#e2e8f0] bg-[#f8fafc] text-sm focus:border-[#60a5fa] focus:ring-0"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#e2e8f0] overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f1f5f9] text-[#475569]">
                                    <th className="px-6 py-4 font-bold text-sm">First Name</th>
                                    <th className="px-6 py-4 font-bold text-sm">Spouse Name</th>
                                    <th className="px-6 py-4 font-bold text-sm">Last Name</th>
                                    <th className="px-6 py-4 font-bold text-sm">Email</th>
                                    <th className="px-6 py-4 font-bold text-sm">Phone</th>
                                    <th className="px-6 py-4 font-bold text-sm text-right">
                                        <span className="text-[#94a3b8] font-normal text-xs uppercase tracking-wider">
                                            Showing {registrations.length} Records
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                                {registrations
                                    .filter(reg =>
                                        Object.values(reg).some(v =>
                                            String(v).toLowerCase().includes(gridSearch.toLowerCase())
                                        )
                                    )
                                    .map(reg => (
                                        <tr
                                            key={reg.id}
                                            className="hover:bg-[#f8fafc] transition-colors cursor-pointer group"
                                            onClick={() => viewDetails(reg)}
                                        >
                                            <td className="px-6 py-5 text-[#1e293b] font-medium">{reg.first_name}</td>
                                            <td className="px-6 py-5 text-[#475569]">{reg.spouse_first_name}</td>
                                            <td className="px-6 py-5 text-[#475569]">{reg.last_name}</td>
                                            <td className="px-6 py-5 text-[#475569] font-medium">{reg.email}</td>
                                            <td className="px-6 py-5 text-[#475569] font-medium">{reg.phone}</td>
                                            <td className="px-6 py-5 text-right">
                                                <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${reg.sponsorship_type === 'gold' ? 'bg-[#fef3c7] text-[#92400e]' :
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

                        {(loading || registrations.length === 0) && (
                            <div className="py-20 text-center text-[#94a3b8]">
                                {loading ? 'Fetching data...' : 'No registration records found for the given criteria.'}
                            </div>
                        )}
                    </div>

                    {selectedDate && registrations.length > 0 && (
                        <div className="mt-8 flex justify-end">
                            <button
                                className="bg-[#3b82f6] text-white flex items-center gap-3 py-3 px-10 rounded-xl shadow-lg hover:bg-[#2563eb] active:scale-95 transition-all font-bold"
                                onClick={async () => {
                                    const res = await sendEmailReminder(selectedDate);
                                    if (res.success) {
                                        alert(`Successfully sent ${res.count} reminder emails!`);
                                    }
                                }}
                            >
                                <Mail size={20} /> Send Email Reminder
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Modal/View overlaps could be added here */}
            {selectedReg && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-8 transform animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-[#1e293b]">{selectedReg.first_name} {selectedReg.last_name}</h2>
                                <p className="text-[#64748b]">Registered as <span className="text-[#3b82f6] font-bold uppercase">{selectedReg.sponsorship_type}</span></p>
                            </div>
                            <button onClick={() => setSelectedReg(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                                <ChevronRight className="rotate-90" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-10">
                            <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0]">
                                <span className="text-[10px] uppercase font-black text-[#94a3b8] tracking-widest block mb-1">Email</span>
                                <span className="font-bold text-[#1e293b]">{selectedReg.email}</span>
                            </div>
                            <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0]">
                                <span className="text-[10px] uppercase font-black text-[#94a3b8] tracking-widest block mb-1">Phone</span>
                                <span className="font-bold text-[#1e293b]">{selectedReg.phone}</span>
                            </div>
                            <div className="p-4 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] col-span-2">
                                <span className="text-[10px] uppercase font-black text-[#94a3b8] tracking-widest block mb-1">Address</span>
                                <span className="font-bold text-[#1e293b]">{selectedReg.address}</span>
                            </div>
                        </div>

                        <button onClick={() => setSelectedReg(null)} className="w-full bg-[#1e293b] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                            Close Record
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
