import "@fontsource-variable/plus-jakarta-sans";
import { Suspense } from "react";
import { Wallet, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { ThemeScript } from "./theme-script";

const ROLE = { ADMIN: "Bendahara", KETUA: "Ketua kelas", SISWA: "Siswa" } as const;

async function NavInner() {
  const s = await getSession();
  const user = s ? await prisma.user.findUnique({ where: { id: s.uid }, select: { name: true } }) : null;
  const staff = s?.role === "ADMIN" || s?.role === "KETUA";
  const links = [{ href: "/", label: "Dashboard", short: "Beranda" }, ...(staff ? [
    { href: "/siswa", label: "Data Siswa", short: "Siswa" }, { href: "/pembayaran", label: "Pembayaran", short: "Bayar" },
    { href: "/transaksi", label: "Transaksi" }, { href: "/laporan", label: "Laporan" }] : [])];
  return (
    <>
      <header className="shell topbar">
        <div className="brand"><i><Wallet size={16} /></i>Kas Kelas XII</div>
        <div className="actions">
          <ThemeToggle />
          <form action="/api/auth/logout" method="post" style={{ flexDirection: "row" }}>
            <button className="keep chip"><LogOut size={15} /><span className="hidden sm:inline">Keluar</span></button>
          </form>
        </div>
      </header>
      <aside className="shell sidebar">
        <NavLinks links={links} variant="side" />
        <div className="profile">
          <span className="av">{(user?.name ?? "?").slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 text-sm"><p className="truncate font-medium">{user?.name ?? "-"}</p><small>{s ? ROLE[s.role] : ""}</small></div>
        </div>
      </aside>
      <NavLinks links={links} variant="bottom" />
    </>
  );
}
export function Nav() { return <><ThemeScript /><Suspense fallback={null}><NavInner /></Suspense></>; }
