'use server'

import db from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const user = await db.get('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]) as any;

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
    redirect('/');
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session')?.value;
    if (!sessionId) return null;

    return await db.get('SELECT id, email, role, recovery_email FROM users WHERE id = $1', [sessionId]) as any;
}

export async function getEvents() {
    const rows = await db.all('SELECT * FROM events ORDER BY sort_order ASC', []) as {
        id: string,
        name: string,
        individual_cost: number,
        all_cost: number,
        individual_upto: number,
        date_selection_required: number,
        sort_order: number
    }[];
    
    // Transform snake_case to camelCase for frontend
    return rows.map(row => ({
        id: row.id,
        name: row.name,
        individualCost: row.individual_cost || 0,
        allCost: row.all_cost || 0,
        individualUpto: row.individual_upto || 0,
        dateSelectionRequired: row.date_selection_required ?? 1,
        sortOrder: row.sort_order || 0
    }));
}

export async function getEventDates(eventId: string) {
    return await db.all('SELECT * FROM event_dates WHERE event_id = $1 ORDER BY date ASC', [eventId]) as { id: string, event_id: string, date: string, title?: string }[];
}

export async function addEventDate(eventId: string, date: string) {
    const id = Math.random().toString(36).substring(2, 11);
    await db.run('INSERT INTO event_dates (id, event_id, date) VALUES ($1, $2, $3)', [id, eventId, date]);
    revalidatePath('/admin/eventMaster');
}

export async function deleteEventDate(id: string) {
    await db.run('DELETE FROM event_dates WHERE id = $1', [id]);
    revalidatePath('/admin/eventMaster');
}

export async function updateEventDateTitle(id: string, title: string) {
    await db.run('UPDATE event_dates SET title = $1 WHERE id = $2', [title, id]);
    revalidatePath('/admin/eventMaster');
}

