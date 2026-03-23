/**
 * Per-deployment branding (production vs demo / white-label).
 * Set in Vercel/hosting env; NEXT_PUBLIC_* is inlined at build time.
 */

function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v !== undefined && v.trim() !== "" ? v.trim() : fallback;
}

const DEFAULT_CLINIC_KO = "압구정튠의원";
const DEFAULT_ASSISTANT_KO = "에이전튠";
const DEFAULT_ASSISTANT_EN = "Agentune";

export const siteConfig = {
  clinicNameKo: env("NEXT_PUBLIC_CLINIC_NAME_KO", DEFAULT_CLINIC_KO),
  assistantNameKo: env("NEXT_PUBLIC_ASSISTANT_NAME_KO", DEFAULT_ASSISTANT_KO),
  assistantNameEn: env("NEXT_PUBLIC_ASSISTANT_NAME_EN", DEFAULT_ASSISTANT_EN),
  /** Shown next to the main title in the header (small gray text). */
  assistantBadgeEn: env("NEXT_PUBLIC_ASSISTANT_BADGE_EN", DEFAULT_ASSISTANT_EN),
  /**
   * Main header line. If unset, `${clinicNameKo} ${assistantNameKo}`.
   */
  headerTitleKo: env("NEXT_PUBLIC_HEADER_TITLE_KO", ""),
  headerTitleEn: env("NEXT_PUBLIC_HEADER_TITLE_EN", "Tune Clinic Agentune"),
  headerTitleJa: env("NEXT_PUBLIC_HEADER_TITLE_JA", "チューンクリニック エージェンチューン"),
  headerTitleZh: env("NEXT_PUBLIC_HEADER_TITLE_ZH", "狎鸥亭Tune医院 Agentune"),
  clinicPhone: env("NEXT_PUBLIC_CLINIC_PHONE", "02-540-8011"),
  pageTitle: env("NEXT_PUBLIC_PAGE_TITLE", "압구정튠의원 상담"),
  pageDescription: env(
    "NEXT_PUBLIC_PAGE_DESCRIPTION",
    "대면 상담 전 피부 고민을 미리 정리해 드립니다."
  ),
  telegramPrefix: env("NEXT_PUBLIC_TELEGRAM_PREFIX", "에이전튠"),
  followupClinicLine: env("NEXT_PUBLIC_FOLLOWUP_CLINIC_LINE", DEFAULT_CLINIC_KO),
  followupLogoLine1Ko: env("NEXT_PUBLIC_FOLLOWUP_LOGO_LINE1_KO", "에이전"),
  followupLogoLine2Ko: env("NEXT_PUBLIC_FOLLOWUP_LOGO_LINE2_KO", "튠"),
  /** Full KO greeting override; if empty, built from templates in i18n. */
  greetingKoOverride: env("NEXT_PUBLIC_GREETING_KO", ""),
  greetingEnOverride: env("NEXT_PUBLIC_GREETING_EN", ""),
  greetingJaOverride: env("NEXT_PUBLIC_GREETING_JA", ""),
  greetingZhOverride: env("NEXT_PUBLIC_GREETING_ZH", ""),
  /** English prose name for greetings (e.g. "Gangnam Demo Clinic"). */
  clinicNameEn: env("NEXT_PUBLIC_CLINIC_NAME_EN", "Apgujeong Tune Clinic"),
  clinicNameJa: env("NEXT_PUBLIC_CLINIC_NAME_JA", "狎鷗亭チューンクリニック"),
  clinicNameZh: env("NEXT_PUBLIC_CLINIC_NAME_ZH", "狎鸥亭Tune医院"),
  assistantNameJa: env("NEXT_PUBLIC_ASSISTANT_NAME_JA", "エージェンチューン"),
  assistantNameZh: env("NEXT_PUBLIC_ASSISTANT_NAME_ZH", "Agentune"),
} as const;

export function getHeaderTitleKo(): string {
  return (
    siteConfig.headerTitleKo ||
    `${siteConfig.clinicNameKo} ${siteConfig.assistantNameKo}`
  );
}

/** First sentence of the Korean greeting (brand line). */
export function getGreetingBrandLineKo(): string {
  return `${getHeaderTitleKo()}(${siteConfig.assistantNameEn})`;
}
