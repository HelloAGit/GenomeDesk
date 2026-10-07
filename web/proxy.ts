import { NextRequest, NextResponse } from "next/server";
import { access } from "./lib/access";
export function proxy(request: NextRequest) {
  // Public liveness endpoint contains no workspace or backend data.
  if (request.nextUrl.pathname === "/health") return NextResponse.next();
  return access(request) || NextResponse.next();
}
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
