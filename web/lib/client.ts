export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(path, { ...init, cache: "no-store" });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${r.status}). Please retry.`,
    );
  }
  return r.status === 204 ? (undefined as T) : r.json();
}
export const number = (n: number | null | undefined) =>
  n == null
    ? "Unavailable"
    : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
export const date = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const bytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KiB`
      : `${(n / 1048576).toFixed(1)} MiB`;