export async function registerSponsorship(formData: any, selectedDates: { [eventId: string]: string[] }) {
    const registrationId = Math.random().toString(36).substring(2, 11);

    await db.run(`
        INSERT INTO registrations (id, first_name, spouse_first_name, last_name, address, phone, email, sponsorship_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
        registrationId,
        formData.firstName,
        formData.spouseFirstName,
        formData.lastName,
        formData.address,
        formData.phone,
        formData.email,
        formData.sponsorshipType
    ]);

    // Get all events to check dateSelectionRequired
    const allEvents = await db.all('SELECT * FROM events', []) as any[];
    
    for (const eventId in selectedDates) {
        const event = allEvents.find(e => e.id === eventId);
        const dates = selectedDates[eventId];
        
        // If event doesn't require date selection, store as quantity only
        if (event && event.date_selection_required === 0) {
            const step3Limit = formData.step3Limits?.[eventId];
            const quantity = step3Limit === 'ALL' ? -1 : (typeof step3Limit === 'number' ? step3Limit : dates.length);
            
            await db.run(`
                INSERT INTO registration_dates (id, registration_id, event_id, date, quantity)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                Math.random().toString(36).substring(2, 11),
                registrationId,
                eventId,
                null,
                quantity
            ]);
        } else {
            // Store each date individually for events with date selection
            for (const date of dates) {
                await db.run(`
                    INSERT INTO registration_dates (id, registration_id, event_id, date, quantity)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    Math.random().toString(36).substring(2, 11),
                    registrationId,
                    eventId,
                    date,
                    1
                ]);
            }
        }
    }

    // Send confirmation email
    try {
        await sendRegistrationConfirmationEmail(registrationId, formData);
    } catch (error) {
        console.error('Failed to send confirmation email:', error);
        // Don't fail the registration if email fails
    }

    revalidatePath('/admin/lookup');
    return { success: true, registrationId };
}

async function sendRegistrationConfirmationEmail(registrationId: string, formData: any) {
    // Get email settings
    const emailSettings = await db.get('SELECT * FROM email_settings WHERE id = 1', []) as any;
    if (!emailSettings) {
        console.log('Email settings not configured, skipping confirmation email');
        return;
    }

    // Get events data
    const events = await db.all('SELECT * FROM events ORDER BY sort_order ASC', []) as any[];
    
    // Get registration dates with event details
    const regDates = await db.all(`
        SELECT 
            e.id as event_id,
            e.name as event_name,
            e.individual_cost,
            e.all_cost,
            e.date_selection_required,
            rd.date,
            rd.quantity,
            ed.title as date_title
        FROM registration_dates rd
        JOIN events e ON rd.event_id = e.id
        LEFT JOIN event_dates ed ON rd.event_id = ed.event_id AND rd.date = ed.date
        WHERE rd.registration_id = $1
        ORDER BY e.sort_order ASC, rd.date ASC
    `, [registrationId]) as any[];

    // Group dates by event
    const eventGroups: { [eventId: string]: any[] } = {};
    regDates.forEach((rd: any) => {
        if (!eventGroups[rd.event_id]) {
            eventGroups[rd.event_id] = [];
        }
        eventGroups[rd.event_id].push(rd);
    });

    // Separate plan selections and individual selections based on formData
    const planSelections: { [eventId: string]: any[] } = {};
    const individualSelections: { [eventId: string]: any[] } = {};
    
    // Parse the sponsorship data from formData if available
    const step2Data = formData.step2Selections || {};
    const step3Data = formData.step3Limits || {};
    
    // Categorize selections
    for (const eventId in eventGroups) {
        const eventDates = eventGroups[eventId];
        const step2Dates = step2Data[eventId] || [];
        
        planSelections[eventId] = eventDates.filter((ed: any) => step2Dates.includes(ed.date));
        individualSelections[eventId] = eventDates.filter((ed: any) => !step2Dates.includes(ed.date));
    }

    // Calculate grand total
    let grandTotal = 0;
    
    // Add plan price
    const planPrices: { [key: string]: number } = {
        'silver': 1751, 'gold': 2501, 'platinum': 3501,
        'all_sabha': 7501, 'all_samaiya': 5001, 'all_sabha_samaiya': 11001
    };
    if (formData.sponsorshipType && planPrices[formData.sponsorshipType]) {
        grandTotal += planPrices[formData.sponsorshipType];
    }

    // Calculate individual event costs
    const individualCosts: { [eventId: string]: number } = {};
    for (const event of events) {
        const eventId = event.id;
        const limit = step3Data[eventId];
        
        if (limit && limit !== 0) {
            const isAll = limit === 'ALL';
            const cost = isAll ? (event.all_cost || 0) : (limit as number) * (event.individual_cost || 0);
            individualCosts[eventId] = cost;
            grandTotal += cost;
        }
    }

    // Build email HTML
    let emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #2563eb; margin-bottom: 10px; text-align: center; font-size: 28px;">Registration Confirmation</h1>
                <p style="font-size: 16px; color: #333; margin-bottom: 25px; text-align: center;">
                    Thank you for your sponsorship registration!
                </p>
                
                <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Contact Information</h3>
                    <div style="font-size: 14.4px; line-height: 1.6;">
                        <p style="margin: 4px 0;"><strong>Name:</strong> ${formData.firstName} & ${formData.spouseFirstName} ${formData.lastName}</p>
                        <p style="margin: 4px 0;"><strong>Address:</strong> ${formData.address}</p>
                        <p style="margin: 4px 0;"><strong>Phone:</strong> ${formData.phone}</p>
                        <p style="margin: 4px 0;"><strong>Email:</strong> ${formData.email}</p>
                    </div>
                </div>
    `;

    // Add sponsorship plan if selected
    if (formData.sponsorshipType && planPrices[formData.sponsorshipType]) {
        const planNames: { [key: string]: string } = {
            'silver': 'Annual Silver Sponsorship (1 Samaiya, 1 Mahila Samaiya, 4 Weekly Satsang Sabha)',
            'gold': 'Annual Gold Sponsorship (2 Samaiya, 2 Mahila Samaiya, 6 Weekly Satsang Sabha)',
            'platinum': 'Annual Platinum Sponsorship (3 Samaiya, 3 Mahila Samaiya, 8 Weekly Satsang Sabha)',
            'all_sabha': 'Annual Grand Sponsorships - All Weekly Satsang Sabha',
            'all_samaiya': 'Annual Grand Sponsorships - All Samaiya',
            'all_sabha_samaiya': 'Annual Grand Sponsorships - All Weekly Satsang Sabha & Samaiya'
        };
        
        emailBody += `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="color: #1e293b; margin: 0 0 8px 0; font-size: 18px; font-weight: bold;">Sponsorship Plan</h3>
                <p style="margin: 0; font-size: 16px;">${planNames[formData.sponsorshipType]}</p>
                <div style="border-top: 1px solid #cbd5e1; margin-top: 8px; padding-top: 8px; text-align: right;">
                    <span style="font-size: 18px; font-weight: bold; color: #2563eb;">$${planPrices[formData.sponsorshipType]}</span>
                </div>
            </div>
        `;
    }

    // Add plan event selections
    if (Object.keys(planSelections).some(eid => planSelections[eid].length > 0)) {
        emailBody += `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Plan Event Selections</h3>
        `;

        for (const eventId in planSelections) {
            if (planSelections[eventId].length === 0) continue;
            const eventDates = planSelections[eventId];
            const eventName = eventDates[0].event_name;
            
            emailBody += `
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #cbd5e1;">
                    <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 16px;">${eventName}</p>
                    <div style="margin-top: 8px;">
            `;

            eventDates.forEach((ed: any) => {
                // For events without dates, show quantity
                if (ed.date_selection_required === 0 || !ed.date) {
                    const quantityText = ed.quantity === -1 ? 'All' : ed.quantity || 1;
                    emailBody += `
                        <span style="display: inline-block; margin: 3px 5px 3px 0; padding: 4px 8px; background-color: white; border: 1px solid #2563eb; color: #2563eb; border-radius: 15px; font-size: 12px;">
                            ${quantityText}
                        </span>
                    `;
                } else {
                    // For events with dates, show date
                    const dateStr = new Date(ed.date + 'T12:00:00').toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                    emailBody += `
                        <span style="display: inline-block; margin: 3px 5px 3px 0; padding: 4px 8px; background-color: white; border: 1px solid #2563eb; color: #2563eb; border-radius: 15px; font-size: 12px;">
                            ${dateStr}${ed.date_title ? ` - ${ed.date_title}` : ''}
                        </span>
                    `;
                }
            });

            emailBody += `
                    </div>
                    <div style="text-align: right; margin-top: 8px;">
                        <span style="font-size: 14px; font-weight: 600;">${eventDates.length} date${eventDates.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
            `;
        }

        emailBody += `</div>`;
    }

    // Add individual event selections
    const hasIndividualSelections = Object.keys(step3Data).some(eid => step3Data[eid] && step3Data[eid] !== 0);
    
    if (hasIndividualSelections) {
        emailBody += `
            <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                <h3 style="color: #1e293b; margin: 0 0 12px 0; font-size: 18px; font-weight: bold;">Individual Event Selections</h3>
        `;

        for (const event of events) {
            const eventId = event.id;
            const limit = step3Data[eventId];
            if (!limit || limit === 0) continue;
            
            const isAll = limit === 'ALL';
            const eventDates = individualSelections[eventId] || [];
            const cost = individualCosts[eventId];
            
            emailBody += `
                <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #cbd5e1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <div style="flex: 1;">
                            <p style="margin: 0; font-weight: 600; font-size: 16px;">${event.name}</p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">
                                ${isAll ? 'All' : limit} × $${event.individual_cost}
                            </div>
                            <div style="font-weight: bold; color: #2563eb; font-size: 16px;">$${cost}</div>
                        </div>
                    </div>
            `;

            if (eventDates.length > 0) {
                emailBody += `<div style="margin-top: 8px;">`;
                eventDates.forEach((ed: any) => {
                    // For events without dates, show quantity
                    if (ed.date_selection_required === 0 || !ed.date) {
                        const quantityText = ed.quantity === -1 ? 'All' : ed.quantity || 1;
                        emailBody += `
                            <span style="display: inline-block; margin: 3px 5px 3px 0; padding: 4px 8px; background-color: white; border: 1px solid #2563eb; color: #2563eb; border-radius: 15px; font-size: 12px;">
                               ${quantityText}
                            </span>
                        `;
                    } else {
                        // For events with dates, show date
                        const dateStr = new Date(ed.date + 'T12:00:00').toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        });
                        emailBody += `
                            <span style="display: inline-block; margin: 3px 5px 3px 0; padding: 4px 8px; background-color: white; border: 1px solid #2563eb; color: #2563eb; border-radius: 15px; font-size: 12px;">
                                ${dateStr}${ed.date_title ? ` - ${ed.date_title}` : ''}
                            </span>
                        `;
                    }
                });
                emailBody += `</div>`;
            }

            emailBody += `</div>`;
        }

        emailBody += `</div>`;
    }

    // Grand Total
    emailBody += `
        <div style="background-color: #2563eb; color: white; padding: 24px; border-radius: 8px; text-align: center; margin-bottom: 16px;">
            <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; margin-bottom: 4px;">Total Amount</div>
            <div style="font-size: 36px; font-weight: 900;">$${grandTotal}</div>
        </div>

        <div style="background-color: #f1f5f9; color: #1e293b; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #cbd5e1;">
            <p style="margin: 0; font-size: 14px; color: #64748b;">Registration ID</p>
            <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: bold; letter-spacing: 0.05em;">${registrationId}</p>
        </div>

        <p style="margin-top: 30px; font-size: 14px; color: #64748b; text-align: center;">
            Thank you for your support!
        </p>
            </div>
        </div>
    `;

    try {
        const nodemailer = await import('nodemailer');
        
        const port = emailSettings.connection_security === 'SSL' ? emailSettings.smtp_port_ssl : emailSettings.smtp_port_tls;
        const secure = emailSettings.connection_security === 'SSL';
        
        const transporter = nodemailer.default.createTransport({
            host: emailSettings.smtp_server,
            port: port,
            secure: secure,
            auth: {
                user: emailSettings.smtp_username,
                pass: emailSettings.smtp_password,
            },
        });

        await transporter.sendMail({
            from: emailSettings.email_from,
            to: formData.email,
            replyTo: emailSettings.reply_to_email || emailSettings.email_from,
            subject: 'Sponsorship Registration Confirmation',
            html: emailBody
        });

        console.log('Confirmation email sent successfully to:', formData.email);
    } catch (error: any) {
        console.error('Failed to send confirmation email:', error.message);
        throw error;
    }
}

