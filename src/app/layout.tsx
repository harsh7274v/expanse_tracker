import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { TransactionProvider } from "@/context/TransactionContext";
import { RouteLoadingProvider } from "@/context/RouteLoadingContext";
import RouteLoadingSpinner from "@/components/RouteLoadingSpinner";

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
