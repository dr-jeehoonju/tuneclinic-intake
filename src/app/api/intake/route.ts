import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import {
  buildSystemPrompt,
  computeMissingFields,
  GREETING_MESSAGE,
  COMPLETION_MESSAGE,
} from "@/lib/prompts";
import { COMPLETE_INTAKE_TOOL } from "@/lib/tools";
import {
  checkSafetyKeywords,
  EMERGENCY_RESPONSE,
  buildFlagInjection,
} from "@/lib/safety";
import type {
  IntakeState,
  IntakeSession,
  IntakeMessage,
  ChatResponse,
  CompleteIntakeInput,
  QuickCollectData,
} from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_HISTORY = 40;
const DEEP_GATHER_MAX = 7;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Create new session
    if (!body.session_id && !body.message && !body.action) {
      return createSession();
    }

    // Quick collect submission
    if (body.session_id && body.action === "quick_collect" && body.data) {
      return handleQuickCollect(body.session_id, body.data as QuickCollectData);
    }

    // Chat message (deep_gather / confirmation)
    if (body.session_id && body.message) {
      return handleMessage(body.session_id, body.message);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("Intake API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createSession(): Promise<NextResponse> {
  const { data: patient, error: patientErr } = await supabase
    .from("patients")
    .insert({ language: "ko", status: "active" })
    .select()
    .single();

  if (patientErr || !patient) {
    console.error("Failed to create patient:", patientErr);
    return NextResponse.json(
      { error: "Failed to create patient", detail: patientErr?.message },
      { status: 500 }
    );
  }

  const { data: session, error: sessionErr } = await supabase
    .from("intake_sessions")
    .insert({
      patient_id: patient.id,
      current_state: "greeting",
      exchange_count: 0,
      fields_collected: [],
      fields_missing: computeMissingFields([]),
      channel: "web",
    })
    .select()
    .single();

  if (sessionErr || !session) {
    console.error("Failed to create session:", sessionErr);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  await saveMessage(session.id, "assistant", GREETING_MESSAGE, "greeting", 0);
  await logAuditEvent("intake_started", "agent_intake", "intake_session", session.id, {
    patient_id: patient.id,
  });

  return NextResponse.json({
    reply: GREETING_MESSAGE,
    state: "greeting",
    session_id: session.id,
    is_complete: false,
    is_escalated: false,
  } as ChatResponse);
}

/**
 * Handle quick_collect: receive all click-form data at once,
 * store it, transition to deep_gather, and get first Claude response.
 */
async function handleQuickCollect(
  sessionId: string,
  data: QuickCollectData
): Promise<NextResponse> {
  const { data: session, error: sessionErr } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const s = session as IntakeSession;

  // Safety check on chief complaint
  const safety = checkSafetyKeywords(data.chief_complaint);
  let safetyInjection = "";
  if (safety.level === "emergency") {
    await saveMessage(sessionId, "patient", data.chief_complaint, "greeting", 0);
    await transitionState(sessionId, "greeting", "escalated", 0);
    const seq = await getNextSequenceNumber(sessionId);
    await saveMessage(sessionId, "assistant", EMERGENCY_RESPONSE, "escalated", seq);
    await notifyPhysician(sessionId, "EMERGENCY", safety.matchedKeywords);
    return NextResponse.json({
      reply: EMERGENCY_RESPONSE,
      state: "escalated",
      session_id: sessionId,
      is_complete: false,
      is_escalated: true,
    } as ChatResponse);
  }
  if (safety.level === "flag") {
    safetyInjection = buildFlagInjection(safety.matchedKeywords);
    await logAuditEvent("safety_keyword_detected", "agent_intake", "intake_session", sessionId, {
      matched_keywords: safety.matchedKeywords,
      source: "chief_complaint",
    });
  }

  // Build fields collected from quick collect data
  const fieldsCollected: string[] = ["chief_complaint", "skin_concerns", "patient_name", "patient_phone"];
  if (data.age_range) fieldsCollected.push("age_range");
  if (data.gender) fieldsCollected.push("gender");
  if (data.treatment_interests?.length > 0) fieldsCollected.push("treatment_interests");
  if (data.previous_treatments) fieldsCollected.push("previous_treatments");
  if (data.retinoid_use) fieldsCollected.push("current_skincare");
  if (data.pregnancy_status) fieldsCollected.push("pregnancy_status");

  const fieldsMissing = computeMissingFields(fieldsCollected);

  // Update patient record with name and phone
  if (data.patient_name || data.patient_phone) {
    await supabase
      .from("patients")
      .update({
        ...(data.patient_name ? { name: data.patient_name } : {}),
        ...(data.patient_phone ? { phone: data.patient_phone } : {}),
      })
      .eq("id", s.patient_id);
  }

  // Build a human-readable summary of the quick collect data
  const quickSummary = buildQuickSummary(data);

  // Store the quick collect as a system message for context
  const seq = await getNextSequenceNumber(sessionId);
  await saveMessage(
    sessionId,
    "system",
    `[사전 설문 결과]\n${quickSummary}`,
    "quick_collect",
    seq
  );

  // Store structured JSON for reliable parsing in forceCompleteIntake
  const seq1b = await getNextSequenceNumber(sessionId);
  await saveMessage(
    sessionId,
    "system",
    `[QUICK_COLLECT_JSON]${JSON.stringify(data)}`,
    "quick_collect",
    seq1b
  );

  // Store patient's chief complaint as a patient message
  const seq2 = await getNextSequenceNumber(sessionId);
  await saveMessage(
    sessionId,
    "patient",
    data.chief_complaint,
    "quick_collect",
    seq2
  );

  // Transition to deep_gather
  await supabase
    .from("intake_sessions")
    .update({
      current_state: "deep_gather",
      exchange_count: 1,
      fields_collected: fieldsCollected,
      fields_missing: fieldsMissing,
    })
    .eq("id", sessionId);

  await logAuditEvent("intake_state_transition", "agent_intake", "intake_session", sessionId, {
    from: "quick_collect",
    to: "deep_gather",
    quick_collect_fields: fieldsCollected,
  });

  // Call Claude for first deep_gather response
  let systemPrompt = buildSystemPrompt(
    "deep_gather",
    fieldsCollected,
    fieldsMissing,
    quickSummary
  );
  if (safetyInjection) {
    systemPrompt += safetyInjection;
  }

  const claudeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `[사전 설문 응답]\n${quickSummary}\n\n위 내용은 환자가 클릭형 설문에서 직접 선택한 답변입니다. 이 정보를 다시 물어보지 마세요.\n\n환자의 주 호소: ${data.chief_complaint}`,
      },
    ],
    tools: [COMPLETE_INTAKE_TOOL],
  });

  const textBlock = claudeResponse.content.find((b) => b.type === "text");
  const assistantReply =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "감사합니다. 몇 가지만 더 여쭤보겠습니다.";

  const seq3 = await getNextSequenceNumber(sessionId);
  await saveMessage(sessionId, "assistant", assistantReply, "deep_gather", seq3);

  return NextResponse.json({
    reply: assistantReply,
    state: "deep_gather",
    session_id: sessionId,
    is_complete: false,
    is_escalated: false,
  } as ChatResponse);
}