export async function getRegistrations() {
    return await db.all('SELECT * FROM registrations ORDER BY created_at DESC', []) as any[];
}

export async function getRegistrationDates(registrationId: string) {
    return await db.all('SELECT * FROM registration_dates WHERE registration_id = $1', [registrationId]) as any[];
}

export async function getRegistrationEventsWithDetails(registrationId: string) {
    return await db.all(`
        SELECT 
            e.id as event_id,
            e.name as event_name,
            e.date_selection_required,
            rd.date,
            rd.quantity,
            ed.title as date_title
        FROM registration_dates rd
        JOIN events e ON rd.event_id = e.id
        LEFT JOIN event_dates ed ON rd.event_id = ed.event_id AND rd.date = ed.date
        WHERE rd.registration_id = $1
        ORDER BY e.sort_order ASC, rd.date ASC
    `, [registrationId]) as any[];
}

export async function searchRegistrations(query: string) {
    const q = `%${query}%`;
    return await db.all(`
        SELECT * FROM registrations 
        WHERE first_name LIKE $1 OR last_name LIKE $1 OR email LIKE $1 OR phone LIKE $1
        ORDER BY created_at DESC
    `, [q]) as any[];
}

export async function getRegistrationsByDate(date: string) {
    return await db.all(`
        SELECT r.* FROM registrations r
        JOIN registration_dates rd ON r.id = rd.registration_id
        WHERE rd.date = $1
        GROUP BY r.id, r.first_name, r.spouse_first_name, r.last_name, r.address, r.phone, r.email, r.sponsorship_type, r.created_at
        ORDER BY r.created_at DESC
    `, [date]) as any[];
}

