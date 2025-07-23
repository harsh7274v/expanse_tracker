"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LoginForm } from "../components/login-form";
import AnimatedLoadingDots from "@/components/AnimatedLoadingDots";

export default function Home() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setRedirecting(true);
        router.replace("/dashboard");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (checkingAuth || redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-200">
        <div className="flex flex-col items-center gap-4">
          <img src="/favicon.ico" alt="Loading" className="w-12 h-12 animate-pulse" />
          <div className="text-blue-600 text-lg font-medium">
            <AnimatedLoadingDots text="" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-200">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