async function handleMessage(
  sessionId: string,
  message: string
): Promise<NextResponse> {
  const { data: session, error: sessionErr } = await supabase
    .from("intake_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const s = session as IntakeSession;

  if (["complete", "escalated", "abandoned"].includes(s.current_state)) {
    return NextResponse.json({
      reply: s.current_state === "escalated" ? EMERGENCY_RESPONSE : COMPLETION_MESSAGE,
      state: s.current_state,
      session_id: sessionId,
      is_complete: s.current_state === "complete",
      is_escalated: s.current_state === "escalated",
    });
  }

  const newExchange = s.exchange_count + 1;

  // Save patient message
  const nextSeq = await getNextSequenceNumber(sessionId);
  await saveMessage(sessionId, "patient", message, s.current_state, nextSeq);

  // --- Safety pre-processor ---
  const safety = checkSafetyKeywords(message);

  if (safety.level === "emergency") {
    await transitionState(sessionId, s.current_state, "escalated", newExchange);
    const seq = await getNextSequenceNumber(sessionId);
    await saveMessage(sessionId, "assistant", EMERGENCY_RESPONSE, "escalated", seq);
    await logAuditEvent("escalation_triggered", "agent_intake", "intake_session", sessionId, {
      matched_keywords: safety.matchedKeywords,
    });
    await notifyPhysician(sessionId, "EMERGENCY", safety.matchedKeywords);

    return NextResponse.json({
      reply: EMERGENCY_RESPONSE,
      state: "escalated",
      session_id: sessionId,
      is_complete: false,
      is_escalated: true,
    } as ChatResponse);
  }

  let currentState = s.current_state as IntakeState;
  const fieldsCollected = s.fields_collected || [];
  const fieldsMissing = s.fields_missing || computeMissingFields(fieldsCollected);

  // Auto-transition deep_gather → confirmation after enough exchanges
  if (currentState === "deep_gather" && newExchange >= DEEP_GATHER_MAX) {
    currentState = "confirmation";
    await transitionState(sessionId, "deep_gather", "confirmation", newExchange);
  }

  // Build system prompt — for deep_gather/confirmation, reconstruct quickSummary from system message
  let quickSummary: string | undefined;
  if (currentState === "deep_gather" || currentState === "confirmation") {
    quickSummary = await getQuickSummaryFromHistory(sessionId);
  }

  let systemPrompt = buildSystemPrompt(currentState, fieldsCollected, fieldsMissing, quickSummary, newExchange);

  if (safety.level === "flag") {
    systemPrompt += buildFlagInjection(safety.matchedKeywords);
    await logAuditEvent("safety_keyword_detected", "agent_intake", "intake_session", sessionId, {
      matched_keywords: safety.matchedKeywords,
    });
  }

  // Load conversation history
  const history = await getConversationHistory(sessionId);

  const messages: Anthropic.MessageParam[] = [];

  // For deep_gather, inject the quick collect summary as the first user message
  if ((currentState === "deep_gather" || currentState === "confirmation") && quickSummary) {
    messages.push({
      role: "user",
      content: `[사전 설문 응답]\n${quickSummary}\n\n위 내용은 환자가 클릭형 설문에서 직접 선택한 답변입니다. 이 정보를 다시 물어보지 마세요.`,
    });
  }

  for (const m of history) {
    if (m.role === "system") continue;
    const role = m.role === "patient" ? "user" as const : "assistant" as const;
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1] = {
        role,
        content: messages[messages.length - 1].content + "\n" + m.content_original,
      };
    } else {
      messages.push({ role, content: m.content_original });
    }
  }

  if (messages.length > 0 && messages[0].role === "assistant") {
    messages.shift();
  }

  const shouldOfferTool =
    currentState === "deep_gather" || currentState === "confirmation";

  const claudeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: shouldOfferTool ? [COMPLETE_INTAKE_TOOL] : undefined,
  });

  // --- Handle tool use (complete_intake) ---
  if (claudeResponse.stop_reason === "tool_use") {
    const toolBlock = claudeResponse.content.find((b) => b.type === "tool_use");
    const textBlock = claudeResponse.content.find((b) => b.type === "text");

    if (toolBlock && toolBlock.type === "tool_use") {
      const intakeData = toolBlock.input as CompleteIntakeInput;
      const assistantReply =
        textBlock && textBlock.type === "text" ? textBlock.text : COMPLETION_MESSAGE;

      await transitionState(sessionId, currentState, "structuring", newExchange);
      await createCase(sessionId, s.patient_id, intakeData);
      await transitionState(sessionId, "structuring", "complete", newExchange);

      const seq = await getNextSequenceNumber(sessionId);
      await saveMessage(sessionId, "assistant", assistantReply, "complete", seq);

      await supabase
        .from("intake_sessions")
        .update({
          current_state: "complete",
          exchange_count: newExchange,
          fields_collected: intakeData.fields_collected,
          fields_missing: intakeData.fields_missing || [],
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      await notifyPhysician(sessionId, intakeData.urgency.toUpperCase(), intakeData.risk_flags);

      return NextResponse.json({
        reply: assistantReply,
        state: "complete",
        session_id: sessionId,
        is_complete: true,
        is_escalated: false,
      } as ChatResponse);
    }
  }

  // --- Normal text response ---
  const textBlock = claudeResponse.content.find((b) => b.type === "text");
  const assistantReply =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "죄송합니다, 응답을 생성하지 못했습니다.";

  // Hard cap: if in confirmation and Claude didn't call tool, force complete
  if (currentState === "confirmation") {
    const forceReply = "감사합니다. 원장님이 상담 전에 케이스를 확인하실 예정입니다.\n좋은 상담이 되도록 준비하겠습니다.";
    await forceCompleteIntake(sessionId, s.patient_id, fieldsCollected, quickSummary || "");
    const seq = await getNextSequenceNumber(sessionId);
    await saveMessage(sessionId, "assistant", forceReply, "complete", seq);

    return NextResponse.json({
      reply: forceReply,
      state: "complete",
      session_id: sessionId,
      is_complete: true,
      is_escalated: false,
    } as ChatResponse);
  }

  const seq = await getNextSequenceNumber(sessionId);
  await saveMessage(sessionId, "assistant", assistantReply, currentState, seq);

  await supabase
    .from("intake_sessions")
    .update({ current_state: currentState, exchange_count: newExchange })
    .eq("id", sessionId);

  return NextResponse.json({
    reply: assistantReply,
    state: currentState,
    session_id: sessionId,
    is_complete: false,
    is_escalated: false,
  } as ChatResponse);
}

// ---- Helper functions ----

function buildQuickSummary(data: QuickCollectData): string {
  const lines: string[] = [];
  if (data.patient_name) lines.push(`- 성함: ${data.patient_name}`);
  if (data.patient_phone) lines.push(`- 연락처: ${data.patient_phone}`);
  lines.push(`- 주 호소: ${data.chief_complaint}`);
  if (data.skin_concerns?.length > 0)
    lines.push(`- 피부 고민: ${data.skin_concerns.join(", ")}`);
  if (data.treatment_interests?.length > 0)
    lines.push(`- 관심 시술: ${data.treatment_interests.join(", ")}`);
  else lines.push(`- 관심 시술: 특별히 없음`);
  if (data.age_range) lines.push(`- 연령대: ${data.age_range} (확인 완료 — 다시 묻지 마세요)`);
  if (data.gender) lines.push(`- 성별: ${data.gender} (확인 완료 — 다시 묻지 마세요)`);
  if (data.previous_treatments)
    lines.push(`- 이전 시술 경험: ${data.previous_treatments} (확인 완료 — 유무만 확인됨, "있음"이면 상세를 물어볼 수 있음)`);
  if (data.retinoid_use)
    lines.push(`- 레티놀/비타민A 사용: ${data.retinoid_use} (확인 완료 — 다시 묻지 마세요)`);
  if (data.pregnancy_status)
    lines.push(`- 임신/수유: ${data.pregnancy_status} (확인 완료 — 다시 묻지 마세요)`);
  return lines.join("\n");
}

async function getQuickSummaryFromHistory(sessionId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from("intake_messages")
    .select("content_original")
    .eq("session_id", sessionId)
    .eq("role", "system")
    .order("sequence_number", { ascending: true })
    .limit(1);

  if (data && data.length > 0) {
    return data[0].content_original.replace("[사전 설문 결과]\n", "");
  }
  return undefined;
}

async function saveMessage(
  sessionId: string,
  role: "patient" | "assistant" | "system",
  content: string,
  state: IntakeState,
  seq: number
) {
  await supabase.from("intake_messages").insert({
    session_id: sessionId,
    role,
    content_original: content,
    state_at_time: state,
    sequence_number: seq,
  });
}

async function getNextSequenceNumber(sessionId: string): Promise<number> {
  const { data } = await supabase
    .from("intake_messages")
    .select("sequence_number")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: false })
    .limit(1);

  return data && data.length > 0 ? data[0].sequence_number + 1 : 0;
}

