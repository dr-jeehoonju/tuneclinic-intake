type TreatmentCategory = "lifting" | "injection" | "skinbooster" | "chamakase" | "laser" | "general";

interface TreatmentGuide {
  category: TreatmentCategory;
  treatments: string[];
  additionalQuestions: string;
}

const TREATMENT_GUIDES: TreatmentGuide[] = [
  {
    category: "lifting",
    treatments: ["튠페이스", "올타이트", "울쎄라", "온다", "텐쎄라", "텐써마", "써마지"],
    additionalQuestions: `이 환자는 리프팅 계열 시술에 관심이 있습니다. 다음 정보를 자연스럽게 수집하세요:
- 이전 리프팅 시술 경험 (종류, 시기, 만족도)
- 통증에 대한 민감도 (마취 선호도)
- 허용 가능한 다운타임 기간 (예: 직장 복귀 등)`,
  },
  {
    category: "injection",
    treatments: ["보톡스", "필러"],
    additionalQuestions: `이 환자는 주사 계열 시술에 관심이 있습니다. 다음 정보를 자연스럽게 수집하세요:
- 구체적인 타겟 부위 (주름, 볼륨, 윤곽 등)
- 이전 주사 시술 이력 (종류, 시기, 부위)
- 멍이 잘 드는 체질인지 여부`,
  },
  {
    category: "skinbooster",
    treatments: ["리쥬란", "리쥬란 아이", "쥬베룩 스킨", "쥬베룩 볼륨", "스킨부스터"],
    additionalQuestions: `이 환자는 스킨부스터 계열 시술에 관심이 있습니다. 다음 정보를 자연스럽게 수집하세요:
- 현재 피부 건조도 (건성/지성/복합성)
- 이전 스킨부스터 경험 (종류, 시기, 만족도)
- 기대하는 효과 (수분감, 탄력, 잔주름 등)`,
  },
  {
    category: "chamakase",
    treatments: ["차마카세"],
    additionalQuestions: `이 환자는 차마카세(복합 맞춤 시술)에 관심이 있습니다. 다음 정보를 자연스럽게 수집하세요:
- 전체적인 피부 목표 (어떤 모습을 원하는지)
- 개선 우선순위 상위 3가지
- 과거 시술 이력 전반 (어떤 시술이 효과적이었는지)`,
  },
  {
    category: "laser",
    treatments: ["레이저"],
    additionalQuestions: `이 환자는 레이저 시술에 관심이 있습니다. 다음 정보를 자연스럽게 수집하세요:
- 구체적인 목표 (색소 개선, 모공 축소, 피부결 등)
- 이전 레이저 시술 경험 (종류, 시기, 반응)
- 현재 자외선 노출 정도 및 자외선 차단 습관`,
  },
];

export function getTreatmentGuidePrompt(selectedTreatments: string[]): string {
  if (!selectedTreatments || selectedTreatments.length === 0) return "";

  const matchedCategories = new Set<string>();
  const parts: string[] = [];

  for (const guide of TREATMENT_GUIDES) {
    const matched = selectedTreatments.some((t) => guide.treatments.includes(t));
    if (matched && !matchedCategories.has(guide.category)) {
      matchedCategories.add(guide.category);
      parts.push(guide.additionalQuestions);
    }
  }

  if (parts.length === 0) return "";

  return `\n\n## 시술별 맞춤 질문 가이드\n${parts.join("\n\n")}

위 가이드를 참고하되, 환자가 이미 답변한 정보는 다시 묻지 마세요. 모든 가이드 질문을 반드시 물어야 하는 것은 아닙니다. 자연스러운 대화 흐름 속에서 필요한 정보를 수집하세요.`;
}
