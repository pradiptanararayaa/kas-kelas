"use client";
import Link from "next/link";
import { motion } from "motion/react";

/** Tab dengan pil yang meluncur antar pilihan. Memakai navigasi klien (tanpa muat ulang halaman). */
export function Tabs({ id, active, items }: { id: string; active: string; items: { key: string; label: string; href: string }[] }) {
  return (
    <div className="inline-flex gap-1 rounded-xl bg-neutral-100 p-1">
      {items.map((i) => {
        const on = i.key === active;
        return (
          <Link key={i.key} href={i.href} scroll={false} className="relative rounded-lg px-3.5 py-1.5 text-sm font-medium">
            {on && <motion.span layoutId={id} className="absolute inset-0 rounded-lg bg-emerald-600" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}
            <span className="relative" style={{ color: on ? "var(--on-ink)" : "var(--kmuted)", transition: "color .2s" }}>{i.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
