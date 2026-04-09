import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET all signals for a run
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH to approve/reject signals
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { signal_ids, approved } = await req.json();

  if (!Array.isArray(signal_ids)) {
    return NextResponse.json({ error: "signal_ids must be an array" }, { status: 400 });
  }

  const { error } = await supabase
    .from("signals")
    .update({ approved })
    .eq("run_id", runId)
    .in("id", signal_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
