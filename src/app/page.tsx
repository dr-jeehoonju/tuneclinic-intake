"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "assistant" | "patient";
  content: string;
}

type SessionState =
  | "loading"
  | "open_narrative"
  | "structured_gathering"
  | "confirmation"
  | "complete"
  | "escalated"
  | "error";

export default function IntakePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SessionState>("loading");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    startSession();
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
        setState(data.state);
        setMessages([{ role: "assistant", content: data.reply }]);
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !sessionId || sending) return;

    const userMsg: Message = { role: "patient", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
        setState(data.state);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  }

  const isTerminal = state === "complete" || state === "escalated";

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-amber-700 font-bold text-sm">TC</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">
            압구정튠의원 상담
          </h1>
          <p className="text-xs text-slate-500">
            {isTerminal
              ? state === "complete"
                ? "상담 완료"
                : "에스컬레이션"
              : "상담 진행 중"}
          </p>
        </div>
        <div className="ml-auto">
          <StateIndicator state={state} />
        </div>
      </header>

      {/* Chat area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "patient" ? "justify-end" : "justify-start"
            }`}
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
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      {!isTerminal && state !== "loading" && state !== "error" && (
        <form
          onSubmit={sendMessage}
          className="border-t border-slate-200 bg-white px-4 py-3 shrink-0"
        >
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="편하게 피부 고민을 말씀해 주세요..."
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
                disabled:opacity-40 disabled:hover:bg-amber-600
                transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </button>
          </div>
        </form>
      )}

      {isTerminal && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 text-center shrink-0">
          <p className="text-sm text-slate-500">
            {state === "complete"
              ? "상담이 완료되었습니다. 원장님이 확인 후 연락드리겠습니다."
              : "긴급 상황으로 상담이 중단되었습니다."}
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 text-center shrink-0">
          <p className="text-sm text-red-600 mb-2">
            연결에 실패했습니다.
          </p>
          <button
            onClick={() => {
              setState("loading");
              startSession();
            }}
            className="text-sm text-amber-700 underline hover:text-amber-900"
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}

function StateIndicator({ state }: { state: SessionState }) {
  const labels: Record<SessionState, { text: string; color: string }> = {
    loading: { text: "연결 중", color: "bg-slate-400" },
    open_narrative: { text: "자유 대화", color: "bg-green-500" },
    structured_gathering: { text: "정보 수집", color: "bg-blue-500" },
    confirmation: { text: "확인", color: "bg-purple-500" },
    complete: { text: "완료", color: "bg-slate-600" },
    escalated: { text: "긴급", color: "bg-red-600" },
    error: { text: "오류", color: "bg-red-500" },
  };

  const label = labels[state] || labels.loading;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${label.color}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-white ${
          state === "loading" ? "animate-pulse" : "opacity-80"
        }`}
      />
      {label.text}
    </span>
  );
}
