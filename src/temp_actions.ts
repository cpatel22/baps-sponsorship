
export async function getAvailableEventDatesForRegistration(registrationId: string, year: string) {
    return await db.getAvailableEventDatesForRegistration(registrationId, year);
}

export async function addManualRegistrationDates(registrationId: string, dates: string[], notes: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: 'User not authenticated' };
    }

    try {
        for (const dateStr of dates) {
            // dateStr format might be complex, but we expect YYYY-MM-DD from the DB
            // We need to find the event ID associated with this date.
            // Wait, the dates array should probably contain event_date IDs or we need to pass event_id and date.
            // But the modal will likely list multiple dates from multiple events.
            // The available dates query returns event_id and date.
            // Let's assume the UI passes an array of objects { event_id, date } stringified, or we pass just the IDs of the event_dates rows?
            // db.getAvailableEventDatesForRegistration returns event_dates rows with IDs.
            // So we can use those IDs to get event_id and date.

            // Actually simpler: let the UI pass "eventId|date" strings or similar.
            // Or better: pass an array of objects. But server actions take simple types usually.

            // Let's assume dates is an array of strings in format "eventId|date".
            const [eventId, date] = dateStr.split('|');

            await db.createRegistrationDate({
                id: Math.random().toString(36).substring(2, 11),
                registration_id: registrationId,
                event_id: eventId,
                date: date,
                quantity: 1,
                notes: notes,
                created_by: user.id
            });
        }
        revalidatePath('/admin/lookup');
        return { success: true };
    } catch (error: any) {
        console.error('Error adding manual dates:', error);
        return { success: false, error: error.message };
    }
}
