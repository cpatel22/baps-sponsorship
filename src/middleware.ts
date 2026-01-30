import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This middleware runs on every request
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin route restriction
  // Only allow specific admin paths, redirect to home for any others
  if (pathname.startsWith('/admin')) {
    const allowedAdminPaths = ['/admin/details', '/admin/lookup', '/admin/settings'];

    // Check if the current path is allowed (exact match or sub-path)
    const isAllowed = allowedAdminPaths.some(path =>
      pathname === path || pathname.startsWith(`${path}/`)
    );

    if (!isAllowed) {
      // Redirect to home page if not in allowed list
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

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
