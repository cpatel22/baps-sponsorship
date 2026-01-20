'use server'

import db from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;

    if (user) {
        const cookieStore = await cookies();
        cookieStore.set('session', user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/'
        });
        return { success: true };
    }

    return { error: 'Invalid email or password' };
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    revalidatePath('/');
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;
    if (!sessionId) return null;

    return db.prepare('SELECT id, email, role, recovery_email FROM users WHERE id = ?').get(sessionId) as any;
}

export async function getEvents() {
    return db.prepare('SELECT * FROM events ORDER BY sortOrder ASC').all() as {
        id: string,
        name: string,
        individualCost: number,
        allCost: number,
        individualUpto: number,
        dateSelectionRequired: number,
        sortOrder: number
    }[];
}

export async function getEventDates(eventId: string) {
    return db.prepare('SELECT * FROM event_dates WHERE event_id = ? ORDER BY date ASC').all(eventId) as { id: string, event_id: string, date: string, title?: string }[];
}

export async function addEventDate(eventId: string, date: string) {
    const id = Math.random().toString(36).substring(2, 11);
    db.prepare('INSERT INTO event_dates (id, event_id, date) VALUES (?, ?, ?)').run(id, eventId, date);
    revalidatePath('/admin/eventMaster');
}

export async function deleteEventDate(id: string) {
    db.prepare('DELETE FROM event_dates WHERE id = ?').run(id);
    revalidatePath('/admin/eventMaster');
}

export async function updateEventDateTitle(id: string, title: string) {
    db.prepare('UPDATE event_dates SET title = ? WHERE id = ?').run(title, id);
    revalidatePath('/admin/eventMaster');
}

export async function registerSponsorship(formData: any, selectedDates: { [eventId: string]: string[] }) {
    const registrationId = Math.random().toString(36).substring(2, 11);

    const insertRegistration = db.prepare(`
    INSERT INTO registrations (id, first_name, spouse_first_name, last_name, address, phone, email, sponsorship_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    insertRegistration.run(
        registrationId,
        formData.firstName,
        formData.spouseFirstName,
        formData.lastName,
        formData.address,
        formData.phone,
        formData.email,
        formData.sponsorshipType
    );

    const insertDate = db.prepare(`
    INSERT INTO registration_dates (id, registration_id, event_id, date)
    VALUES (?, ?, ?, ?)
  `);

    for (const eventId in selectedDates) {
        for (const date of selectedDates[eventId]) {
            insertDate.run(
                Math.random().toString(36).substring(2, 11),
                registrationId,
                eventId,
                date
            );
        }
    }

    revalidatePath('/admin/lookup');
    return { success: true, registrationId };
}

export async function getRegistrations() {
    return db.prepare('SELECT * FROM registrations ORDER BY created_at DESC').all() as any[];
}

export async function getRegistrationDates(registrationId: string) {
    return db.prepare('SELECT * FROM registration_dates WHERE registration_id = ?').all(registrationId) as any[];
}

export async function searchRegistrations(query: string) {
    const q = `%${query}%`;
    return db.prepare(`
    SELECT * FROM registrations 
    WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?
    ORDER BY created_at DESC
  `).all(q, q, q, q) as any[];
}

export async function getRegistrationsByDate(date: string) {
    return db.prepare(`
    SELECT r.* FROM registrations r
    JOIN registration_dates rd ON r.id = rd.registration_id
    WHERE rd.date = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `).all(date) as any[];
}

export async function getAllUsers() {
    return db.prepare('SELECT id, email, role, recovery_email, created_at FROM users').all() as any[];
}

export async function updateUser(id: string, data: any) {
    if (data.password) {
        db.prepare('UPDATE users SET email = ?, password = ?, role = ?, recovery_email = ? WHERE id = ?')
            .run(data.email, data.password, data.role, data.recovery_email, id);
    } else {
        db.prepare('UPDATE users SET email = ?, role = ?, recovery_email = ? WHERE id = ?')
            .run(data.email, data.role, data.recovery_email, id);
    }
    revalidatePath('/admin/users');
}

export async function addUser(data: any) {
    const id = Math.random().toString(36).substring(2, 11);
    db.prepare('INSERT INTO users (id, email, password, role, recovery_email) VALUES (?, ?, ?, ?, ?)')
        .run(id, data.email, data.password, data.role, data.recovery_email);
    revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    revalidatePath('/admin/users');
}

export async function sendEmailReminder(date: string) {
    const registrants = db.prepare(`
        SELECT r.first_name, r.last_name, r.email, e.name as event_name
        FROM registrations r
        JOIN registration_dates rd ON r.id = rd.registration_id
        JOIN events e ON rd.event_id = e.id
        WHERE rd.date = ?
    `).all(date) as any[];

    // Simulate sending emails
    console.log(`Sending ${registrants.length} reminder emails for date ${date}`);
    registrants.forEach(reg => {
        console.log(`To: ${reg.email} - Dear ${reg.first_name}, reminder for ${reg.event_name} on ${date}`);
    });

    return { success: true, count: registrants.length };
}
