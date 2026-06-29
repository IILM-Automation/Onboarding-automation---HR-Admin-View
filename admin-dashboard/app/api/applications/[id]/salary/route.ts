import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return proxy(`/applications/${encodeURIComponent(id)}/salary`, { method: "PATCH", body });
}
