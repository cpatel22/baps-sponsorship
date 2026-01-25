'use server'

import db from '@/lib/db-azure';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const user = await db.authenticateUser(email, password);

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

    return await db.getUserById(sessionId);
}

export async function getEvents() {
    return await db.getEvents() as {
        id: string,
        name: string,
        individualCost: number,
        allCost: number,
        individualUpto: number,
        dateSelectionRequired: boolean,
        sortOrder: number
    }[];
}

export async function getEventDates(eventId: string) {
    return await db.getEventDates(eventId) as { id: string, event_id: string, date: string, title?: string }[];
}

export async function addEventDate(eventId: string, date: string) {
    const id = Math.random().toString(36).substring(2, 11);
    await db.createEventDate(id, eventId, date);
    revalidatePath('/admin/eventMaster');
}

export async function deleteEventDate(id: string) {
    await db.deleteEventDate(id);
    revalidatePath('/admin/eventMaster');
}

export async function updateEventDateTitle(id: string, title: string) {
    await db.updateEventDateTitle(id, title);
    revalidatePath('/admin/eventMaster');
}

export async function registerSponsorship(formData: any, selectedDates: { [eventId: string]: string[] }) {
    const registrationId = Math.random().toString(36).substring(2, 11);

    await db.createRegistration({
        id: registrationId,
        first_name: formData.firstName,
        spouse_first_name: formData.spouseFirstName,
        last_name: formData.lastName,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        sponsorship_type: formData.sponsorshipType
    });

    // Get all events to check dateSelectionRequired
    const allEvents = await db.getEvents();
    
    for (const eventId in selectedDates) {
        const event = allEvents.find(e => e.id === eventId);
        const dates = selectedDates[eventId];
        
        // If event doesn't require date selection, store as quantity only
        if (event && event.dateSelectionRequired === false) {
            const step3Limit = formData.step3Limits?.[eventId];
            const quantity = step3Limit === 'ALL' ? -1 : (typeof step3Limit === 'number' ? step3Limit : dates.length);
            
            await db.createRegistrationDate({
                id: Math.random().toString(36).substring(2, 11),
                registration_id: registrationId,
                event_id: eventId,
                date: null, // No specific date
                quantity: quantity
            });
        } else {
            // Store each date individually for events with date selection
            for (const date of dates) {
                await db.createRegistrationDate({
                    id: Math.random().toString(36).substring(2, 11),
                    registration_id: registrationId,
                    event_id: eventId,
                    date: date,
                    quantity: 1
                });
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
    const emailSettings = await db.getEmailSettings();
    if (!emailSettings) {
        console.log('Email settings not configured, skipping confirmation email');
        return;
    }

    // Get events data
    const events = await db.getEvents();
    
    // Get registration dates with event details
    const regDates = await db.getRegistrationEventsWithDetails(registrationId);

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
            const cost = isAll ? (event.allCost || 0) : (limit as number) * (event.individualCost || 0);
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
                if (ed.dateSelectionRequired === false || !ed.date) {
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
                                ${isAll ? 'All' : limit} × $${event.individualCost}
                            </div>
                            <div style="font-weight: bold; color: #2563eb; font-size: 16px;">$${cost}</div>
                        </div>
                    </div>
            `;

            if (eventDates.length > 0) {
                emailBody += `<div style="margin-top: 8px;">`;
                eventDates.forEach((ed: any) => {
                    // For events without dates, show quantity
                    if (ed.dateSelectionRequired === false || !ed.date) {
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
    return await db.getRegistrations();
}

export async function getRegistrationDates(registrationId: string) {
    return await db.getRegistrationDates(registrationId);
}

export async function getRegistrationEventsWithDetails(registrationId: string) {
    return await db.getRegistrationEventsWithDetails(registrationId);
}

export async function searchRegistrations(query: string) {
    return await db.searchRegistrations(query);
}

export async function getRegistrationsByDate(date: string) {
    return await db.getRegistrationsByDate(date);
}

export async function getRegistrationsByYear(year: string) {
    return await db.getRegistrationsByYear(year);
}

export async function getAllUsers() {
    return await db.getUsers();
}

export async function updateUser(id: string, data: any) {
    await db.updateUser(id, {
        email: data.email,
        password: data.password,
        role: data.role,
        recovery_email: data.recovery_email
    });
    revalidatePath('/admin/users');
}

export async function addUser(data: any) {
    const id = Math.random().toString(36).substring(2, 11);
    await db.createUser({
        id: id,
        email: data.email,
        password: data.password,
        role: data.role,
        recovery_email: data.recovery_email
    });
    revalidatePath('/admin/users');
}

export async function deleteUser(id: string) {
    await db.deleteUser(id);
    revalidatePath('/admin/users');
}

export async function sendEmailReminder(userIds: string[], templateId: string) {
    // Get the email template
    const template = await db.getEmailTemplateById(templateId);
    if (!template) {
        return { success: false, error: 'Email template not found' };
    }

    // Get email settings
    const emailSettings = await db.getEmailSettings();
    if (!emailSettings) {
        return { success: false, error: 'Email settings not configured. Please configure email settings first.' };
    }

    // Get registrations for the selected users
    const registrants = await db.getRegistrationsByIds(userIds);

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
    return await db.getEmailTemplates();
}

export async function getEmailTemplate(id: string) {
    return await db.getEmailTemplateById(id);
}

export async function saveEmailTemplate(id: string | null, name: string, toField: string, ccField: string, bccField: string, subject: string, body: string) {
    if (id) {
        // Update existing template
        await db.updateEmailTemplate(id, {
            name: name,
            to_field: toField,
            cc_field: ccField,
            bcc_field: bccField,
            subject: subject,
            body: body
        });
        revalidatePath('/admin/settings');
        return { success: true, id };
    } else {
        // Create new template
        const newId = Math.random().toString(36).substring(2, 11);
        await db.createEmailTemplate({
            id: newId,
            name: name,
            to_field: toField,
            cc_field: ccField,
            bcc_field: bccField,
            subject: subject,
            body: body
        });
        revalidatePath('/admin/settings');
        return { success: true, id: newId };
    }
}

export async function deleteEmailTemplate(id: string) {
    await db.deleteEmailTemplate(id);
    revalidatePath('/admin/settings');
}

export async function getEmailSettings() {
    return await db.getEmailSettings();
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
    await db.updateEmailSettings({
        email_from: settings.emailFrom,
        smtp_server: settings.smtpServer,
        smtp_port_tls: settings.smtpPortTLS,
        smtp_port_ssl: settings.smtpPortSSL,
        smtp_username: settings.smtpUsername,
        smtp_password: settings.smtpPassword,
        connection_security: settings.connectionSecurity,
        reply_to_email: settings.replyToEmail
    });
    
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
