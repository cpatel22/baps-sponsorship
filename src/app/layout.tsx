import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getCurrentUser, logout } from "./actions";
import { User, LogOut, Settings } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sponsorship Management",
  description: "Event sponsorship registration and management",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="navbar">
          <div className="container flex justify-between items-center" style={{ padding: '1rem 2rem' }}>
            <Link href="/" className="logo">
              BAPS Orlando
            </Link>
            <div className="flex items-center">
              <Link href="/" className="nav-link">Home</Link>

              {user ? (
                <>
                  <Link href="/admin/eventMaster" className="nav-link">Event Master</Link>
                  <Link href="/admin/lookup" className="nav-link">Lookup</Link>
                  <Link href="/admin/users" className="nav-link">Users</Link>

                  <div className="flex items-center gap-4 ml-4 pl-4" style={{ borderLeft: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User size={16} />
                      {user.email.split('@')[0]}
                    </div>
                    <form action={logout}>
                      <button type="submit" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <LogOut size={16} />
                        Logout
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <Link href="/login" className="nav-link">Admin Login</Link>
              )}
            </div>
          </div>
        </nav>
        <main>
          {children}
        </main>
        <style dangerouslySetInnerHTML={{
          __html: `
          .navbar {
            background: var(--card);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 50;
          }
          .logo {
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--primary);
          }
          .nav-link {
            font-weight: 500;
            color: var(--muted-foreground);
            transition: color 0.2s;
            padding: 0.5rem 1rem;
            border-radius: var(--radius);
          }
          .nav-link:hover {
            color: var(--primary);
            background: var(--secondary);
          }
        `}} />
      </body>
    </html>
  );
}
