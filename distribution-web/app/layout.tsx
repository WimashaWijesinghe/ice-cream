import type { Metadata } from "next";
import Sidebar from "../components/Sidebar";
import SessionGate from "../components/SessionGate";
import LogoutButton from "../components/LogoutButton";
import "./globals.css";

export const instant = false;

export const metadata: Metadata = {
  title: "Distribution Management",
  description: "Distribution POS and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionGate>
          <div className="app-shell">
            <Sidebar />

            <div className="workspace">
              <header className="topbar">
                <strong>Distribution Management System</strong>

                <span>
                  Web Edition <LogoutButton />
                </span>
              </header>

              <main>{children}</main>
            </div>
          </div>
        </SessionGate>
      </body>
    </html>
  );
}