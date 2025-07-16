"use client";
import { useRouteLoading } from "@/context/RouteLoadingContext";

export default function RouteLoadingSpinner() {
  const { loading } = useRouteLoading();
  if (!loading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin bg-white" />
        <div className="text-blue-600 text-lg font-medium">Loading...</div>
      </div>
    </div>
  );
} 