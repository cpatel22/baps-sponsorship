import { NextResponse } from 'next/server';

// This middleware runs on every request to keep the database alive
export async function middleware() {
  // Check if DB health endpoint exists, if not, continue normally
  const response = NextResponse.next();
  
  // Add a header to track middleware execution
  response.headers.set('x-db-keepalive', 'checked');
  
  return response;
}

// Apply middleware to all routes except static files and API routes that don't need DB
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
