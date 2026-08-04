import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

// Super-admin only: reassign an application's campus.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return proxy(`/applications/${encodeURIComponent(id)}/campus`, {
    method: "PATCH",
    body,
    roles: ["admin"],
  });
}
