import sql from 'mssql';

// Azure SQL Database Configuration
const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER || '',
  database: process.env.AZURE_SQL_DATABASE || '',
  user: process.env.AZURE_SQL_USER || '',
  password: process.env.AZURE_SQL_PASSWORD || '',
  port: parseInt(process.env.AZURE_SQL_PORT || '1433'),
  connectionTimeout: 60000, // Wait up to 60s for connection (important for serverless wake-up)
  options: {
    encrypt: true, // Required for Azure
    trustServerCertificate: false,
    enableArithAbort: true,
    requestTimeout: 60000, // Increase request timeout to 60s
  },
  pool: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
  },
};

// Connection pool
let pool: sql.ConnectionPool | null = null;
let connectionPromise: Promise<sql.ConnectionPool> | null = null;

// Get or create connection pool
async function getPool(): Promise<sql.ConnectionPool> {
  // If pool is ready, return it immediately
  if (pool && pool.connected) {
    return pool;
  }

  // If a connection attempt is already in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start a new connection attempt
  connectionPromise = (async () => {
    try {
      // If pool exists but not connected, close it first
      if (pool) {
        try {
          await pool.close();
        } catch (closeErr) {
          console.warn('Error closing existing pool:', closeErr);
        }
        pool = null;
      }

      const newPool = await new sql.ConnectionPool(config).connect();
      pool = newPool;
      console.log('Connected to Azure SQL Database');
      return newPool;
    } catch (err) {
      console.error('Database connection failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Provide more specific error messages for common issues
      if (errorMessage.includes('timeout')) {
        throw new Error('Database connection timeout - database may be idle or sleeping');
      } else if (errorMessage.includes('ECONNREFUSED')) {
        throw new Error('Database connection refused - database may be starting up');
      } else {
        throw err;
      }
    } finally {
      // Clear the promise so future calls can try again if needed
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

// Database operations interface
export interface Event {
  id: string;
  name: string;
  individualCost: number;
  allCost: number;
  individualUpto: number;
  dateSelectionRequired: boolean;
  sortOrder: number;
}

export interface EventDate {
  id: string;
  event_id: string;
  date: string;
}

export interface Registration {
  id: string;
  first_name: string;
  spouse_first_name: string;
  last_name: string;
  address: string;
  phone: string;
  email: string;
  sponsorship_type: string;
  created_at: Date;
}

export interface RegistrationDate {
  id: string;
  registration_id: string;
  event_id: string;
  date: string | null;
  quantity: number;
  notes?: string | null;
  created_at?: Date | null;
  created_by?: string | null;
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  recovery_email: string | null;
  created_at: Date;
}

export interface EmailTemplate {
  id: string;
  name: string;
  to_field: string;
  cc_field: string | null;
  bcc_field: string | null;
  subject: string;
  body: string;
  created_at: Date;
  updated_at: Date;
  is_editable: boolean;
}

export interface EmailSettings {
  id: number;
  email_from: string;
  smtp_server: string;
  smtp_port_tls: number;
  smtp_port_ssl: number;
  smtp_username: string;
  smtp_password: string;
  connection_security: string;
  reply_to_email: string | null;
  updated_at: Date;
}

// Database class with all operations
class Database {
  // Events
  async getEvents(): Promise<Event[]> {
    const pool = await getPool();
    const result = await pool.request().query<Event>('SELECT * FROM dbo.events ORDER BY sortOrder ASC');
    return result.recordset;
  }

  async getEventById(id: string): Promise<Event | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query<Event>('SELECT * FROM dbo.events WHERE id = @id');
    return result.recordset[0] || null;
  }

  async createEvent(id: string, name: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .input('name', sql.NVarChar(255), name)
      .query('INSERT INTO dbo.events (id, name) VALUES (@id, @name)');
  }

  async updateEvent(id: string, name: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .input('name', sql.NVarChar(255), name)
      .query('UPDATE dbo.events SET name = @name WHERE id = @id');
  }

  async deleteEvent(id: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query('DELETE FROM dbo.events WHERE id = @id');
  }

  // Event Dates
  async getEventDates(eventId: string): Promise<EventDate[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('eventId', sql.NVarChar(50), eventId)
      .query<EventDate>('SELECT * FROM dbo.event_dates WHERE event_id = @eventId ORDER BY date');
    return result.recordset;
  }

  async createEventDate(id: string, eventId: string, date: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .input('eventId', sql.NVarChar(50), eventId)
      .input('date', sql.NVarChar(50), date)
      .query('INSERT INTO dbo.event_dates (id, event_id, date) VALUES (@id, @eventId, @date)');
  }

  async deleteEventDate(id: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query('DELETE FROM dbo.event_dates WHERE id = @id');
  }

  // Registrations
  async getRegistrations(): Promise<Registration[]> {
    const pool = await getPool();
    const result = await pool.request()
      .query<Registration>('SELECT * FROM dbo.registrations ORDER BY created_at DESC');
    return result.recordset;
  }

  async getRegistrationById(id: string): Promise<Registration | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query<Registration>('SELECT * FROM dbo.registrations WHERE id = @id');
    return result.recordset[0] || null;
  }

  async createRegistration(data: Omit<Registration, 'created_at'>): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), data.id)
      .input('firstName', sql.NVarChar(255), data.first_name)
      .input('spouseFirstName', sql.NVarChar(255), data.spouse_first_name)
      .input('lastName', sql.NVarChar(255), data.last_name)
      .input('address', sql.NVarChar(sql.MAX), data.address)
      .input('phone', sql.NVarChar(50), data.phone)
      .input('email', sql.NVarChar(255), data.email)
      .input('sponsorshipType', sql.NVarChar(100), data.sponsorship_type)
      .query(`
        INSERT INTO dbo.registrations 
        (id, first_name, spouse_first_name, last_name, address, phone, email, sponsorship_type)
        VALUES (@id, @firstName, @spouseFirstName, @lastName, @address, @phone, @email, @sponsorshipType)
      `);
  }

  async deleteRegistration(id: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query('DELETE FROM dbo.registrations WHERE id = @id');
  }

  // Registration Dates
  async getRegistrationDates(registrationId: string): Promise<RegistrationDate[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('registrationId', sql.NVarChar(50), registrationId)
      .query<RegistrationDate>('SELECT * FROM dbo.registration_dates WHERE registration_id = @registrationId');
    return result.recordset;
  }

  async createRegistrationDate(data: RegistrationDate): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), data.id)
      .input('registrationId', sql.NVarChar(50), data.registration_id)
      .input('eventId', sql.NVarChar(50), data.event_id)
      .input('date', sql.NVarChar(50), data.date)
      .input('quantity', sql.Int, data.quantity)
      .input('notes', sql.NVarChar(sql.MAX), data.notes || null)
      .input('createdBy', sql.NVarChar(50), data.created_by || null)
      .query(`
        INSERT INTO dbo.registration_dates (id, registration_id, event_id, date, quantity, notes, created_at, created_by)
        VALUES (@id, @registrationId, @eventId, @date, @quantity, @notes, GETUTCDATE(), @createdBy)
      `);
  }

  async getAvailableEventDatesForRegistration(registrationId: string, year: string): Promise<any[]> {
    const pool = await getPool();
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.request()
      .input('registrationId', sql.NVarChar(50), registrationId)
      .input('year', sql.NVarChar(10), `%${year}%`)
      .input('today', sql.NVarChar(50), today)
      .query(`
        SELECT 
          ed.id,
          ed.event_id,
          e.name as event_name,
          ed.date,
          ed.title as date_title,
          e.individualCost as price
        FROM dbo.event_dates ed
        JOIN dbo.events e ON ed.event_id = e.id
        WHERE 
          ed.date LIKE @year
          AND ed.date >= @today
          AND NOT EXISTS (
            SELECT 1 FROM dbo.registration_dates rd 
            WHERE rd.event_id = ed.event_id 
            AND rd.date = ed.date 
            AND rd.registration_id = @registrationId
          )
        ORDER BY ed.date ASC
      `);
    return result.recordset;
  }

  // Users
  async getUsers(): Promise<User[]> {
    const pool = await getPool();
    const result = await pool.request()
      .query<User>('SELECT * FROM dbo.users ORDER BY created_at DESC');
    return result.recordset;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query<User>('SELECT * FROM dbo.users WHERE email = @email');
    return result.recordset[0] || null;
  }

  async createUser(data: Omit<User, 'created_at'>): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), data.id)
      .input('email', sql.NVarChar(255), data.email)
      .input('password', sql.NVarChar(255), data.password)
      .input('role', sql.NVarChar(50), data.role)
      .input('recoveryEmail', sql.NVarChar(255), data.recovery_email)
      .query(`
        INSERT INTO dbo.users (id, email, password, role, recovery_email)
        VALUES (@id, @email, @password, @role, @recoveryEmail)
      `);
  }

  async updateUser(id: string, data: Partial<Omit<User, 'id' | 'created_at'>>): Promise<void> {
    const pool = await getPool();
    const updates: string[] = [];
    const request = pool.request().input('id', sql.NVarChar(50), id);

    if (data.email !== undefined) {
      updates.push('email = @email');
      request.input('email', sql.NVarChar(255), data.email);
    }
    if (data.password !== undefined) {
      updates.push('password = @password');
      request.input('password', sql.NVarChar(255), data.password);
    }
    if (data.role !== undefined) {
      updates.push('role = @role');
      request.input('role', sql.NVarChar(50), data.role);
    }
    if (data.recovery_email !== undefined) {
      updates.push('recovery_email = @recoveryEmail');
      request.input('recoveryEmail', sql.NVarChar(255), data.recovery_email);
    }

    if (updates.length > 0) {
      await request.query(`UPDATE dbo.users SET ${updates.join(', ')} WHERE id = @id`);
    }
  }

  async deleteUser(id: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query('DELETE FROM dbo.users WHERE id = @id');
  }

  async getUserById(id: string): Promise<User | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query<User>('SELECT id, email, role, recovery_email FROM dbo.users WHERE id = @id');
    return result.recordset[0] || null;
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .input('password', sql.NVarChar(255), password)
      .query<User>('SELECT * FROM dbo.users WHERE email = @email AND password = @password');
    return result.recordset[0] || null;
  }

  // Email Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    const pool = await getPool();
    const result = await pool.request()
      .query<EmailTemplate>('SELECT * FROM dbo.email_templates where is_editable<> 0 ORDER BY created_at DESC');
    return result.recordset;
  }

  async getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query<EmailTemplate>('SELECT * FROM dbo.email_templates WHERE id = @id');
    return result.recordset[0] || null;
  }

  async createEmailTemplate(data: Omit<EmailTemplate, 'created_at' | 'updated_at'>): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), data.id)
      .input('name', sql.NVarChar(255), data.name)
      .input('toField', sql.NVarChar(sql.MAX), data.to_field)
      .input('ccField', sql.NVarChar(sql.MAX), data.cc_field)
      .input('bccField', sql.NVarChar(sql.MAX), data.bcc_field)
      .input('subject', sql.NVarChar(sql.MAX), data.subject)
      .input('body', sql.NVarChar(sql.MAX), data.body)
      .query(`
        INSERT INTO dbo.email_templates (id, name, to_field, cc_field, bcc_field, subject, body)
        VALUES (@id, @name, @toField, @ccField, @bccField, @subject, @body)
      `);
  }

  async updateEmailTemplate(id: string, data: Partial<Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const pool = await getPool();
    const updates: string[] = ['updated_at = GETUTCDATE()'];
    const request = pool.request().input('id', sql.NVarChar(50), id);

    if (data.name !== undefined) {
      updates.push('name = @name');
      request.input('name', sql.NVarChar(255), data.name);
    }
    if (data.to_field !== undefined) {
      updates.push('to_field = @toField');
      request.input('toField', sql.NVarChar(sql.MAX), data.to_field);
    }
    if (data.cc_field !== undefined) {
      updates.push('cc_field = @ccField');
      request.input('ccField', sql.NVarChar(sql.MAX), data.cc_field);
    }
    if (data.bcc_field !== undefined) {
      updates.push('bcc_field = @bccField');
      request.input('bccField', sql.NVarChar(sql.MAX), data.bcc_field);
    }
    if (data.subject !== undefined) {
      updates.push('subject = @subject');
      request.input('subject', sql.NVarChar(sql.MAX), data.subject);
    }
    if (data.body !== undefined) {
      updates.push('body = @body');
      request.input('body', sql.NVarChar(sql.MAX), data.body);
    }

    if (updates.length > 1) {
      await request.query(`UPDATE dbo.email_templates SET ${updates.join(', ')} WHERE id = @id`);
    }
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .query('DELETE FROM dbo.email_templates WHERE id = @id');
  }

  // Email Settings
  async getEmailSettings(): Promise<EmailSettings | null> {
    const pool = await getPool();
    const result = await pool.request()
      .query<EmailSettings>('SELECT * FROM dbo.email_settings WHERE id = 1');
    return result.recordset[0] || null;
  }

  async updateEmailSettings(data: Partial<Omit<EmailSettings, 'id' | 'updated_at'>>): Promise<void> {
    const pool = await getPool();
    const updates: string[] = ['updated_at = GETUTCDATE()'];
    const request = pool.request();

    if (data.email_from !== undefined) {
      updates.push('email_from = @emailFrom');
      request.input('emailFrom', sql.NVarChar(255), data.email_from);
    }
    if (data.smtp_server !== undefined) {
      updates.push('smtp_server = @smtpServer');
      request.input('smtpServer', sql.NVarChar(255), data.smtp_server);
    }
    if (data.smtp_port_tls !== undefined) {
      updates.push('smtp_port_tls = @smtpPortTls');
      request.input('smtpPortTls', sql.Int, data.smtp_port_tls);
    }
    if (data.smtp_port_ssl !== undefined) {
      updates.push('smtp_port_ssl = @smtpPortSsl');
      request.input('smtpPortSsl', sql.Int, data.smtp_port_ssl);
    }
    if (data.smtp_username !== undefined) {
      updates.push('smtp_username = @smtpUsername');
      request.input('smtpUsername', sql.NVarChar(255), data.smtp_username);
    }
    if (data.smtp_password !== undefined) {
      updates.push('smtp_password = @smtpPassword');
      request.input('smtpPassword', sql.NVarChar(255), data.smtp_password);
    }
    if (data.connection_security !== undefined) {
      updates.push('connection_security = @connectionSecurity');
      request.input('connectionSecurity', sql.NVarChar(50), data.connection_security);
    }
    if (data.reply_to_email !== undefined) {
      updates.push('reply_to_email = @replyToEmail');
      request.input('replyToEmail', sql.NVarChar(255), data.reply_to_email);
    }

    if (updates.length > 1) {
      await request.query(`
        IF EXISTS (SELECT 1 FROM dbo.email_settings WHERE id = 1)
          UPDATE dbo.email_settings SET ${updates.join(', ')} WHERE id = 1
        ELSE
          INSERT INTO dbo.email_settings (id, email_from, smtp_server, smtp_username, smtp_password)
          VALUES (1, @emailFrom, @smtpServer, @smtpUsername, @smtpPassword)
      `);
    }
  }

  // Advanced queries
  async getRegistrationsWithEvents(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        r.id,
        r.first_name,
        r.spouse_first_name,
        r.last_name,
        r.address,
        r.phone,
        r.email,
        r.sponsorship_type,
        r.created_at,
        rd.event_id,
        e.name AS event_name,
        rd.date AS event_date,
        rd.quantity
      FROM dbo.registrations r
      LEFT JOIN dbo.registration_dates rd ON r.id = rd.registration_id
      LEFT JOIN dbo.events e ON rd.event_id = e.id
      ORDER BY r.created_at DESC
    `);
    return result.recordset;
  }

  async getEventStatistics(): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT 
        e.id,
        e.name,
        COUNT(DISTINCT rd.registration_id) AS total_registrations,
        SUM(rd.quantity) AS total_quantity
      FROM dbo.events e
      LEFT JOIN dbo.registration_dates rd ON e.id = rd.event_id
      GROUP BY e.id, e.name
      ORDER BY e.name
    `);
    return result.recordset;
  }

  async searchRegistrations(query: string): Promise<Registration[]> {
    const pool = await getPool();
    const q = `%${query}%`;
    const result = await pool.request()
      .input('q', sql.NVarChar(sql.MAX), q)
      .query<Registration>(`
        SELECT * FROM dbo.registrations 
        WHERE first_name LIKE @q OR last_name LIKE @q OR email LIKE @q OR phone LIKE @q
        ORDER BY created_at DESC
      `);
    return result.recordset;
  }

  async getRegistrationsByIds(ids: string[]): Promise<Registration[]> {
    const pool = await getPool();
    const placeholders = ids.map((_, i) => `@id${i}`).join(',');
    const request = pool.request();
    ids.forEach((id, i) => {
      request.input(`id${i}`, sql.NVarChar(50), id);
    });
    const result = await request.query<Registration>(`
      SELECT DISTINCT * FROM dbo.registrations
      WHERE id IN (${placeholders})
    `);
    return result.recordset;
  }

  async getRegistrationEventsWithDetails(registrationId: string): Promise<any[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('registrationId', sql.NVarChar(50), registrationId)
      .query(`
        SELECT 
          e.id as event_id,
          e.name as event_name,
          e.dateSelectionRequired,
          rd.date,
          rd.quantity,
          ed.title as date_title
        FROM dbo.registration_dates rd
        JOIN dbo.events e ON rd.event_id = e.id
        LEFT JOIN dbo.event_dates ed ON rd.event_id = ed.event_id AND rd.date = ed.date
        WHERE rd.registration_id = @registrationId
        ORDER BY e.sortOrder ASC, rd.date ASC
      `);
    return result.recordset;
  }

  async updateEventDateTitle(id: string, title: string): Promise<void> {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.NVarChar(50), id)
      .input('title', sql.NVarChar(255), title)
      .query('UPDATE dbo.event_dates SET title = @title WHERE id = @id');
  }

  async getRegistrationsByDate(date: string): Promise<Registration[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('date', sql.NVarChar(50), date)
      .query<Registration>(`
        SELECT r.* FROM dbo.registrations r
        JOIN dbo.registration_dates rd ON r.id = rd.registration_id
        WHERE rd.date = @date
        GROUP BY r.id, r.first_name, r.spouse_first_name, r.last_name, r.address, r.phone, r.email, r.sponsorship_type, r.created_at
        ORDER BY r.created_at DESC
      `);
    return result.recordset;
  }

  async getRegistrationsByYear(year: string): Promise<Registration[]> {
    const pool = await getPool();
    const result = await pool.request()
      .input('year', sql.NVarChar(10), `%${year}%`)
      .query<Registration>(`
        SELECT DISTINCT r.* FROM dbo.registrations r
        JOIN dbo.registration_dates rd ON r.id = rd.registration_id
        WHERE rd.date LIKE @year
        ORDER BY r.created_at DESC
      `);
    return result.recordset;
  }
}

// Export singleton instance
const db = new Database();
export default db;

// Export connection pool for advanced usage
export { getPool, sql };
