import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "Rathinam Anugraha 2026",
    template: "%s | Anugraha 2026",
  },
  description:
    "Anugraha 2026 — complete your first-day induction for Rathinam Technical Campus / Rathinam Global Deemed University",
  keywords: ["Rathinam", "induction", "Anugraha 2026", "student onboarding"],
  robots: "noindex, nofollow", // keep off public search until go-live
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent pinch-zoom on form fields (avoids accidental reflow)
  userScalable: false,
  themeColor: "#4E9A2F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              fontFamily: "var(--font-geist-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
