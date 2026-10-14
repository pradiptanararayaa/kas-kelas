"use client";
import { useRouter } from "next/navigation";

export function PeriodPicker({ t, type, value }: { t: string; type: string; value: string }) {
  const router = useRouter();
  return (
    <input key={t} type={type} defaultValue={value} className="w-full sm:max-w-xs"
      onChange={(e) => { const v = e.target.value; if (v && (type !== "number" || v.length === 4)) router.push(`?t=${t}&p=${v}`, { scroll: false }); }} />
  );
}
