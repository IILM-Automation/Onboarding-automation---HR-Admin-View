import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

// Super-admin only: prefill values for the offer-letter form.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy(`/offer-letters/defaults/${encodeURIComponent(id)}`, {
    roles: ["admin"],
  });
}
