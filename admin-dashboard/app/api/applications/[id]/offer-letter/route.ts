import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

// Super-admin only: issue an offer letter. The backend re-checks both the
// role and the candidate's status — this role list is defence in depth,
// not the access control itself.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return proxy(`/applications/${encodeURIComponent(id)}/offer-letter`, {
    method: "POST",
    body,
    roles: ["admin"],
  });
}
