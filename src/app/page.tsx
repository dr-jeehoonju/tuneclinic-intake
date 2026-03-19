"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { QuickStep, QuickCollectData } from "@/lib/types";

// ---- Quick Collect Step Definitions ----

const QUICK_STEPS: QuickStep[] = [
  {
    id: "patient_name",
    question: "성함을 알려주세요.",
    type: "text",
    options: [],
    placeholder: "홍길동",
  },
  {
    id: "patient_phone",
    question: "연락 가능한 전화번호를 알려주세요.",
    type: "text",
    options: [],
    placeholder: "010-0000-0000",
  },
  {
    id: "skin_concerns",
    question: "어떤 피부 고민이 있으신가요?",
    type: "multi",
    options: [
      { label: "처짐 / 주름", value: "처짐/주름" },
      { label: "기미 / 색소", value: "기미/색소" },
      { label: "모공", value: "모공" },
      { label: "여드름 / 흉터", value: "여드름/흉터" },
      { label: "탄력 저하", value: "탄력" },
      { label: "피부 톤 / 결", value: "피부톤/결" },
    ],
  },
  {
    id: "treatment_interests",
    question: "관심 있는 시술이 있으신가요?",
    type: "multi",
    allowSkip: true,
    skipLabel: "잘 모르겠어요",
    options: [
      { label: "울쎄라", value: "울쎄라" },
      { label: "써마지", value: "써마지" },
      { label: "보톡스", value: "보톡스" },
      { label: "필러", value: "필러" },
      { label: "레이저", value: "레이저" },
      { label: "스킨부스터", value: "스킨부스터" },
    ],
  },
  {
    id: "age_range",
    question: "연령대를 알려주세요.",
    type: "single",
    options: [
      { label: "20대", value: "20대" },
      { label: "30대", value: "30대" },
      { label: "40대", value: "40대" },
      { label: "50대", value: "50대" },
      { label: "60대 이상", value: "60대 이상" },
    ],
  },
  {
    id: "gender",
    question: "성별을 알려주세요.",
    type: "single",
    options: [
      { label: "여성", value: "여성" },
      { label: "남성", value: "남성" },
    ],
  },
  {
    id: "previous_treatments",
    question: "이전에 피부 미용 시술을 받으신 적이 있으신가요?",
    type: "single",
    options: [
      { label: "있음", value: "있음" },
      { label: "없음", value: "없음" },
    ],
  },
  {
    id: "retinoid_use",
    question: "레티놀(비타민A) 제품을 사용하고 계신가요?",
    type: "single",
    options: [
      { label: "사용 중", value: "사용 중" },
      { label: "사용 안 함", value: "사용 안 함" },
      { label: "잘 모르겠어요", value: "모름" },
    ],
  },
  {
    id: "pregnancy_status",
    question: "임신 또는 수유 중이신가요?",
    type: "single",
    options: [
      { label: "해당 없음", value: "해당 없음" },
      { label: "임신 중", value: "임신 중" },
      { label: "수유 중", value: "수유 중" },
    ],
  },
];

// ---- Types ----

interface Message {
  role: "assistant" | "patient";
  content: string;
}

type PageState =
  | "loading"
  | "chief_complaint"
  | "quick_collect"
  | "deep_gather"
  | "confirmation"
  | "complete"
  | "escalated"
  | "error";

// ---- Main Component ----

