import type { SafetyLevel } from "./types";

const EMERGENCY_KEYWORDS = [
  // Korean
  "시력", "눈이 안", "앞이 안", "안 보여", "못 봐",
  "하얗게", "하얘졌", "창백", "피부색이 변", "괴사", "검게 변", "까맣게",
  "숨이 안", "호흡곤란", "목이 부", "기도", "아나필락시스",
  "전신 부종", "두드러기가 온몸", "고름", "농",
  "열이 나", "고열", "38도", "39도", "40도",
  "자해", "자살", "죽고 싶", "살기 싫",
  // English
  "can't see", "cannot see", "lost vision", "vision loss", "going blind",
  "turned white", "turned black", "skin turning", "necrosis",
  "can't breathe", "cannot breathe", "difficulty breathing", "throat swelling",
  "anaphylaxis", "whole body swelling", "hives all over",
  "pus", "high fever", "fever 38", "fever 39", "fever 40",
  "self-harm", "suicide", "want to die", "kill myself",
  // Japanese
  "見えない", "視力", "白くなった", "黒くなった", "壊死",
  "息ができない", "呼吸困難", "喉が腫れ", "アナフィラキシー",
  "全身の腫れ", "蕁麻疹", "膿", "高熱",
  "自傷", "自殺", "死にたい",
  // Chinese
  "看不见", "失明", "视力", "变白", "变黑", "坏死",
  "无法呼吸", "呼吸困难", "喉咙肿", "过敏性休克",
  "全身肿", "荨麻疹", "脓", "高烧",
  "自残", "自杀", "想死",
];

const FLAG_KEYWORDS = [
  // Korean
  "부기가 안 빠", "부어서", "점점 부", "멍이 안 빠", "멍이 심",
  "빨갛게", "빨간", "빨개", "붉은", "붉어", "발적", "열감",
  "안 빠져", "안 빠지", "안빠져", "안빠지",
  "통증이 심", "아파서", "너무 아파", "가려움이 심", "따가움이 심",
  "임신", "임신 중", "수유", "모유", "수유 중",
  "로아큐탄", "이소트레티노인", "아큐탄", "항응고제", "와파린", "아스피린", "스테로이드",
  "건선", "루푸스", "백반", "경피증", "켈로이드", "흉터가 튀어",
  "뭉침", "딱딱", "필러가 이동", "울퉁불퉁", "시술 후", "시술후", "받았는데",
  // English
  "swelling won't go down", "still swollen", "bruise won't go away", "severe bruising",
  "very red", "redness", "warm to touch",
  "severe pain", "really hurts", "extreme itching",
  "pregnant", "breastfeeding", "nursing",
  "accutane", "isotretinoin", "blood thinner", "warfarin", "aspirin", "steroid",
  "psoriasis", "lupus", "vitiligo", "scleroderma", "keloid",
  "lump", "hard bump", "filler migration", "uneven",
  "after procedure", "after treatment",
  // Japanese
  "腫れが引かない", "まだ腫れて", "あざが消えない", "ひどいあざ",
  "赤い", "赤み", "熱感", "激しい痛み", "すごく痛い", "ひどいかゆみ",
  "妊娠", "授乳", "アキュテイン", "イソトレチノイン",
  "抗凝固剤", "ワルファリン", "アスピリン", "ステロイド",
  "乾癬", "ループス", "白斑", "ケロイド",
  "しこり", "硬い", "フィラー移動", "凸凹",
  "施術後", "治療後",
  // Chinese
  "消不下去", "还肿着", "淤青不消", "严重淤青",
  "发红", "红肿", "发热", "剧烈疼痛", "非常痛", "严重瘙痒",
  "怀孕", "哺乳", "异维A酸", "抗凝血", "华法林", "阿司匹林", "类固醇",
  "银屑病", "红斑狼疮", "白癜风", "瘢痕疙瘩",
  "硬块", "填充剂移位", "凹凸不平",
  "术后", "治疗后",
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
