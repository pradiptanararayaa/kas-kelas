"use client";
import "@fontsource-variable/plus-jakarta-sans";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeScript } from "@/components/theme-script";
import { Wallet, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Gagal masuk"); else { router.push("/"); router.refresh(); }
    } catch { setError("Tidak dapat terhubung ke server"); } finally { setLoading(false); }
  }

  return (
    <main className="login flex min-h-screen items-center justify-center">
      <ThemeScript />
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black"><Wallet size={26} /></span>
          <h1 className="text-2xl font-bold">Kas Kelas XII</h1>
          <p className="sub text-sm">Kelola kas kelas dengan transparan</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <label className="text-sm font-medium">Username
            <input name="username" required autoComplete="username" className="mt-1 w-full" />
          </label>
          <label className="text-sm font-medium">Password
            <span className="relative mt-1 block">
              <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" className="w-full pr-11" />
              <button type="button" onClick={() => setShow(!show)} aria-label="Tampilkan password" className="keep absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
          <button disabled={loading} className="inline-flex items-center justify-center gap-2 bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {loading && <Loader2 size={16} className="animate-spin" />}{loading ? "Memproses…" : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
