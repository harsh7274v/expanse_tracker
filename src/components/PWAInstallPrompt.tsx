"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";

const STORAGE_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const onAppInstalled = () => {
      setShowPrompt(false);
      localStorage.setItem(STORAGE_KEY, "true");
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
        localStorage.setItem(STORAGE_KEY, "true");
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-zinc-900 border border-blue-500 shadow-lg rounded-lg px-6 py-4 flex items-center gap-4 animate-fade-in">
      <Image src="/icon-192x192.png" alt="App Icon" width={40} height={40} className="w-10 h-10 rounded" />
      <button
        onClick={handleInstall}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="ml-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-2xl font-bold"
        aria-label="Dismiss install prompt"
        style={{ lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
} 