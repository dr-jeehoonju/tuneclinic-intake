"use client";

import { useState, useEffect, use } from "react";

const SIDE_EFFECT_OPTIONS = [
  { label: "붓기 / 부종", value: "swelling" },
  { label: "멍", value: "bruising" },
  { label: "통증 / 불편감", value: "pain" },
  { label: "발적 / 붉어짐", value: "redness" },
  { label: "감각 이상", value: "numbness" },
  { label: "기타", value: "other" },
];

type FollowupState = "loading" | "form" | "submitted" | "already_submitted" | "error";

export default function FollowupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = use(params);
  const [state, setState] = useState<FollowupState>("loading");
  const [patientName, setPatientName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sideEffects, setSideEffects] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/followup?case_id=${caseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setState("error"); return; }
        if (data.already_submitted) { setState("already_submitted"); return; }
        setPatientName(data.patient_name || "");
        setChiefComplaint(data.chief_complaint || "");
        setState("form");
      })
      .catch(() => setState("error"));
  }, [caseId]);

  function toggleSideEffect(val: string) {
    setSideEffects((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, rating, comment, side_effects: sideEffects }),
      });
      if (res.ok) setState("submitted");
      else setState("error");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (state === "already_submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">이미 제출되었습니다</h2>
          <p className="text-sm text-slate-500">이 상담에 대한 만족도 조사가 이미 완료되었습니다. 감사합니다.</p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">감사합니다!</h2>
          <p className="text-sm text-slate-500">소중한 피드백이 더 나은 진료에 큰 도움이 됩니다.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-md w-full">
          <h2 className="text-lg font-bold text-red-600 mb-2">오류가 발생했습니다</h2>
          <p className="text-sm text-slate-500">유효하지 않은 링크이거나 서버에 문제가 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <span className="text-amber-700 font-bold text-[9px] leading-tight">에이전<br />튠</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">시술 후 만족도 조사</h1>
          <p className="text-sm text-slate-500 mt-1">압구정튠의원</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          {patientName && (
            <p className="text-sm text-slate-600">
              <span className="font-bold">{patientName}</span>님, 시술 후 경과는 어떠신가요?
            </p>
          )}

          {chiefComplaint && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
              상담 내용: {chiefComplaint}
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">전반적인 만족도</label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-3xl transition-transform hover:scale-110"
                >
                  <span className={star <= (hoverRating || rating) ? "text-amber-400" : "text-slate-200"}>
                    ★
                  </span>
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-xs text-slate-400 mt-1">
                {rating <= 2 ? "아쉬우셨군요" : rating <= 3 ? "보통이셨군요" : rating <= 4 ? "만족하셨군요" : "매우 만족하셨군요"}
              </p>
            )}
          </div>

          {/* Side Effects */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">부작용이 있으셨나요?</label>
            <div className="grid grid-cols-2 gap-2">
              {SIDE_EFFECT_OPTIONS.map((opt) => {
                const selected = sideEffects.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleSideEffect(opt.value)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      selected
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">추가 의견 (선택)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="시술 후 경과나 개선 사항을 자유롭게 작성해 주세요..."
              rows={3}
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!rating || submitting}
            className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold text-sm
              hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 transition-all"
          >
            {submitting ? "제출 중..." : "제출하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