export async function getRegistrationsByYear(year: string) {
    return await db.all(`
        SELECT DISTINCT r.* FROM registrations r
        JOIN registration_dates rd ON r.id = rd.registration_id
        WHERE rd.date LIKE $1
        ORDER BY r.created_at DESC
    `, [`%${year}%`]) as any[];
}

export async function getAllUsers() {
    return await db.all('SELECT id, email, role, recovery_email, created_at FROM users', []) as any[];
}

export async function updateUser(id: string, data: any) {
    if (data.password) {
        await db.run('UPDATE users SET email = $1, password = $2, role = $3, recovery_email = $4 WHERE id = $5',
            [data.email, data.password, data.role, data.recovery_email, id]);
    } else {
        await db.run('UPDATE users SET email = $1, role = $2, recovery_email = $3 WHERE id = $4',
            [data.email, data.role, data.recovery_email, id]);
    }
    revalidatePath('/admin/users');
}

export async function addUser(data: any) {
    const id = Math.random().toString(36).substring(2, 11);
    await db.run('INSERT INTO users (id, email, password, role, recovery_email) VALUES ($1, $2, $3, $4, $5)',
        [id, data.email, data.password, data.role, data.recovery_email]);
    revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
    await db.run('DELETE FROM users WHERE id = $1', [id]);
    revalidatePath('/admin/users');
}

