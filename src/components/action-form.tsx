"use client";
import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type R = { ok: boolean; msg: string };
const V = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
  ghost: "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};
export function ActionForm({ action, label, className, children, variant = "primary" }: {
  action: (p: R, f: FormData) => Promise<R>; label: string; className?: string; children?: React.ReactNode; variant?: keyof typeof V;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [s, run, pending] = useActionState(action, { ok: true, msg: "" });
  useEffect(() => { if (s.ok && s.msg) ref.current?.reset(); }, [s]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      <button disabled={pending} className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium disabled:opacity-60 ${V[variant]}`}>
        {pending && <Loader2 size={14} className="animate-spin" />}{pending ? "Memproses…" : label}
      </button>
      {s.msg && (
        <p role="status" className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${s.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {s.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}{s.msg}
        </p>
      )}
    </form>
  );
}
