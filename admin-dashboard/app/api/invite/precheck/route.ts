import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

/**
 * Has this candidate applied before? Called as HR leaves the email field.
 * Campus redaction happens in the backend, so this is a plain pass-through.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email") || "";
  return proxy(`/invites/precheck?email=${encodeURIComponent(email)}`, {
    roles: ["hr", "admin"],
  });
}