export async function sendEmailReminder(userIds: string[], templateId: string) {
    // Get the email template
    const template = await db.get('SELECT * FROM email_templates WHERE id = $1', [templateId]) as any;
    if (!template) {
        return { success: false, error: 'Email template not found' };
    }

    // Get email settings
    const emailSettings = await db.get('SELECT * FROM email_settings WHERE id = 1', []) as any;
    if (!emailSettings) {
        return { success: false, error: 'Email settings not configured. Please configure email settings first.' };
    }

    // Get registrations for the selected users
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const query = `
        SELECT DISTINCT r.*
        FROM registrations r
        WHERE r.id IN (${placeholders})
    `;

    const registrants = await db.all(query, userIds) as any[];

    if (registrants.length === 0) {
        return { success: false, error: 'No users found' };
    }

    try {
        // Import nodemailer
        const nodemailer = await import('nodemailer');
        
        // Determine port and security based on settings
        const port = emailSettings.connection_security === 'SSL' ? emailSettings.smtp_port_ssl : emailSettings.smtp_port_tls;
        const secure = emailSettings.connection_security === 'SSL';
        
        // Create transporter
        const transporter = nodemailer.default.createTransport({
            host: emailSettings.smtp_server,
            port: port,
            secure: secure,
            auth: {
                user: emailSettings.smtp_username,
                pass: emailSettings.smtp_password,
            },
        });

        let successCount = 0;
        let failedEmails: string[] = [];

        // Send email to each registrant
        for (const reg of registrants) {
            try {
                // Replace placeholders in template
                const replacePlaceholders = (text: string) => {
                    if (!text) return '';
                    return text
                        .replace(/\{\{first_name\}\}/g, reg.first_name || '')
                        .replace(/\{\{spouse_first_name\}\}/g, reg.spouse_first_name || '')
                        .replace(/\{\{last_name\}\}/g, reg.last_name || '')
                        .replace(/\{\{email\}\}/g, reg.email || '')
                        .replace(/\{\{phone\}\}/g, reg.phone || '')
                        .replace(/\{\{address\}\}/g, reg.address || '')
                        .replace(/\{\{sponsorship_type\}\}/g, reg.sponsorship_type || '');
                };

                const toEmail = replacePlaceholders(template.to_field) || reg.email;
                const subject = replacePlaceholders(template.subject);
                const body = replacePlaceholders(template.body);
                const ccEmail = template.cc_field ? replacePlaceholders(template.cc_field) : undefined;
                const bccEmail = template.bcc_field ? replacePlaceholders(template.bcc_field) : undefined;

                await transporter.sendMail({
                    from: emailSettings.email_from,
                    to: toEmail,
                    cc: ccEmail,
                    bcc: bccEmail,
                    replyTo: emailSettings.reply_to_email || emailSettings.email_from,
                    subject: subject,
                    html: body
                });

                successCount++;
            } catch (error: any) {
                console.error(`Failed to send email to ${reg.email}:`, error.message);
                failedEmails.push(reg.email);
            }
        }

        if (failedEmails.length > 0) {
            return { 
                success: true, 
                count: successCount,
                warning: `${failedEmails.length} email(s) failed to send: ${failedEmails.join(', ')}`
            };
        }

        return { success: true, count: successCount };
    } catch (error: any) {
        console.error('Email sending error:', error);
        return { 
            success: false, 
            error: `Failed to send emails: ${error.message}`
        };
    }
}

