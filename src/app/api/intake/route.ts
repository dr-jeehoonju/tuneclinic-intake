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
} from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_HISTORY = 10;
const OPEN_NARRATIVE_THRESHOLD = 3;

// POST /api/intake  — create new session
// POST /api/intake  — with session_id + message: chat exchange
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.session_id && !body.message) {
      return createSession();
    }

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
      { error: "Failed to create patient" },
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
    channel: "web",
  });

  await transitionState(session.id, "greeting", "open_narrative", 0);

  const resp: ChatResponse = {
    reply: GREETING_MESSAGE,
    state: "open_narrative",
    session_id: session.id,
    is_complete: false,
    is_escalated: false,
  };

  return NextResponse.json(resp);
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
      reply:
        s.current_state === "escalated"
          ? EMERGENCY_RESPONSE
          : COMPLETION_MESSAGE,
      state: s.current_state,
      session_id: sessionId,
      is_complete: s.current_state === "complete",
      is_escalated: s.current_state === "escalated",
    });
  }

  const newExchange = s.exchange_count + 1;

  const nextSeq = await getNextSequenceNumber(sessionId);
  await saveMessage(
    sessionId,
    "patient",
    message,
    s.current_state,
    nextSeq
  );

  await logAuditEvent(
    "intake_message_received",
    "agent_intake",
    "intake_session",
    sessionId,
    { exchange_count: newExchange, state: s.current_state }
  );

  // --- Safety pre-processor ---
  const safety = checkSafetyKeywords(message);

  if (safety.level === "emergency") {
    await transitionState(
      sessionId,
      s.current_state,
      "escalated",
      newExchange
    );
    const seq = await getNextSequenceNumber(sessionId);
    await saveMessage(
      sessionId,
      "assistant",
      EMERGENCY_RESPONSE,
      "escalated",
      seq
    );
    await logAuditEvent(
      "escalation_triggered",
      "agent_intake",
      "intake_session",
      sessionId,
      { matched_keywords: safety.matchedKeywords, level: "emergency" }
    );
    await notifyPhysician(sessionId, "EMERGENCY", safety.matchedKeywords);

    return NextResponse.json({
      reply: EMERGENCY_RESPONSE,
      state: "escalated",
      session_id: sessionId,
      is_complete: false,
      is_escalated: true,
    } as ChatResponse);
  }

  // --- State transition: open_narrative → structured_gathering ---
  let currentState = s.current_state as IntakeState;
  if (
    currentState === "open_narrative" &&
    newExchange >= OPEN_NARRATIVE_THRESHOLD
  ) {
    currentState = "structured_gathering";
    await transitionState(
      sessionId,
      "open_narrative",
      "structured_gathering",
      newExchange
    );
  }

  // --- Build system prompt ---
  let systemPrompt = buildSystemPrompt(
    currentState,
    s.fields_collected || [],
    s.fields_missing || computeMissingFields(s.fields_collected || [])
  );

  if (safety.level === "flag") {
    systemPrompt += buildFlagInjection(safety.matchedKeywords);
    await logAuditEvent(
      "safety_keyword_detected",
      "agent_intake",
      "intake_session",
      sessionId,
      { matched_keywords: safety.matchedKeywords, level: "flag" }
    );
  }

  // --- Load conversation history ---
  const history = await getConversationHistory(sessionId);

  // --- Claude API call ---
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "patient" ? ("user" as const) : ("assistant" as const),
    content: m.content_original,
  }));

  messages.push({ role: "user", content: message });

  const tools =
    currentState === "structured_gathering" || currentState === "confirmation"
      ? [COMPLETE_INTAKE_TOOL]
      : [];

  const claudeResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: tools.length > 0 ? tools : undefined,
  });

  // --- Handle tool use (complete_intake) ---
  if (claudeResponse.stop_reason === "tool_use") {
    const toolBlock = claudeResponse.content.find(
      (block) => block.type === "tool_use"
    );
    const textBlock = claudeResponse.content.find(
      (block) => block.type === "text"
    );

    if (toolBlock && toolBlock.type === "tool_use") {
      const intakeData = toolBlock.input as CompleteIntakeInput;
      const assistantReply =
        textBlock && textBlock.type === "text"
          ? textBlock.text
          : COMPLETION_MESSAGE;

      await transitionState(
        sessionId,
        currentState,
        "structuring",
        newExchange
      );

      await createCase(sessionId, s.patient_id, intakeData);

      await transitionState(
        sessionId,
        "structuring",
        "complete",
        newExchange
      );

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

      await notifyPhysician(
        sessionId,
        intakeData.urgency.toUpperCase(),
        intakeData.risk_flags
      );

      return NextResponse.json({
        reply: assistantReply,
        state: "complete",
        session_id: sessionId,
        is_complete: true,
        is_escalated: false,
      } as ChatResponse);
    }
  }

  // --- Handle normal text response ---
  const textBlock = claudeResponse.content.find(
    (block) => block.type === "text"
  );
  const assistantReply =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "죄송합니다, 응답을 생성하지 못했습니다.";

  const seq = await getNextSequenceNumber(sessionId);
  await saveMessage(
    sessionId,
    "assistant",
    assistantReply,
    currentState,
    seq
  );

  // Update session exchange count and possibly state
  let nextState = currentState;
  if (
    currentState === "structured_gathering" &&
    newExchange >= 8
  ) {
    nextState = "confirmation";
    await transitionState(
      sessionId,
      "structured_gathering",
      "confirmation",
      newExchange
    );
  }

  await supabase
    .from("intake_sessions")
    .update({
      current_state: nextState,
      exchange_count: newExchange,
    })
    .eq("id", sessionId);

  await logAuditEvent(
    "intake_message_sent",
    "agent_intake",
    "intake_session",
    sessionId,
    { exchange_count: newExchange, state: nextState }
  );

  return NextResponse.json({
    reply: assistantReply,
    state: nextState,
    session_id: sessionId,
    is_complete: false,
    is_escalated: false,
  } as ChatResponse);
}

// ---- Helper functions ----

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

async function getConversationHistory(
  sessionId: string
): Promise<IntakeMessage[]> {
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

  await logAuditEvent(
    "intake_state_transition",
    "agent_intake",
    "intake_session",
    sessionId,
    { from, to, exchange_count: exchangeCount }
  );
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
      risk_flags: data.risk_flags.map((flag) => ({
        flag,
        detail: flag,
      })),
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

  await logAuditEvent(
    "case_created",
    "agent_intake",
    "case",
    caseData.id,
    {
      session_id: sessionId,
      patient_id: patientId,
      urgency: data.urgency,
      risk_flags_count: data.risk_flags.length,
    }
  );

  await logAuditEvent(
    "intake_completed",
    "agent_intake",
    "intake_session",
    sessionId,
    { case_id: caseData.id }
  );
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
      hash: "placeholder",
    });
  } catch (err) {
    console.error("Audit log error (non-blocking):", err);
  }
}

async function notifyPhysician(
  sessionId: string,
  urgency: string,
  flags: string[]
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  const flagText =
    flags.length > 0 ? `\nFlags: ${flags.join(", ")}` : "\nFlags: 없음";

  const text = `[Tuneclinic Intake] ${urgency}\nSession: ${sessionId}${flagText}`;

  try {
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
  } catch (err) {
    console.error("Telegram notification error:", err);
  }
}
