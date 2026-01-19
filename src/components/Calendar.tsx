'use client'

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
    onDateClick: (date: Date) => void;
    selectedDates?: string[];
    highlightDates?: string[];
    disabledDates?: string[];
    enabledDates?: string[];
}

export default function Calendar({
    onDateClick,
    selectedDates = [],
    highlightDates = [],
    disabledDates = [],
    enabledDates
}: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    return (
        <div className="calendar-container card">
            <div className="calendar-header flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
                <div className="flex gap-2">
                    <button onClick={prevMonth} className="btn-secondary p-2"><ChevronLeft size={20} /></button>
                    <button onClick={nextMonth} className="btn-secondary p-2"><ChevronRight size={20} /></button>
                </div>
            </div>
            <div className="calendar-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="calendar-day-name">{day}</div>
                ))}
                {days.map(day => {
                    const formattedDate = format(day, 'yyyy-MM-dd');
                    const isSelected = selectedDates.includes(formattedDate);
                    const isHighlighted = highlightDates.includes(formattedDate);

                    let isDisabled = disabledDates.includes(formattedDate);
                    if (enabledDates && !enabledDates.includes(formattedDate)) {
                        isDisabled = true;
                    }

                    const isCurrentMonth = isSameMonth(day, monthStart);

                    return (
                        <div
                            key={day.toString()}
                            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && onDateClick(day)}
                        >
                            {format(day, 'd')}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
