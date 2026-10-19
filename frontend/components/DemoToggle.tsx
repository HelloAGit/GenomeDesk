"use client";
import { useRouter } from "next/navigation";

export function DemoToggle({ demo }: { demo: boolean }) {
  const router = useRouter();
  function toggle() {
    document.cookie = demo ? "gd_demo=; path=/; max-age=0; samesite=lax" : "gd_demo=1; path=/; max-age=2592000; samesite=lax";
    router.refresh();
  }
  return (
    <button type="button" onClick={toggle} aria-pressed={demo} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
      Demo mode: {demo ? "on" : "off"}
    </button>
  );
}
