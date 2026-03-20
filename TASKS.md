# TASKS.md — tuneclinic-intake (Agentune)
_Cursor / Claude Code / Codex용 코딩 태스크_

## 🔴 Critical

- [ ] 첫 실환자 테스트 모니터링 (2026-03-20)
- [ ] 실환자 대화 기반 시스템 프롬프트 이터레이션

## 🟡 Important

- [ ] 에러 모니터링 자동화: Supabase `/api/intake` 500 에러 스파이크 → Telegram 알림
- [ ] 모닝 스택 리포트: 매일 7AM 어젯밤 상태 요약 → Telegram

## 🟢 Backlog (Phase 2)

- [ ] Follow-Up Agent: 시술 후 Day 1/3/7/14/30/90/180/365 체크인
- [ ] 의사 리뷰 대시보드 고도화 (admin.html)
- [ ] 다국어 추가: Arabic 우선

## ✅ 완료

- [x] Agentune 라이브 (`agent.tuneclinic-global.com`)
- [x] Claude tool use (`complete_intake`) 구현
- [x] Supabase 케이스 저장 (patients, intake_sessions, cases 테이블)
- [x] Telegram 알림 (케이스 완료 시 Dr. Ju에게)
- [x] Follow-up survey (`/followup/[case_id]`)
- [x] Rate limiting
- [x] Safety system (emergency keywords, flag keywords)
- [x] 다국어: ko, en, ja, zh

## 📌 Tech Notes

- Stack: Next.js 16, Anthropic Claude (tool use), Supabase, TypeScript
- Domain: `agent.tuneclinic-global.com`
- Supabase: `jwlfffpyeczyyojcutcx` (튠의원 전용)
- Claude model: `claude-sonnet-4-20250514`
- 대화 흐름: greeting → quick_collect → deep_gather → confirmation → complete
- 긴급 에스컬레이션: 02-540-8011
