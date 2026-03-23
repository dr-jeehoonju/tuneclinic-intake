/**
 * Per-deployment branding (production vs demo / white-label).
 *
 * IMPORTANT: Next.js only inlines NEXT_PUBLIC_* when accessed as a direct
 * property (process.env.NEXT_PUBLIC_XXX). Dynamic bracket access like
 * process.env[key] is NOT replaced in client bundles. Every variable must
 * appear as a literal property access below.
 */

function or(val: string | undefined, fallback: string): string {
  return val !== undefined && val.trim() !== "" ? val.trim() : fallback;
}

const DEFAULT_CLINIC_KO = "압구정튠의원";
const DEFAULT_ASSISTANT_KO = "에이전튠";
const DEFAULT_ASSISTANT_EN = "Agentune";

export const siteConfig = {
  clinicNameKo: or(process.env.NEXT_PUBLIC_CLINIC_NAME_KO, DEFAULT_CLINIC_KO),
  assistantNameKo: or(process.env.NEXT_PUBLIC_ASSISTANT_NAME_KO, DEFAULT_ASSISTANT_KO),
  assistantNameEn: or(process.env.NEXT_PUBLIC_ASSISTANT_NAME_EN, DEFAULT_ASSISTANT_EN),
  assistantBadgeEn: or(process.env.NEXT_PUBLIC_ASSISTANT_BADGE_EN, DEFAULT_ASSISTANT_EN),
  headerTitleKo: or(process.env.NEXT_PUBLIC_HEADER_TITLE_KO, ""),
  headerTitleEn: or(process.env.NEXT_PUBLIC_HEADER_TITLE_EN, "Tune Clinic Agentune"),
  headerTitleJa: or(process.env.NEXT_PUBLIC_HEADER_TITLE_JA, "チューンクリニック エージェンチューン"),
  headerTitleZh: or(process.env.NEXT_PUBLIC_HEADER_TITLE_ZH, "狎鸥亭Tune医院 Agentune"),
  clinicPhone: or(process.env.NEXT_PUBLIC_CLINIC_PHONE, "02-540-8011"),
  pageTitle: or(process.env.NEXT_PUBLIC_PAGE_TITLE, "압구정튠의원 상담"),
  pageDescription: or(process.env.NEXT_PUBLIC_PAGE_DESCRIPTION, "대면 상담 전 피부 고민을 미리 정리해 드립니다."),
  telegramPrefix: or(process.env.NEXT_PUBLIC_TELEGRAM_PREFIX, "에이전튠"),
  followupClinicLine: or(process.env.NEXT_PUBLIC_FOLLOWUP_CLINIC_LINE, DEFAULT_CLINIC_KO),
  followupLogoLine1Ko: or(process.env.NEXT_PUBLIC_FOLLOWUP_LOGO_LINE1_KO, "에이전"),
  followupLogoLine2Ko: or(process.env.NEXT_PUBLIC_FOLLOWUP_LOGO_LINE2_KO, "튠"),
  greetingKoOverride: or(process.env.NEXT_PUBLIC_GREETING_KO, ""),
  greetingEnOverride: or(process.env.NEXT_PUBLIC_GREETING_EN, ""),
  greetingJaOverride: or(process.env.NEXT_PUBLIC_GREETING_JA, ""),
  greetingZhOverride: or(process.env.NEXT_PUBLIC_GREETING_ZH, ""),
  clinicNameEn: or(process.env.NEXT_PUBLIC_CLINIC_NAME_EN, "Apgujeong Tune Clinic"),
  clinicNameJa: or(process.env.NEXT_PUBLIC_CLINIC_NAME_JA, "狎鷗亭チューンクリニック"),
  clinicNameZh: or(process.env.NEXT_PUBLIC_CLINIC_NAME_ZH, "狎鸥亭Tune医院"),
  assistantNameJa: or(process.env.NEXT_PUBLIC_ASSISTANT_NAME_JA, "エージェンチューン"),
  assistantNameZh: or(process.env.NEXT_PUBLIC_ASSISTANT_NAME_ZH, "Agentune"),
} as const;

export function getHeaderTitleKo(): string {
  return (
    siteConfig.headerTitleKo ||
    `${siteConfig.clinicNameKo} ${siteConfig.assistantNameKo}`
  );
}

export function getGreetingBrandLineKo(): string {
  return `${getHeaderTitleKo()}(${siteConfig.assistantNameEn})`;
}
