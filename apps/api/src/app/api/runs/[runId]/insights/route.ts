import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const { insight_ids, approved } = await req.json();

  if (!Array.isArray(insight_ids)) {
    return NextResponse.json({ error: "insight_ids must be an array" }, { status: 400 });
  }

  const { error } = await supabase
    .from("insights")
    .update({ approved })
    .eq("run_id", runId)
    .in("id", insight_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
