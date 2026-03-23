import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { siteConfig } from "@/lib/site-config";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function GET(req: NextRequest) {
  const caseId = req.nextUrl.searchParams.get("case_id");
  if (!caseId) {
    return NextResponse.json({ error: "case_id required" }, { status: 400 });
  }

  const { data: caseData, error } = await supabase
    .from("cases")
    .select("id, chief_complaint, structured_summary, patient_id")
    .eq("id", caseId)
    .single();

  if (error || !caseData) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  let patientName = "";
  try {
    const raw = caseData.structured_summary;
    const summary = (raw && typeof raw === "object") ? raw : JSON.parse(raw || "{}");
    patientName = summary.patient_name || "";
  } catch { /* ignore */ }

  const { data: existing } = await supabase
    .from("follow_up_sessions")
    .select("id")
    .eq("case_id", caseId)
    .limit(1);

  return NextResponse.json({
    case_id: caseData.id,
    chief_complaint: caseData.chief_complaint,
    patient_name: patientName,
    already_submitted: existing && existing.length > 0,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { case_id, rating, comment, side_effects } = body;

    if (!case_id || rating === undefined || rating === null) {
      return NextResponse.json({ error: "case_id and rating required" }, { status: 400 });
    }

    const parsedRating = typeof rating === "number" ? rating : parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 });
    }

    const { data: caseData } = await supabase
      .from("cases")
      .select("id, patient_id, chief_complaint, structured_summary")
      .eq("id", case_id)
      .single();

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    // Prevent duplicate submissions
    const { data: existing } = await supabase
      .from("follow_up_sessions")
      .select("id")
      .eq("case_id", case_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Already submitted" }, { status: 409 });
    }

    const { error: insertErr } = await supabase.from("follow_up_sessions").insert({
      case_id,
      patient_id: caseData.patient_id,
      rating: parsedRating,
      comment: comment || null,
      side_effects: side_effects || [],
      created_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("Follow-up insert error:", insertErr);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    // Notify physician if side effects reported
    if (side_effects && side_effects.length > 0) {
      let patientName = "";
      try {
        const raw = caseData.structured_summary;
        const summary = (raw && typeof raw === "object") ? raw : JSON.parse(raw || "{}");
        patientName = summary.patient_name || "";
      } catch { /* ignore */ }

      await notifyPhysicianFollowup(patientName, caseData.chief_complaint, side_effects, parsedRating, comment);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Follow-up error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function notifyPhysicianFollowup(
  patientName: string,
  chiefComplaint: string,
  sideEffects: string[],
  rating: number,
  comment: string
) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const text = `[${siteConfig.telegramPrefix} 후속 조사 - 부작용 보고]
환자: ${patientName || "미제공"}
주 호소: ${chiefComplaint || ""}
만족도: ${"⭐".repeat(rating)} (${rating}/5)
부작용: ${sideEffects.join(", ")}
${comment ? `코멘트: ${comment}` : ""}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
    });
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}
