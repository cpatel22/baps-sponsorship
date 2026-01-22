'use client'

import { useState, useEffect } from 'react';
import { getEvents, getEventDates, addEventDate, deleteEventDate, getCurrentUser, updateEventDateTitle } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Calendar from '@/components/Calendar';
import { format } from 'date-fns';
import { Trash2, Calendar as CalendarIcon, Edit2, Save, X } from 'lucide-react';

export default function EventMaster() {
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [eventDates, setEventDates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
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
        async function loadEvents() {
            const data = await getEvents();
            setEvents(data);
            if (data.length > 0) {
                setSelectedEvent(data[0]);
            }
            setLoading(false);
        }
        loadEvents();
    }, []);

    useEffect(() => {
        if (selectedEvent) {
            loadEventDates();
        }
    }, [selectedEvent]);

    async function loadEventDates() {
        const data = await getEventDates(selectedEvent.id);
        setEventDates(data);
    }

    async function handleDateClick(date: Date) {
        if (!selectedEvent) return;
        const formattedDate = format(date, 'yyyy-MM-dd');
        const existingDate = eventDates.find(ed => ed.date === formattedDate);

        if (existingDate) {
            if (confirm(`Remove ${formattedDate} from ${selectedEvent.name}?`)) {
                await deleteEventDate(existingDate.id);
                loadEventDates();
            }
        } else {
            await addEventDate(selectedEvent.id, formattedDate);
            loadEventDates();
        }
    }

    async function handleSaveTitle(id: string) {
        await updateEventDateTitle(id, editingTitle);
        setEditingId(null);
        loadEventDates();
    }

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <header className="page-header">
                <h1 className="page-title">Event Master</h1>
                <p className="page-description hidden">Manage dates for each event type.</p>
            </header>

            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                <div>
                    <div className="card">
                        <h2 className="text-lg font-bold mb-4">Event Types</h2>
                        <div className="flex" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                            {events.map(event => (
                                <button
                                    key={event.id}
                                    onClick={() => setSelectedEvent(event)}
                                    className={`flex justify-between items-center ${selectedEvent?.id === event.id ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                                >
                                    {event.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    {selectedEvent && selectedEvent.dateSelectionRequired === 1 && (
                        <div className="card">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><CalendarIcon size={20} /> Manage Dates</h2>
                            <Calendar
                                onDateClick={handleDateClick}
                                selectedDates={eventDates.map(ed => ed.date)}
                            />
                        </div>
                    )}
                </div>

                <div>
                    {selectedEvent && selectedEvent.dateSelectionRequired === 1 && (
                        <div className="card">
                            <h3 className="text-lg font-bold mb-4">Active Dates for {selectedEvent.name}</h3>
                            {eventDates.length === 0 ? (
                                <p className="text-muted-foreground">No dates selected for this event.</p>
                            ) : (
                                <div className="grid" style={{ gridTemplateColumns: '1fr', gap: '1rem' }}>
                                    {eventDates.map(ed => (
                                        <div key={ed.id} className="card" style={{ padding: '0.75rem' }}>
                                            <div className="flex justify-between items-start">
                                                <div style={{ flex: 1 }}>
                                                    <div className="font-medium">{ed.date}</div>
                                                    <div className="mt-1">
                                                        {editingId === ed.id ? (
                                                            <div className="flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
                                                                <input
                                                                    type="text"
                                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                                                    value={editingTitle}
                                                                    onChange={(e) => setEditingTitle(e.target.value)}
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={() => handleSaveTitle(ed.id)}
                                                                    className="btn-primary"
                                                                    style={{ padding: '0.25rem', display: 'flex' }}
                                                                    title="Save"
                                                                >
                                                                    <Save size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingId(null)}
                                                                    className="btn-secondary"
                                                                    style={{ padding: '0.25rem', display: 'flex' }}
                                                                    title="Cancel"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginTop: '0.25rem' }}>
                                                                <span style={{ fontStyle: ed.title ? 'normal' : 'italic' }}>
                                                                    {ed.title || 'title'}
                                                                </span>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingId(ed.id);
                                                                        setEditingTitle(ed.title || '');
                                                                    }}
                                                                    className="hover:text-primary transition-colors"
                                                                    style={{ background: 'none', padding: '0' }}
                                                                >
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('Delete this date?')) {
                                                            deleteEventDate(ed.id).then(loadEventDates);
                                                        }
                                                    }}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.25rem', color: 'var(--destructive)', height: 'fit-content' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
