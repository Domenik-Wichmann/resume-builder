import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "./admin.css";
import "./design-studio.css";
export const metadata: Metadata = {
  title: "Resume Builder · Evidence behind the experience",
  description:
    "Explore a structured career portfolio, ask grounded questions, and compare job requirements with career evidence.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