export default function IntakePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [sending, setSending] = useState(false);

  // Quick collect state
  const [quickStep, setQuickStep] = useState(0);
  const [quickData, setQuickData] = useState<Record<string, string[]>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [textInput, setTextInput] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, quickStep, scrollToBottom]);

  useEffect(() => {
    startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startSession() {
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.session_id) {
        setSessionId(data.session_id);
        setPageState("chief_complaint");
        setMessages([{ role: "assistant", content: data.reply }]);
      } else {
        setPageState("error");
      }
    } catch {
      setPageState("error");
    }
  }

  // Submit chief complaint (free text), then move to quick collect
  async function submitChiefComplaint(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { role: "patient", content: trimmed }]);
    setQuickData((prev) => ({ ...prev, chief_complaint: [trimmed] }));
    setInput("");
    setPageState("quick_collect");
    setQuickStep(0);
  }

  // Handle single-select click
  function handleSingleSelect(stepId: string, value: string) {
    const newData = { ...quickData, [stepId]: [value] };
    setQuickData(newData);
    advanceStep(newData);
  }

  // Handle multi-select toggle
  function toggleMultiSelect(value: string) {
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  // Confirm multi-select
  function confirmMultiSelect(stepId: string) {
    if (multiSelected.length === 0) return;
    const newData = { ...quickData, [stepId]: multiSelected };
    setQuickData(newData);
    setMultiSelected([]);
    advanceStep(newData);
  }

  // Skip multi-select
  function skipMultiSelect(stepId: string) {
    const newData = { ...quickData, [stepId]: [] };
    setQuickData(newData);
    setMultiSelected([]);
    advanceStep(newData);
  }

  // Submit text input
  function submitTextInput(stepId: string) {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    const newData = { ...quickData, [stepId]: [trimmed] };
    setQuickData(newData);
    setTextInput("");
    advanceStep(newData);
  }

  function advanceStep(currentData: Record<string, string[]>) {
    const nextStep = quickStep + 1;
    if (nextStep >= QUICK_STEPS.length) {
      submitQuickCollect(currentData);
    } else {
      setQuickStep(nextStep);
    }
  }

  async function submitQuickCollect(allData: Record<string, string[]>) {
    if (!sessionId) return;
    setSending(true);
    setPageState("deep_gather");

    const payload: QuickCollectData = {
      chief_complaint: allData.chief_complaint?.[0] || "",
      patient_name: allData.patient_name?.[0] || "",
      patient_phone: allData.patient_phone?.[0] || "",
      skin_concerns: allData.skin_concerns || [],
      treatment_interests: allData.treatment_interests || [],
      age_range: allData.age_range?.[0] || "",
      gender: allData.gender?.[0] || "",
      previous_treatments: allData.previous_treatments?.[0] || "",
      retinoid_use: allData.retinoid_use?.[0] || "",
      pregnancy_status: allData.pregnancy_status?.[0] || "",
    };

    // Add a summary message to chat
    const summaryParts: string[] = [];
    if (payload.skin_concerns.length > 0) summaryParts.push(payload.skin_concerns.join(", "));
    if (payload.treatment_interests.length > 0)
      summaryParts.push(`관심 시술: ${payload.treatment_interests.join(", ")}`);
    summaryParts.push(`${payload.age_range} / ${payload.gender}`);

    setMessages((prev) => [
      ...prev,
      { role: "patient", content: summaryParts.join("\n") },
    ]);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          action: "quick_collect",
          data: payload,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setPageState(data.state === "complete" ? "complete" : "deep_gather");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 일시적인 오류가 발생했습니다." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !sessionId || sending) return;

    setMessages((prev) => [...prev, { role: "patient", content: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (data.state === "complete") setPageState("complete");
        else if (data.state === "escalated") setPageState("escalated");
        else if (data.state === "confirmation") setPageState("confirmation");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 일시적인 오류가 발생했습니다." },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (pageState === "chief_complaint") {
        submitChiefComplaint(e);
      } else {
        sendMessage(e);
      }
    }
  }

  const isTerminal = pageState === "complete" || pageState === "escalated";
  const isChatMode = pageState === "deep_gather" || pageState === "confirmation";
  const currentStep = QUICK_STEPS[quickStep];

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-amber-700 font-bold text-[11px] leading-tight">에이전<br/>튠</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">압구정튠의원 에이전튠 <span className="text-xs font-normal text-slate-400">Agentune</span></h1>
          <p className="text-xs text-slate-500">
            {isTerminal
              ? pageState === "complete" ? "상담 완료" : "에스컬레이션"
              : pageState === "quick_collect"
                ? "기본 정보 입력"
                : "상담 진행 중"}
          </p>
        </div>
      </header>

      {/* Progress bar for quick_collect */}
      {pageState === "quick_collect" && (
        <div className="bg-white border-b border-slate-100 px-6 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 shrink-0">
              {quickStep + 1} / {QUICK_STEPS.length}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${((quickStep + 1) / QUICK_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Chat area (visible in chief_complaint, deep_gather, confirmation, terminal) */}
      {pageState !== "quick_collect" && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "patient" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "patient"
                    ? "bg-amber-600 text-white rounded-br-md"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick collect steps (Typeform style) */}
      {pageState === "quick_collect" && currentStep && (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-900 mb-6 text-center">
              {currentStep.question}
            </h2>

            {currentStep.type === "single" && (
              <div className="space-y-3">
                {currentStep.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSingleSelect(currentStep.id, opt.value)}
                    className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 bg-white
                      text-sm font-medium text-slate-700
                      hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800
                      active:scale-[0.98] transition-all"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {currentStep.type === "text" && (
              <form
                onSubmit={(e) => { e.preventDefault(); submitTextInput(currentStep.id); }}
                className="space-y-4"
              >
                <input
                  type={currentStep.id === "patient_phone" ? "tel" : "text"}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={currentStep.placeholder || ""}
                  autoFocus
                  className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 bg-white
                    text-sm text-slate-700 placeholder:text-slate-400
                    focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                    transition-all"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="w-full px-5 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold
                    hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-all"
                >
                  다음
                </button>
              </form>
            )}

            {currentStep.type === "multi" && (
              <div className="space-y-3">
                {currentStep.options.map((opt) => {
                  const selected = multiSelected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMultiSelect(opt.value)}
                      className={`w-full px-5 py-4 rounded-xl border-2 text-sm font-medium
                        active:scale-[0.98] transition-all ${
                          selected
                            ? "border-amber-500 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                        }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected ? "border-amber-500 bg-amber-500" : "border-slate-300"
                          }`}
                        >
                          {selected && (
                            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}

                <div className="flex gap-3 pt-3">
                  {currentStep.allowSkip && (
                    <button
                      onClick={() => skipMultiSelect(currentStep.id)}
                      className="flex-1 px-5 py-3 rounded-xl border-2 border-slate-200
                        text-sm text-slate-500 hover:border-slate-300 transition-all"
                    >
                      {currentStep.skipLabel || "건너뛰기"}
                    </button>
                  )}
                  <button
                    onClick={() => confirmMultiSelect(currentStep.id)}
                    disabled={multiSelected.length === 0}
                    className="flex-1 px-5 py-3 rounded-xl bg-amber-600 text-white text-sm font-bold
                      hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-all"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text input for chief_complaint and chat modes */}
      {(pageState === "chief_complaint" || isChatMode) && !isTerminal && (
        <form
          onSubmit={pageState === "chief_complaint" ? submitChiefComplaint : sendMessage}
          className="border-t border-slate-200 bg-white px-4 py-3 shrink-0"
        >
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pageState === "chief_complaint"
                  ? "편하게 피부 고민을 말씀해 주세요..."
                  : "답변을 입력해 주세요..."
              }
              disabled={sending}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-slate-50"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 w-10 h-10 rounded-full bg-amber-600 text-white
                flex items-center justify-center hover:bg-amber-700
                disabled:opacity-40 disabled:hover:bg-amber-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {isTerminal && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 text-center shrink-0">
          <p className="text-sm text-slate-500">
            {pageState === "complete"
              ? "상담이 완료되었습니다. 원장님이 확인 후 연락드리겠습니다."
              : "긴급 상황으로 안내가 중단되었습니다. 병원(02-540-8011)으로 연락해 주세요."}
          </p>
        </div>
      )}

      {pageState === "error" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">연결에 실패했습니다.</p>
            <button
              onClick={() => { setPageState("loading"); startSession(); }}
              className="text-sm text-amber-700 underline hover:text-amber-900"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
