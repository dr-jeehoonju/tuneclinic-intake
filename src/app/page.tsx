"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { QuickStep, QuickCollectData } from "@/lib/types";
import { UI_STRINGS, detectLang, type Lang } from "@/lib/i18n";

// ---- Quick Collect Step Definitions ----

function getQuickSteps(lang: Lang): QuickStep[] {
  const t = UI_STRINGS[lang].steps;
  return [
    { id: "patient_name", question: t.patient_name.question, type: "text", options: [], placeholder: t.patient_name.placeholder },
    { id: "patient_phone", question: t.patient_phone.question, type: "text", options: [], placeholder: t.patient_phone.placeholder },
    { id: "skin_concerns", question: t.skin_concerns.question, type: "multi",
      options: Object.entries(t.skin_concerns.options).map(([value, label]) => ({ label, value })) },
    { id: "treatment_interests", question: t.treatment_interests.question, type: "multi", allowSkip: true, skipLabel: t.treatment_interests.skipLabel,
      options: [
        { label: "튠페이스", value: "튠페이스" }, { label: "올타이트", value: "올타이트" },
        { label: "울쎄라", value: "울쎄라" }, { label: "써마지", value: "써마지" },
        { label: "온다", value: "온다" }, { label: "텐쎄라", value: "텐쎄라" },
        { label: "텐써마", value: "텐써마" }, { label: "보톡스", value: "보톡스" },
        { label: "필러", value: "필러" }, { label: "리쥬란", value: "리쥬란" },
        { label: "리쥬란 아이", value: "리쥬란 아이" }, { label: "쥬베룩 스킨", value: "쥬베룩 스킨" },
        { label: "쥬베룩 볼륨", value: "쥬베룩 볼륨" }, { label: "스킨부스터", value: "스킨부스터" },
        { label: "레이저", value: "레이저" }, { label: "차마카세", value: "차마카세" },
      ] },
    { id: "age_range", question: t.age_range.question, type: "single",
      options: Object.entries(t.age_range.options).map(([value, label]) => ({ label, value })) },
    { id: "gender", question: t.gender.question, type: "single",
      options: Object.entries(t.gender.options).map(([value, label]) => ({ label, value })) },
    { id: "previous_treatments", question: t.previous_treatments.question, type: "single",
      options: Object.entries(t.previous_treatments.options).map(([value, label]) => ({ label, value })) },
    { id: "retinoid_use", question: t.retinoid_use.question, type: "single",
      options: Object.entries(t.retinoid_use.options).map(([value, label]) => ({ label, value })) },
    { id: "pregnancy_status", question: t.pregnancy_status.question, type: "single",
      options: Object.entries(t.pregnancy_status.options).map(([value, label]) => ({ label, value })) },
    { id: "upcoming_event", question: t.upcoming_event.question, type: "single",
      options: Object.entries(t.upcoming_event.options).map(([value, label]) => ({ label, value })) },
    { id: "pain_sensitivity", question: t.pain_sensitivity.question, type: "single",
      options: Object.entries(t.pain_sensitivity.options).map(([value, label]) => ({ label, value })) },
    { id: "downtime_preference", question: t.downtime_preference.question, type: "single",
      options: Object.entries(t.downtime_preference.options).map(([value, label]) => ({ label, value })) },
  ];
}

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
  const [lang, setLang] = useState<Lang>("ko");
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
    const params = new URLSearchParams(window.location.search);
    const detected = detectLang(params.get("lang"));
    setLang(detected);
    startSession(detected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startSession(l: Lang = lang) {
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: l }),
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
    if (nextStep >= quickSteps.length) {
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
      upcoming_event: allData.upcoming_event?.[0] || "",
      pain_sensitivity: allData.pain_sensitivity?.[0] || "",
      downtime_preference: allData.downtime_preference?.[0] || "",
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
          lang,
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
        body: JSON.stringify({ session_id: sessionId, message: trimmed, lang }),
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

  function switchLang(newLang: Lang) {
    if (newLang === lang) return;
    setLang(newLang);
    setMessages([]);
    setSessionId(null);
    setQuickStep(0);
    setQuickData({});
    setMultiSelected([]);
    setTextInput("");
    setInput("");
    setPageState("loading");
    startSession(newLang);
  }

  const LANG_OPTIONS: { value: Lang; label: string }[] = [
    { value: "ko", label: "KOR" },
    { value: "en", label: "ENG" },
    { value: "ja", label: "JPN" },
    { value: "zh", label: "CHN" },
  ];

  const isTerminal = pageState === "complete" || pageState === "escalated";
  const isChatMode = pageState === "deep_gather" || pageState === "confirmation";
  const isGreeting = pageState === "chief_complaint" && messages.length === 1;
  const quickSteps = getQuickSteps(lang);
  const currentStep = quickSteps[quickStep];
  const t = UI_STRINGS[lang];

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="8.5" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="15.5" cy="16" r="1.5" fill="currentColor" stroke="none" /><path d="M8 11V9a4 4 0 0 1 8 0v2" /><line x1="12" y1="2" x2="12" y2="5" /><circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">{t.headerTitle} <span className="text-[11px] sm:text-xs font-normal text-slate-400">Agentune</span></h1>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate">
            {isTerminal
              ? pageState === "complete" ? t.headerSubtitleComplete : t.headerSubtitleEscalated
              : pageState === "quick_collect"
                ? t.headerSubtitleQuickCollect
                : t.headerSubtitle}
          </p>
        </div>
        <select
          value={lang}
          onChange={(e) => switchLang(e.target.value as Lang)}
          className="shrink-0 text-xs sm:text-sm text-slate-600 bg-slate-50 border border-slate-200
            rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400
            cursor-pointer appearance-none text-center"
          style={{ fontSize: "16px", minWidth: "4.5rem" }}
        >
          {LANG_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </header>

      {/* Progress bar for quick_collect */}
      {pageState === "quick_collect" && (
        <div className="bg-white border-b border-slate-100 px-4 sm:px-6 py-1.5 sm:py-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 shrink-0">
              {quickStep + 1} / {quickSteps.length}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${((quickStep + 1) / quickSteps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Greeting — Claude-style centered splash */}
      {isGreeting && messages[0] && (() => {
        const paragraphs = messages[0].content.split("\n\n").filter(Boolean);
        return (
          <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 overflow-y-auto overscroll-contain">
            <div className="max-w-md w-full text-center space-y-5 sm:space-y-6">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 sm:w-9 sm:h-9 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="8.5" cy="16" r="1.5" fill="currentColor" stroke="none" /><circle cx="15.5" cy="16" r="1.5" fill="currentColor" stroke="none" /><path d="M8 11V9a4 4 0 0 1 8 0v2" /><line x1="12" y1="2" x2="12" y2="5" /><circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
                </svg>
              </div>

              {/* Title paragraph */}
              {paragraphs[0] && (
                <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
                  {paragraphs[0]}
                </p>
              )}

              {/* Body paragraphs */}
              {paragraphs.slice(1, -1).map((p, i) => (
                <p key={i} className="text-[13px] sm:text-sm text-slate-500 leading-relaxed whitespace-pre-line">
                  {p}
                </p>
              ))}

              {/* CTA (last paragraph) */}
              {paragraphs.length > 1 && (
                <p className="text-[15px] sm:text-base font-medium text-amber-700 leading-relaxed pt-1">
                  {paragraphs[paragraphs.length - 1]}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Chat area (visible in deep_gather, confirmation, terminal, or chief_complaint after user typed) */}
      {pageState !== "quick_collect" && !isGreeting && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 overscroll-contain">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "patient" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap ${
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
        <div className="flex-1 flex flex-col px-4 sm:px-6 py-4 sm:py-6 overflow-hidden">
          <div className="w-full max-w-md mx-auto flex flex-col flex-1 min-h-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 sm:mb-6 text-center shrink-0">
              {currentStep.question}
            </h2>

            {currentStep.type === "single" && (
              <div className="space-y-2 sm:space-y-3 overflow-y-auto flex-1 overscroll-contain">
                {currentStep.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSingleSelect(currentStep.id, opt.value)}
                    className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl border-2 border-slate-200 bg-white
                      text-[13px] sm:text-sm font-medium text-slate-700
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
                className="space-y-3 sm:space-y-4"
              >
                <input
                  type={currentStep.id === "patient_phone" ? "tel" : "text"}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={currentStep.placeholder || ""}
                  autoFocus
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl border-2 border-slate-200 bg-white
                    text-base sm:text-sm text-slate-700 placeholder:text-slate-400
                    focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400
                    transition-all"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim()}
                  className="w-full px-4 py-3 rounded-xl bg-amber-600 text-white text-[13px] sm:text-sm font-bold
                    hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-all"
                >
                  {t.nextButton}
                </button>
              </form>
            )}

            {currentStep.type === "multi" && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="space-y-1.5 sm:space-y-2 overflow-y-auto flex-1 pb-2 overscroll-contain">
                {currentStep.options.map((opt) => {
                  const selected = multiSelected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMultiSelect(opt.value)}
                      className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 text-[13px] sm:text-sm font-medium
                        active:scale-[0.98] transition-all ${
                          selected
                            ? "border-amber-500 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50"
                        }`}
                    >
                      <span className="flex items-center gap-2.5 sm:gap-3">
                        <span
                          className={`w-4.5 h-4.5 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected ? "border-amber-500 bg-amber-500" : "border-slate-300"
                          }`}
                        >
                          {selected && (
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
                </div>

                <div className="flex gap-2 sm:gap-3 pt-2 sm:pt-3 shrink-0"
                  style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}>
                  {currentStep.allowSkip && (
                    <button
                      onClick={() => skipMultiSelect(currentStep.id)}
                      className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl border-2 border-slate-200
                        text-[13px] sm:text-sm text-slate-500 hover:border-slate-300 transition-all"
                    >
                      {currentStep.skipLabel || t.skipLabel}
                    </button>
                  )}
                  <button
                    onClick={() => confirmMultiSelect(currentStep.id)}
                    disabled={multiSelected.length === 0}
                    className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl bg-amber-600 text-white text-[13px] sm:text-sm font-bold
                      hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-all"
                  >
                    {t.nextButton}
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
          className="border-t border-slate-200 bg-white px-3 sm:px-4 py-2 sm:py-3 shrink-0"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pageState === "chief_complaint"
                  ? t.chiefComplaintPlaceholder
                  : t.replyPlaceholder
              }
              disabled={sending}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-sm
                focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent
                disabled:opacity-50 disabled:bg-slate-50"
              style={{ maxHeight: "100px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 100) + "px";
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-600 text-white
                flex items-center justify-center hover:bg-amber-700
                disabled:opacity-40 disabled:hover:bg-amber-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {isTerminal && (
        <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 sm:py-4 text-center shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <p className="text-[13px] sm:text-sm text-slate-500">
            {pageState === "complete" ? t.completionMessage : t.escalationMessage}
          </p>
        </div>
      )}

      {pageState === "error" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-red-600 mb-2">{t.errorMessage}</p>
            <button
              onClick={() => { setPageState("loading"); startSession(lang); }}
              className="text-sm text-amber-700 underline hover:text-amber-900"
            >
              {t.retryButton}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
