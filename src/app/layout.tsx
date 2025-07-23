import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TransactionProvider } from "@/context/TransactionContext";
import { RouteLoadingProvider } from "@/context/RouteLoadingContext";
import RouteLoadingSpinner from "@/components/RouteLoadingSpinner";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Expense Tracker",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
    { rel: "icon", url: "/icon-192x192.png", type: "image/png", sizes: "192x192" },
    { rel: "icon", url: "/icon-512x512.png", type: "image/png", sizes: "512x512" },
    { rel: "apple-touch-icon", url: "/icon-192x192.png" }
  ],
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <TransactionProvider>
          <RouteLoadingProvider>
            <RouteLoadingSpinner />
            {children}
          </RouteLoadingProvider>
        </TransactionProvider>
      </body>
    </html>
  );
}
