import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { data, error } = await supabase
    .from("ideas")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { idea_ids } = await req.json();
  // Mark non-selected ideas as rejected by deleting them or flagging
  // For simplicity: just return OK — ideas don't have an approved field yet
  // The frontend uses this to know which ideas to pass to next stage
  return NextResponse.json({ ok: true, idea_ids });
}
