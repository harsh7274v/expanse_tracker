"use client";
import { useRouteLoading } from "@/context/RouteLoadingContext";
import AnimatedLoadingDots from "./AnimatedLoadingDots";

export default function RouteLoadingSpinner() {
  const { loading } = useRouteLoading();
  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none">
      <div className="flex flex-col items-center gap-4">
        <img src="/favicon.ico" alt="Loading" className="w-12 h-12 animate-pulse" />
        <div className="text-blue-600 text-lg font-medium">
          <AnimatedLoadingDots />
        </div>
      </div>
    </div>
  );
} 