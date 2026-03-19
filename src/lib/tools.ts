export const COMPLETE_INTAKE_TOOL = {
  name: "complete_intake",
  description: `환자의 피부 미용 상담 정보가 충분히 수집되었을 때 호출합니다.
최소 요구 사항: chief_complaint(주 호소), skin_concerns(피부 고민 목록), 나이 또는 연령대.
환자가 완료를 확인한 후에만 호출하세요.`,
  input_schema: {
    type: "object" as const,
    properties: {
      chief_complaint: {
        type: "string",
        description:
          "환자가 직접 한 말 그대로. 절대 요약하거나 의학 용어로 바꾸지 않는다.",
      },
      patient_name: {
        type: "string",
        description: "환자 이름. 사전 설문에서 수집된 경우 그대로 전달.",
      },
      patient_phone: {
        type: "string",
        description: "환자 연락처. 사전 설문에서 수집된 경우 그대로 전달.",
      },
      skin_concerns: {
        type: "array",
        items: { type: "string" },
        description:
          "환자가 언급한 피부 고민 목록. 예: ['색소/기미', '모공', '주름/처짐']",
      },
      treatment_interests: {
        type: "array",
        items: { type: "string" },
        description:
          "환자가 직접 언급한 시술 관심사. 환자가 언급하지 않은 시술은 포함하지 않는다.",
      },
      age_range: {
        type: "string",
        description: "나이 또는 연령대. 예: '35세' 또는 '30대 중반'",
      },
      gender: {
        type: "string",
        enum: ["female", "male", "other", "unknown"],
        description: "성별. 대화에서 파악되지 않으면 'unknown'",
      },
      fitzpatrick_estimate: {
        type: "string",
        enum: ["I", "II", "III", "IV", "V", "VI", "uncertain"],
        description:
          "간접 질문으로 추정한 피부 타입. 확신이 없으면 'uncertain'.",
      },
      current_skincare: {
        type: "string",
        description:
          "현재 스킨케어 루틴 요약. 특히 레티놀/비타민A 사용 여부 포함.",
      },
      sun_exposure: {
        type: "string",
        description: "자외선 노출 수준.",
      },
      previous_treatments: {
        type: "string",
        description: "이전 미용 시술 이력. 시술명, 시기, 결과 포함.",
      },
      medications: {
        type: "string",
        description:
          "현재 복용 약물. 특히 이소트레티노인, 항응고제, 면역억제제.",
      },
      allergies: {
        type: "string",
        description: "알레르기 정보. 특히 마취제, 외용제.",
      },
      pregnancy_status: {
        type: "string",
        enum: ["not_pregnant", "pregnant", "breastfeeding", "unknown"],
        description: "임신/수유 상태",
      },
      budget_range: {
        type: "string",
        description: "예산 범위. 환자가 언급한 경우에만.",
      },
      timeline: {
        type: "string",
        description: "일정/이벤트.",
      },
      fields_collected: {
        type: "array",
        items: { type: "string" },
        description: "수집 완료된 필드 목록",
      },
      fields_missing: {
        type: "array",
        items: { type: "string" },
        description: "수집하지 못한 필드 목록",
      },
      risk_flags: {
        type: "array",
        items: { type: "string" },
        description: `원장님이 반드시 확인해야 할 위험 요소. 다음 항목을 체크:
- 레티노이드 사용 중 (시술 타이밍)
- 이소트레티노인 최근 복용 (6개월 이내)
- 켈로이드/비후성 반흔 경향
- 피부 타입 V-VI 추정 (PIH 위험)
- 최근 자외선 노출 (2-4주 이내)
- 임신/수유 중
- 자가면역 피부질환
- 이전 필러 합병증
- 비현실적 기대 (시술로 달성 불가능한 기대)
해당 없으면 빈 배열.`,
      },
      urgency: {
        type: "string",
        enum: ["normal", "elevated", "urgent"],
        description:
          "normal: 일반 상담. elevated: 시술 타이밍에 영향을 주는 요소 있음. urgent: 시술 자체가 제한되는 상황.",
      },
    },
    required: [
      "chief_complaint",
      "skin_concerns",
      "fields_collected",
      "risk_flags",
      "urgency",
    ],
  },
};