export async function getEmailTemplates() {
    return await db.all('SELECT * FROM email_templates ORDER BY created_at DESC', []) as {
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
    return await db.get('SELECT * FROM email_templates WHERE id = $1', [id]) as {
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
        await db.run('UPDATE email_templates SET name = $1, to_field = $2, cc_field = $3, bcc_field = $4, subject = $5, body = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
            [name, toField, ccField, bccField, subject, body, id]);
        revalidatePath('/admin/settings');
        return { success: true, id };
    } else {
        // Create new template
        const newId = Math.random().toString(36).substring(2, 11);
        await db.run('INSERT INTO email_templates (id, name, to_field, cc_field, bcc_field, subject, body) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [newId, name, toField, ccField, bccField, subject, body]);
        revalidatePath('/admin/settings');
        return { success: true, id: newId };
    }
}

export async function deleteEmailTemplate(id: string) {
    await db.run('DELETE FROM email_templates WHERE id = $1', [id]);
    revalidatePath('/admin/settings');
}

export async function getEmailSettings() {
    return await db.get('SELECT * FROM email_settings WHERE id = 1', []) as {
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
    const existing = await db.get('SELECT * FROM email_settings WHERE id = 1', []);
    
    if (existing) {
        await db.run(`
            UPDATE email_settings 
            SET email_from = $1, smtp_server = $2, smtp_port_tls = $3, smtp_port_ssl = $4,
                smtp_username = $5, smtp_password = $6, connection_security = $7, reply_to_email = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `, [
            settings.emailFrom,
            settings.smtpServer,
            settings.smtpPortTLS,
            settings.smtpPortSSL,
            settings.smtpUsername,
            settings.smtpPassword,
            settings.connectionSecurity,
            settings.replyToEmail
        ]);
    } else {
        await db.run(`
            INSERT INTO email_settings (
                id, email_from, smtp_server, smtp_port_tls, smtp_port_ssl,
                smtp_username, smtp_password, connection_security, reply_to_email
            ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            settings.emailFrom,
            settings.smtpServer,
            settings.smtpPortTLS,
            settings.smtpPortSSL,
            settings.smtpUsername,
            settings.smtpPassword,
            settings.connectionSecurity,
            settings.replyToEmail
        ]);
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
