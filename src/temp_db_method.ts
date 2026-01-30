
  async getAvailableEventDatesForRegistration(registrationId: string, year: string): Promise < any[] > {
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
          ed.title as date_title
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
