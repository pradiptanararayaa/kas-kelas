"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("theme"); } catch {}
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", d);
    setDark(d);
  }, []);
  function toggle() {
    const d = !dark;
    const root = document.documentElement;
    root.classList.add("theme-anim");
    setTimeout(() => root.classList.remove("theme-anim"), 450);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch {}
    setDark(d);
  }
  return (
    <button type="button" key={String(dark)} onClick={toggle} aria-label="Ganti tema" className="keep chip">
      {dark ? <Sun size={15} /> : <Moon size={15} />}<span className="hidden sm:inline">{dark ? "Terang" : "Gelap"}</span>
    </button>
  );
}
