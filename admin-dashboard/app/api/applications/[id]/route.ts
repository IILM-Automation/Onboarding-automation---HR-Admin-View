import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return proxy(`/applications/${encodeURIComponent(id)}`);
}
