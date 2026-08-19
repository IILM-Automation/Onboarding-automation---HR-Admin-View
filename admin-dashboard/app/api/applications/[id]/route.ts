import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // Interviewers may open a candidate; the backend strips salary for them.
  return proxy(`/applications/${encodeURIComponent(id)}`, { roles: ["admin", "hr", "interviewer"] });
}
