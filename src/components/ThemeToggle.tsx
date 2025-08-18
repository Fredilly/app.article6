"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = (stored as "light" | "dark" | null) ?? (prefersDark ? "dark" : "light");
    setMode(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem("theme", next);
  };

  return (
    <button onClick={toggle} className="btn" aria-label="Toggle dark mode">
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
}
