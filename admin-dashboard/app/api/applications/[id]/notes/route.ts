import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

const ALL = ["admin", "hr", "interviewer"] as const;

// List every panelist's notes for a candidate.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy(`/applications/${encodeURIComponent(id)}/notes`, { roles: [...ALL] });
}

// Create / update ONE interviewer's note row.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return proxy(`/applications/${encodeURIComponent(id)}/notes`, {
    method: "PUT",
    body,
    roles: [...ALL],
  });
}
