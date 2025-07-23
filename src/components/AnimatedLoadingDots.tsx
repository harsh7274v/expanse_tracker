import React, { useEffect, useState } from "react";

export default function AnimatedLoadingDots({ text = "Loading" }: { text?: string }) {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return <span>{text}{".".repeat(dots)}</span>;
} 