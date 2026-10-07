"use client";
import { ErrorNotice } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorNotice
      message="This page could not be loaded. Please retry."
      retry={reset}
    />
  );
}
