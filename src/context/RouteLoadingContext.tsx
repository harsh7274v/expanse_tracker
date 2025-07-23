"use client";
import { createContext, useContext, useState, useEffect } from "react";

const RouteLoadingContext = createContext<{ loading: boolean }>({ loading: false });

export function RouteLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Next.js app router does not have router.events, so we use navigation events
    let timeout: NodeJS.Timeout | null = null;
    const handleStart = () => {
      // Add a slight delay to avoid flicker on fast transitions
      timeout = setTimeout(() => setLoading(true), 100);
    };
    const handleComplete = () => {
      if (timeout) clearTimeout(timeout);
      setLoading(false);
    };
    // Listen for navigation events
    window.addEventListener("next/navigation-start", handleStart);
    window.addEventListener("next/navigation-end", handleComplete);
    window.addEventListener("next/navigation-error", handleComplete);
    return () => {
      window.removeEventListener("next/navigation-start", handleStart);
      window.removeEventListener("next/navigation-end", handleComplete);
      window.removeEventListener("next/navigation-error", handleComplete);
    };
  }, []);

  return (
    <RouteLoadingContext.Provider value={{ loading }}>
      {children}
    </RouteLoadingContext.Provider>
  );
}

export function useRouteLoading() {
  return useContext(RouteLoadingContext);
} 