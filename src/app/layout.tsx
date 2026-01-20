import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { getCurrentUser, logout } from "./actions";
import { User, LogOut, Settings } from "lucide-react";
import NavBar from "@/components/NavBar";

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
        <NavBar user={user} />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
