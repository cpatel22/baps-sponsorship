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

export async function getRegistrationEventsWithDetails(registrationId: string) {
    return db.prepare(`
        SELECT 
            e.id as event_id,
            e.name as event_name,
            rd.date,
            ed.title as date_title
        FROM registration_dates rd
        JOIN events e ON rd.event_id = e.id
        LEFT JOIN event_dates ed ON rd.event_id = ed.event_id AND rd.date = ed.date
        WHERE rd.registration_id = ?
        ORDER BY e.sortOrder ASC, rd.date ASC
    `).all(registrationId) as any[];
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

export async function getRegistrationsByYear(year: string) {
    return db.prepare(`
    SELECT DISTINCT r.* FROM registrations r
    JOIN registration_dates rd ON r.id = rd.registration_id
    WHERE rd.date LIKE ?
    ORDER BY r.created_at DESC
  `).all(`%${year}%`) as any[];
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

export async function sendEmailReminder(date: string, userIds?: string[]) {
    let query = `
        SELECT DISTINCT r.id, r.first_name, r.last_name, r.email, e.name as event_name
        FROM registrations r
        JOIN registration_dates rd ON r.id = rd.registration_id
        JOIN events e ON rd.event_id = e.id
        WHERE rd.date = ?
    `;

    let params: any[] = [date];

    // If specific user IDs are provided, filter by them
    if (userIds && userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(',');
        query += ` AND r.id IN (${placeholders})`;
        params = [date, ...userIds];
    }

    const registrants = db.prepare(query).all(...params) as any[];

    // Simulate sending emails
    console.log(`Sending ${registrants.length} reminder emails for date ${date}`);
    registrants.forEach(reg => {
        console.log(`To: ${reg.email} - Dear ${reg.first_name}, reminder for ${reg.event_name} on ${date}`);
    });

    return { success: true, count: registrants.length };
}

export async function getEmailTemplates() {
    return db.prepare('SELECT * FROM email_templates ORDER BY created_at DESC').all() as {
        id: string,
        name: string,
        to_field: string,
        cc_field: string,
        bcc_field: string,
        subject: string,
        body: string,
        created_at: string,
        updated_at: string
    }[];
}

export async function getEmailTemplate(id: string) {
    return db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id) as {
        id: string,
        name: string,
        to_field: string,
        cc_field: string,
        bcc_field: string,
        subject: string,
        body: string,
        created_at: string,
        updated_at: string
    } | undefined;
}

export async function saveEmailTemplate(id: string | null, name: string, toField: string, ccField: string, bccField: string, subject: string, body: string) {
    if (id) {
        // Update existing template
        db.prepare('UPDATE email_templates SET name = ?, to_field = ?, cc_field = ?, bcc_field = ?, subject = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(name, toField, ccField, bccField, subject, body, id);
        revalidatePath('/admin/settings');
        return { success: true, id };
    } else {
        // Create new template
        const newId = Math.random().toString(36).substring(2, 11);
        db.prepare('INSERT INTO email_templates (id, name, to_field, cc_field, bcc_field, subject, body) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(newId, name, toField, ccField, bccField, subject, body);
        revalidatePath('/admin/settings');
        return { success: true, id: newId };
    }
}

export async function deleteEmailTemplate(id: string) {
    db.prepare('DELETE FROM email_templates WHERE id = ?').run(id);
    revalidatePath('/admin/settings');
}

export async function getEmailSettings() {
    return db.prepare('SELECT * FROM email_settings WHERE id = 1').get() as {
        id: number,
        email_from: string,
        smtp_server: string,
        smtp_port_tls: number,
        smtp_port_ssl: number,
        smtp_username: string,
        smtp_password: string,
        connection_security: string,
        reply_to_email: string,
        updated_at: string
    } | undefined;
}

export async function saveEmailSettings(settings: {
    emailFrom: string,
    smtpServer: string,
    smtpPortTLS: number,
    smtpPortSSL: number,
    smtpUsername: string,
    smtpPassword: string,
    connectionSecurity: string,
    replyToEmail: string
}) {
    const existing = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
    
    if (existing) {
        db.prepare(`
            UPDATE email_settings 
            SET email_from = ?, smtp_server = ?, smtp_port_tls = ?, smtp_port_ssl = ?,
                smtp_username = ?, smtp_password = ?, connection_security = ?, reply_to_email = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `).run(
            settings.emailFrom,
            settings.smtpServer,
            settings.smtpPortTLS,
            settings.smtpPortSSL,
            settings.smtpUsername,
            settings.smtpPassword,
            settings.connectionSecurity,
            settings.replyToEmail
        );
    } else {
        db.prepare(`
            INSERT INTO email_settings (
                id, email_from, smtp_server, smtp_port_tls, smtp_port_ssl,
                smtp_username, smtp_password, connection_security, reply_to_email
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            settings.emailFrom,
            settings.smtpServer,
            settings.smtpPortTLS,
            settings.smtpPortSSL,
            settings.smtpUsername,
            settings.smtpPassword,
            settings.connectionSecurity,
            settings.replyToEmail
        );
    }
    
    revalidatePath('/admin/settings');
    return { success: true };
}

export async function testEmailConfiguration(settings: {
    emailFrom: string,
    smtpServer: string,
    smtpPortTLS: number,
    smtpPortSSL: number,
    smtpUsername: string,
    smtpPassword: string,
    connectionSecurity: string,
    replyToEmail: string,
    testEmailTo: string
}) {
    try {
        // Import nodemailer dynamically
        const nodemailer = await import('nodemailer');
        
        // Determine which port to use based on connection security
        const port = settings.connectionSecurity === 'SSL' ? settings.smtpPortSSL : settings.smtpPortTLS;
        const secure = settings.connectionSecurity === 'SSL'; // true for SSL (465), false for TLS (587)
        
        // Create transporter
        const transporter = nodemailer.default.createTransport({
            host: settings.smtpServer,
            port: port,
            secure: secure,
            auth: {
                user: settings.smtpUsername,
                pass: settings.smtpPassword,
            },
        });

        // Send test email
        const info = await transporter.sendMail({
            from: settings.emailFrom,
            to: settings.testEmailTo,
            replyTo: settings.replyToEmail || settings.emailFrom,
            subject: 'Test Email - Configuration Verification',
            text: 'This is a test email to verify your SMTP configuration is working correctly.',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Email Configuration Test</h2>
                    <p>Congratulations! Your email configuration is working correctly.</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 14px;">
                        This test email was sent from your sponsorship management system.<br>
                        <strong>SMTP Server:</strong> ${settings.smtpServer}<br>
                        <strong>Port:</strong> ${port}<br>
                        <strong>Connection Security:</strong> ${settings.connectionSecurity}
                    </p>
                </div>
            `
        });

        return { 
            success: true, 
            message: 'Test email sent successfully! Please check the inbox.',
            messageId: info.messageId 
        };
    } catch (error: any) {
        console.error('Email test failed:', error);
        return { 
            success: false, 
            message: `Failed to send test email: ${error.message || 'Unknown error'}`,
            error: error.message 
        };
    }
}
