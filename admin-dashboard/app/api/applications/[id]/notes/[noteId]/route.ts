import { NextRequest } from "next/server";
import { proxy } from "@/lib/backend";

export const runtime = "nodejs";

// Delete one interview note. HR / super-admin only (backend also enforces this).
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await ctx.params;
  return proxy(
    `/applications/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
    { method: "DELETE", roles: ["admin", "hr"] }
  );
}
