import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // HR is the primary user; admins may also invite.
  return proxy("/invites", { method: "POST", body, roles: ["hr", "admin"] });
}
