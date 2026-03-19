import type { SafetyLevel } from "./types";

const EMERGENCY_KEYWORDS = [
  "시력",
  "눈이 안",
  "앞이 안",
  "안 보여",
  "못 봐",
  "하얗게",
  "하얘졌",
  "창백",
  "피부색이 변",
  "괴사",
  "검게 변",
  "까맣게",
  "숨이 안",
  "호흡곤란",
  "목이 부",
  "기도",
  "아나필락시스",
  "전신 부종",
  "두드러기가 온몸",
  "고름",
  "농",
  "열이 나",
  "고열",
  "38도",
  "39도",
  "40도",
  "자해",
  "자살",
  "죽고 싶",
  "살기 싫",
];

const FLAG_KEYWORDS = [
  "부기가 안 빠",
  "부어서",
  "점점 부",
  "멍이 안 빠",
  "멍이 심",
  "빨갛게",
  "발적",
  "열감",
  "통증이 심",
  "아파서",
  "너무 아파",
  "가려움이 심",
  "따가움이 심",
  "임신",
  "임신 중",
  "수유",
  "모유",
  "수유 중",
  "로아큐탄",
  "이소트레티노인",
  "아큐탄",
  "항응고제",
  "와파린",
  "아스피린",
  "스테로이드",
  "건선",
  "루푸스",
  "백반",
  "경피증",
  "켈로이드",
  "흉터가 튀어",
  "뭉침",
  "딱딱",
  "필러가 이동",
  "울퉁불퉁",
];

export function checkSafetyKeywords(message: string): {
  level: SafetyLevel;
  matchedKeywords: string[];
} {
  const normalized = message.toLowerCase().replace(/\s+/g, " ");

  const emergencyMatches = EMERGENCY_KEYWORDS.filter((kw) =>
    normalized.includes(kw)
  );
  if (emergencyMatches.length > 0) {
    return { level: "emergency", matchedKeywords: emergencyMatches };
  }

  const flagMatches = FLAG_KEYWORDS.filter((kw) => normalized.includes(kw));
  if (flagMatches.length > 0) {
    return { level: "flag", matchedKeywords: flagMatches };
  }

  return { level: "clear", matchedKeywords: [] };
}

export const EMERGENCY_RESPONSE = `말씀하신 증상은 빠른 확인이 필요한 상황일 수 있습니다.

지금 바로 병원(02-540-8011)으로 연락해 주시거나, 증상이 심하시면 가까운 응급실을 방문해 주세요.

상담은 여기서 일시 중단하겠습니다. 안전이 가장 중요합니다.`;

export function buildFlagInjection(matchedKeywords: string[]): string {
  return `\n[SYSTEM NOTICE: 환자 메시지에서 다음 키워드가 감지되었습니다: ${matchedKeywords.join(", ")}. 
이 대화는 자동으로 '주의 필요' 플래그가 설정되었습니다. 
당신의 응답에서 이 사실을 직접 언급하지 마세요. 
평소대로 대화하되, 관련 정보를 더 자세히 수집하세요.]`;
}
