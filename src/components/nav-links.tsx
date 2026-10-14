"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { LayoutDashboard, Users, CalendarCheck, ArrowLeftRight, FileText, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { "/": LayoutDashboard, "/siswa": Users, "/pembayaran": CalendarCheck, "/transaksi": ArrowLeftRight, "/laporan": FileText };
type L = { href: string; label: string; short?: string };
const spring = { type: "spring" as const, stiffness: 420, damping: 34 };

export function NavLinks({ links, variant }: { links: L[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const on = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  if (variant === "side")
    return (
      <nav className="side-links">
        {links.map((l) => { const I = ICONS[l.href]; const a = on(l.href); return (
          <Link key={l.href} href={l.href} className={`side-link ${a ? "active" : ""}`}>
            {a && <motion.span layoutId="side-pill" className="side-pill" transition={spring} />}
            {I && <I size={18} />}<span>{l.label}</span>
          </Link>
        ); })}
      </nav>
    );
  return (
    <div className="bottom-bar">
      {links.map((l) => { const I = ICONS[l.href]; const a = on(l.href); return (
        <Link key={l.href} href={l.href} className={`bottom-link ${a ? "active" : ""}`}>
          {a && <motion.span layoutId="bottom-pill" className="bottom-pill" transition={spring} />}
          {I && <I size={20} />}{l.short ?? l.label}
        </Link>
      ); })}
    </div>
  );
}