async function getConversationHistory(sessionId: string): Promise<IntakeMessage[]> {
  const { data } = await supabase
    .from("intake_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("sequence_number", { ascending: true })
    .limit(MAX_HISTORY);

  return (data as IntakeMessage[]) || [];
}

async function transitionState(
  sessionId: string,
  from: IntakeState | string,
  to: IntakeState,
  exchangeCount: number
) {
  await supabase
    .from("intake_sessions")
    .update({ current_state: to, exchange_count: exchangeCount })
    .eq("id", sessionId);

  await logAuditEvent("intake_state_transition", "agent_intake", "intake_session", sessionId, {
    from,
    to,
    exchange_count: exchangeCount,
  });
}

async function createCase(
  sessionId: string,
  patientId: string,
  data: CompleteIntakeInput
) {
  const { data: caseData, error } = await supabase
    .from("cases")
    .insert({
      patient_id: patientId,
      intake_session_id: sessionId,
      chief_complaint: data.chief_complaint,
      structured_summary: JSON.stringify({
        patient_name: data.patient_name,
        patient_phone: data.patient_phone,
        skin_concerns: data.skin_concerns,
        treatment_interests: data.treatment_interests,
        age_range: data.age_range,
        gender: data.gender,
        fitzpatrick_estimate: data.fitzpatrick_estimate,
        current_skincare: data.current_skincare,
        sun_exposure: data.sun_exposure,
        previous_treatments: data.previous_treatments,
        medications: data.medications,
        allergies: data.allergies,
        pregnancy_status: data.pregnancy_status,
        budget_range: data.budget_range,
        timeline: data.timeline,
      }),
      risk_flags: data.risk_flags.map((flag) => ({ flag, detail: flag })),
      missing_info: (data.fields_missing || []).map((field) => ({
        field,
        reason: "환자가 언급하지 않음",
      })),
      urgency_level: data.urgency,
      status: "pending_review",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create case:", error);
    return;
  }

  await logAuditEvent("case_created", "agent_intake", "case", caseData.id, {
    session_id: sessionId,
    patient_id: patientId,
    urgency: data.urgency,
    risk_flags_count: data.risk_flags.length,
  });

  await logAuditEvent("intake_completed", "agent_intake", "intake_session", sessionId, {
    case_id: caseData.id,
  });
}

async function logAuditEvent(
  eventType: string,
  actor: string,
  resourceType: string,
  resourceId: string,
  payload: Record<string, unknown>
) {
  try {
    await supabase.from("audit_events").insert({
      event_type: eventType,
      actor,
      resource_type: resourceType,
      resource_id: resourceId,
      payload,
    });
  } catch (err) {
    console.error("Audit log error (non-blocking):", err);
  }
}

async function forceCompleteIntake(
  sessionId: string,
  patientId: string,
  fieldsCollected: string[],
  quickSummary: string
) {
  // Try to load structured JSON first (reliable), fall back to string parsing
  let data: QuickCollectData | null = null;
  const { data: jsonMsg } = await supabase
    .from("intake_messages")
    .select("content_original")
    .eq("session_id", sessionId)
    .eq("role", "system")
    .like("content_original", "[QUICK_COLLECT_JSON]%")
    .limit(1);

  if (jsonMsg && jsonMsg.length > 0) {
    try {
      data = JSON.parse(jsonMsg[0].content_original.replace("[QUICK_COLLECT_JSON]", ""));
    } catch { /* fall through to string parsing */ }
  }

  const history = await getConversationHistory(sessionId);
  const patientMessages = history.filter((m) => m.role === "patient").map((m) => m.content_original);
  const fullNarrative = patientMessages.join(" | ");

  const intakeData: CompleteIntakeInput = {
    chief_complaint: data?.chief_complaint || fullNarrative.slice(0, 200),
    patient_name: data?.patient_name || "",
    patient_phone: data?.patient_phone || "",
    skin_concerns: data?.skin_concerns || [],
    treatment_interests: (data?.treatment_interests || []).filter((t) => t !== "특별히 없음"),
    age_range: data?.age_range || "",
    gender: data?.gender === "여성" ? "female" : data?.gender === "남성" ? "male" : "unknown",
    previous_treatments: data?.previous_treatments || "",
    pregnancy_status: data?.pregnancy_status === "임신 중" ? "pregnant" : data?.pregnancy_status === "수유 중" ? "breastfeeding" : "not_pregnant",
    fields_collected: fieldsCollected,
    fields_missing: computeMissingFields(fieldsCollected),
    risk_flags: [],
    urgency: "normal",
  };

  await transitionState(sessionId, "confirmation", "structuring", 99);
  await createCase(sessionId, patientId, intakeData);
  await transitionState(sessionId, "structuring", "complete", 99);

  await supabase
    .from("intake_sessions")
    .update({
      current_state: "complete",
      fields_collected: intakeData.fields_collected,
      fields_missing: intakeData.fields_missing || [],
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await notifyPhysician(sessionId, "NORMAL", []);
}

async function notifyPhysician(sessionId: string, urgency: string, flags: string[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // Fetch patient info for notification
  let patientInfo = "";
  const { data: sessionData } = await supabase
    .from("intake_sessions")
    .select("patient_id")
    .eq("id", sessionId)
    .single();
  if (sessionData) {
    const { data: patientData } = await supabase
      .from("patients")
      .select("name, phone")
      .eq("id", sessionData.patient_id)
      .single();
    if (patientData) {
      if (patientData.name) patientInfo += `\n이름: ${patientData.name}`;
      if (patientData.phone) patientInfo += `\n연락처: ${patientData.phone}`;
    }
  }

  const flagText = flags.length > 0 ? `\nFlags: ${flags.join(", ")}` : "\nFlags: 없음";
  const text = `[에이전튠] ${urgency}\nSession: ${sessionId}${patientInfo}${flagText}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}
