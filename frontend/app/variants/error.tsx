"use client";
import { btn, Notice } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3">
      <Notice tone="error" title="Something went wrong">The page failed to render. Please try again.</Notice>
      <button type="button" className={btn} onClick={reset}>Try again</button>
    </div>
  );
}
