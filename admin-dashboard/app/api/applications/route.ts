import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return proxy("/applications" + (qs ? `?${qs}` : ""));
}
