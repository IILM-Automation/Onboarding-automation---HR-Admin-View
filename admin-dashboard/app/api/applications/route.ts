import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  // Interviewers may list candidates; the backend strips salary for them.
  return proxy("/applications" + (qs ? `?${qs}` : ""), { roles: ["admin", "hr", "interviewer"] });
}
