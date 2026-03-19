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

const MAX_HISTORY = 40;
const OPEN_NARRATIVE_THRESHOLD = 3;

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
  await transitionState(session.id, "greeting", "open_narrative", 0);

  return NextResponse.json({
    reply: GREETING_MESSAGE,
    state: "open_narrative",
    session_id: session.id,
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

  // --- Safety pre-processor (runs BEFORE Claude) ---
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

  // --- State transition: open_narrative → structured_gathering ---
  let currentState = s.current_state as IntakeState;
  if (currentState === "open_narrative" && newExchange >= OPEN_NARRATIVE_THRESHOLD) {
    currentState = "structured_gathering";
    await transitionState(sessionId, "open_narrative", "structured_gathering", newExchange);
  }

  // --- Extract fields from conversation so far (for structured_gathering) ---
  let fieldsCollected = s.fields_collected || [];
  let fieldsMissing = s.fields_missing || computeMissingFields(fieldsCollected);

  if (currentState === "structured_gathering" || currentState === "confirmation") {
    const extracted = await extractFieldsFromHistory(sessionId);
    fieldsCollected = extracted;
    fieldsMissing = computeMissingFields(extracted);

    await supabase
      .from("intake_sessions")
      .update({ fields_collected: fieldsCollected, fields_missing: fieldsMissing })
      .eq("id", sessionId);
  }

  // --- Build system prompt with actual field status ---
  let systemPrompt = buildSystemPrompt(currentState, fieldsCollected, fieldsMissing);

  if (safety.level === "flag") {
    systemPrompt += buildFlagInjection(safety.matchedKeywords);
    await logAuditEvent("safety_keyword_detected", "agent_intake", "intake_session", sessionId, {
      matched_keywords: safety.matchedKeywords,
    });
  }

  // --- Load FULL conversation history ---
  const history = await getConversationHistory(sessionId);

  // Build Claude messages from stored history (already includes the patient message we just saved)
  const messages: Anthropic.MessageParam[] = [];
  for (const m of history) {
    const role = m.role === "patient" ? "user" as const : "assistant" as const;
    // Merge consecutive same-role messages (shouldn't happen, but safety net)
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      messages[messages.length - 1] = {
        role,
        content: messages[messages.length - 1].content + "\n" + m.content_original,
      };
    } else {
      messages.push({ role, content: m.content_original });
    }
  }

  // Ensure messages start with user and alternate properly
  if (messages.length > 0 && messages[0].role === "assistant") {
    messages.shift();
  }

  const shouldOfferTool =
    currentState === "structured_gathering" || currentState === "confirmation";

  // --- Auto-transition to confirmation at exchange 8+ ---
  if (currentState === "structured_gathering" && newExchange >= 8) {
    currentState = "confirmation";
    await transitionState(sessionId, "structured_gathering", "confirmation", newExchange);
    systemPrompt = buildSystemPrompt("confirmation", fieldsCollected, fieldsMissing);
  }

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

  // --- Handle normal text response ---
  const textBlock = claudeResponse.content.find((b) => b.type === "text");
  const assistantReply =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "죄송합니다, 응답을 생성하지 못했습니다.";

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

/**
 * Analyze conversation history to determine which fields have been collected.
 * Uses keyword detection on the full conversation — no LLM call needed.
 */
async function extractFieldsFromHistory(sessionId: string): Promise<string[]> {
  const history = await getConversationHistory(sessionId);
  const fullText = history.map((m) => m.content_original).join("\n");
  const lower = fullText.toLowerCase();

  const fields: string[] = [];

  // chief_complaint: always collected after first patient message
  const patientMessages = history.filter((m) => m.role === "patient");
  if (patientMessages.length > 0) fields.push("chief_complaint");

  // age
  if (/\d{2}세|\d{2}살|\d{2}대/.test(fullText)) fields.push("age_range");

  // gender
  if (/여성|남성|여자|남자/.test(fullText)) fields.push("gender");

  // skin type / sun reaction
  if (/빨갛|갈색|타|타는|햇볕|자외선|차단제|선크림/.test(lower))
    fields.push("fitzpatrick_estimate");

  // skincare
  if (/스킨케어|레티놀|비타민a|세럼|크림|화장품|쓰는.*제품|쓰시는/.test(lower))
    fields.push("current_skincare");
  if (/없어요.*제품|없어요.*그런|안 써|안써/.test(lower) && !fields.includes("current_skincare"))
    fields.push("current_skincare");

  // sun exposure
  if (/야외|자외선|선크림|차단제|해변|리조트|바다/.test(lower))
    fields.push("sun_exposure");

  // previous treatments
  if (/울쎄라|써마지|보톡스|필러|레이저|IPL|피코|리프팅|시술.*받|받아.*봤/.test(lower))
    fields.push("previous_treatments");

  // allergies
  if (/알레르기|알러지/.test(lower)) fields.push("allergies");

  // medications
  if (/로아큐탄|이소트레|약.*복용|먹는.*약|약물/.test(lower)) fields.push("medications");

  // pregnancy
  if (/임신|수유|모유/.test(lower)) fields.push("pregnancy_status");

  // budget
  if (/예산|만원|비용|가격|얼마/.test(lower)) fields.push("budget_range");

  // timeline
  if (/결혼|면접|일정|여행|행사|급하|언제까지/.test(lower)) fields.push("timeline");

  // skin concerns
  if (/기미|잡티|색소|모공|주름|처짐|탄력|여드름|흉터|볼살|리프팅|탈모/.test(lower))
    fields.push("skin_concerns");

  // treatment interests
  if (/울쎄라|써마지|보톡스|필러|레이저|피코|IPL|주사|스킨부스터|쥬벨룩|리쥬란/.test(lower))
    fields.push("treatment_interests");

  return [...new Set(fields)];
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
      hash: "placeholder",
    });
  } catch (err) {
    console.error("Audit log error (non-blocking):", err);
  }
}

async function notifyPhysician(sessionId: string, urgency: string, flags: string[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const flagText = flags.length > 0 ? `\nFlags: ${flags.join(", ")}` : "\nFlags: 없음";
  const text = `[Tuneclinic Intake] ${urgency}\nSession: ${sessionId}${flagText}`;

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
