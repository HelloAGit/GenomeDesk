import { NextResponse, type NextRequest } from "next/server";

// ?demo=1 / ?demo=0 sets the demo cookie, then redirects to the clean URL.
export function middleware(req: NextRequest) {
  const flag = req.nextUrl.searchParams.get("demo");
  if (flag !== "1" && flag !== "0") return NextResponse.next();
  const url = req.nextUrl.clone();
  url.searchParams.delete("demo");
  const res = NextResponse.redirect(url);
  if (flag === "1") res.cookies.set("gd_demo", "1", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  else res.cookies.delete("gd_demo");
  return res;
}

export const config = { matcher: ["/((?!api/|_next/|favicon.ico).*)"] };
