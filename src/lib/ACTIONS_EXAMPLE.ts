/**
 * Example: How to Update actions.ts to use DB wrappers
 * 
 * This file shows examples of how to wrap your existing server actions
 * with the automatic database idle handling.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

'use server'

import db from '@/lib/db-azure';
import { withDBAction, safeDBQuery } from '@/lib/db-action-wrapper';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Example 1: Basic action with error handling
export async function getEvents() {
  return await withDBAction(
    async () => await db.getEvents() as {
      id: string,
      name: string,
      individualCost: number,
      allCost: number,
      individualUpto: number,
      dateSelectionRequired: boolean,
      sortOrder: number
    }[],
    'Failed to fetch events'
  );
}

// Example 2: Safe query with default fallback
export async function getEventsSafe() {
  return await safeDBQuery(
    async () => await db.getEvents(),
    [], // Return empty array if DB fails
    'Failed to fetch events'
  );
}

// Example 3: Complex action with multiple DB operations
export async function registerSponsorship(formData: any, selectedDates: { [eventId: string]: string[] }) {
  return await withDBAction(
    async () => {
      const registrationId = Math.random().toString(36).substring(2, 11);

      // Create registration
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
        
        // Store registration dates
        for (const date of dates) {
          const id = Math.random().toString(36).substring(2, 11);
          await db.createRegistrationDate({
            id,
            registration_id: registrationId,
            event_id: eventId,
            date: date,
            quantity: 1
          });
        }
      }

      revalidatePath('/');
      return { success: true, registrationId };
    },
    'Failed to register sponsorship'
  );
}

// Example 4: Login with error handling
export async function login(formData: FormData) {
  return await withDBAction(
    async () => {
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
    },
    'Login failed'
  );
}

// Example 5: Get current user with safe fallback
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('session')?.value;
  if (!sessionId) return null;

  return await safeDBQuery(
    async () => await db.getUserById(sessionId),
    null, // Return null if DB fails
    'Failed to get current user'
  );
}

// Example 6: Delete operation
export async function deleteEventDate(id: string) {
  return await withDBAction(
    async () => {
      await db.deleteEventDate(id);
      revalidatePath('/admin/eventMaster');
      return { success: true };
    },
    'Failed to delete event date'
  );
}

// Example 7: Update operation
export async function updateEventDateTitle(id: string, title: string) {
  return await withDBAction(
    async () => {
      await db.updateEventDateTitle(id, title);
      revalidatePath('/admin/eventMaster');
      return { success: true };
    },
    'Failed to update event date title'
  );
}

/**
 * Instructions for updating your actions.ts:
 * 
 * 1. Import the wrappers at the top:
 *    import { withDBAction, safeDBQuery } from '@/lib/db-action-wrapper';
 * 
 * 2. For critical operations (create, update, delete), use withDBAction:
 *    - Wraps the entire operation
 *    - Automatically retries on idle DB
 *    - Throws user-friendly errors
 * 
 * 3. For read operations, you can choose:
 *    - withDBAction: If you want errors to bubble up
 *    - safeDBQuery: If you want to return a default value on failure
 * 
 * 4. Keep your revalidatePath and redirect calls inside the wrapper
 * 
 * 5. The wrapper will automatically handle:
 *    - Database idle/sleeping states
 *    - Connection timeouts
 *    - Automatic retries with delays
 *    - User-friendly error messages
 */
