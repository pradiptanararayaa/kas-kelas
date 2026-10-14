"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function SearchBox({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  const router = useRouter();
  const path = usePathname();
  const [v, setV] = useState(defaultValue);
  const [pending, start] = useTransition();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => start(() => router.replace(v ? `${path}?q=${encodeURIComponent(v)}` : path, { scroll: false })), 300);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="w-full" style={{ paddingLeft: "2.4rem", opacity: pending ? 0.7 : 1 }} />
    </div>
  );
}
