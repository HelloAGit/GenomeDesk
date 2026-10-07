import "server-only";
import { NextRequest } from "next/server";
import { proxy } from "@/lib/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path.join("/"));
}
export { handle as GET, handle as POST, handle as DELETE };
