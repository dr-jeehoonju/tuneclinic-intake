export type Lang = "ko" | "en" | "ja" | "zh";

export const UI_STRINGS: Record<Lang, {
  greeting: string;
  chiefComplaintPlaceholder: string;
  replyPlaceholder: string;
  nextButton: string;
  skipLabel: string;
  headerTitle: string;
  headerSubtitle: string;
  headerSubtitleQuickCollect: string;
  headerSubtitleComplete: string;
  headerSubtitleEscalated: string;
  completionMessage: string;
  escalationMessage: string;
  errorMessage: string;
  retryButton: string;
  loadingText: string;
  steps: {
    patient_name: { question: string; placeholder: string };
    patient_phone: { question: string; placeholder: string };
    skin_concerns: { question: string; options: Record<string, string> };
    treatment_interests: { question: string; skipLabel: string };
    age_range: { question: string; options: Record<string, string> };
    gender: { question: string; options: Record<string, string> };
    previous_treatments: { question: string; options: Record<string, string> };
    retinoid_use: { question: string; options: Record<string, string> };
    pregnancy_status: { question: string; options: Record<string, string> };
  };
}> = {
  ko: {
    greeting: "안녕하세요, 여러분의 자연스러운 아름다움을 함께하는 압구정튠의원 에이전튠(Agentune)입니다.\n\n맛집에 가기 전에 메뉴를 미리 보는 것처럼, 상담 전에 고민을 미리 정리해 주시면 원장님이 처음부터 핵심에 집중할 수 있습니다.\n\n간단한 선택형 질문 9개와 짧은 대화로 약 2분이면 완료됩니다.\n\n편하게 어떤 피부 고민이 있으신지 말씀해 주세요.",
    chiefComplaintPlaceholder: "편하게 피부 고민을 말씀해 주세요...",
    replyPlaceholder: "답변을 입력해 주세요...",
    nextButton: "다음",
    skipLabel: "잘 모르겠어요",
    headerTitle: "압구정튠의원 에이전튠",
    headerSubtitle: "상담 진행 중",
    headerSubtitleQuickCollect: "기본 정보 입력",
    headerSubtitleComplete: "상담 완료",
    headerSubtitleEscalated: "에스컬레이션",
    completionMessage: "상담이 완료되었습니다. 원장님이 확인 후 연락드리겠습니다.",
    escalationMessage: "긴급 상황으로 안내가 중단되었습니다. 병원(02-540-8011)으로 연락해 주세요.",
    errorMessage: "연결에 실패했습니다.",
    retryButton: "다시 시도",
    loadingText: "로딩 중...",
    steps: {
      patient_name: { question: "성함을 알려주세요.", placeholder: "홍길동" },
      patient_phone: { question: "연락 가능한 전화번호를 알려주세요.", placeholder: "010-0000-0000" },
      skin_concerns: {
        question: "어떤 피부 고민이 있으신가요?",
        options: { "처짐/주름": "처짐 / 주름", "기미/색소": "기미 / 색소", "모공": "모공", "여드름/흉터": "여드름 / 흉터", "탄력": "탄력 저하", "피부톤/결": "피부 톤 / 결" },
      },
      treatment_interests: { question: "관심 있는 시술이 있으신가요?", skipLabel: "잘 모르겠어요" },
      age_range: {
        question: "연령대를 알려주세요.",
        options: { "20대": "20대", "30대": "30대", "40대": "40대", "50대": "50대", "60대 이상": "60대 이상" },
      },
      gender: { question: "성별을 알려주세요.", options: { "여성": "여성", "남성": "남성" } },
      previous_treatments: { question: "이전에 피부 미용 시술을 받으신 적이 있으신가요?", options: { "있음": "있음", "없음": "없음" } },
      retinoid_use: { question: "레티놀(비타민A) 제품을 사용하고 계신가요?", options: { "사용 중": "사용 중", "사용 안 함": "사용 안 함", "모름": "잘 모르겠어요" } },
      pregnancy_status: { question: "임신 또는 수유 중이신가요?", options: { "해당 없음": "해당 없음", "임신 중": "임신 중", "수유 중": "수유 중" } },
    },
  },

  en: {
    greeting: "Hello, I'm Agentune from Apgujeong Tune Clinic — your partner in natural beauty.\n\nJust like checking the menu before visiting a great restaurant, sharing your concerns beforehand helps the doctor focus on what matters most from the start.\n\n9 quick-select questions and a short chat — about 2 minutes total.\n\nPlease tell me about your skin concerns.",
    chiefComplaintPlaceholder: "Tell me about your skin concerns...",
    replyPlaceholder: "Type your answer...",
    nextButton: "Next",
    skipLabel: "I'm not sure",
    headerTitle: "Tune Clinic Agentune",
    headerSubtitle: "Consultation in progress",
    headerSubtitleQuickCollect: "Basic information",
    headerSubtitleComplete: "Completed",
    headerSubtitleEscalated: "Escalation",
    completionMessage: "Your consultation is complete. The doctor will review your case and contact you.",
    escalationMessage: "This requires urgent attention. Please call the clinic at 02-540-8011 or visit the nearest ER.",
    errorMessage: "Connection failed.",
    retryButton: "Retry",
    loadingText: "Loading...",
    steps: {
      patient_name: { question: "What is your name?", placeholder: "John Doe" },
      patient_phone: { question: "What is your phone number?", placeholder: "+82-10-0000-0000" },
      skin_concerns: {
        question: "What skin concerns do you have?",
        options: { "처짐/주름": "Sagging / Wrinkles", "기미/색소": "Melasma / Pigmentation", "모공": "Pores", "여드름/흉터": "Acne / Scars", "탄력": "Loss of elasticity", "피부톤/결": "Skin tone / Texture" },
      },
      treatment_interests: { question: "Any treatments you're interested in?", skipLabel: "I'm not sure" },
      age_range: {
        question: "What is your age range?",
        options: { "20대": "20s", "30대": "30s", "40대": "40s", "50대": "50s", "60대 이상": "60+" },
      },
      gender: { question: "What is your gender?", options: { "여성": "Female", "남성": "Male" } },
      previous_treatments: { question: "Have you had cosmetic procedures before?", options: { "있음": "Yes", "없음": "No" } },
      retinoid_use: { question: "Are you using retinol (Vitamin A) products?", options: { "사용 중": "Yes", "사용 안 함": "No", "모름": "Not sure" } },
      pregnancy_status: { question: "Are you pregnant or breastfeeding?", options: { "해당 없음": "N/A", "임신 중": "Pregnant", "수유 중": "Breastfeeding" } },
    },
  },

  ja: {
    greeting: "こんにちは、自然な美しさを一緒に追求する狎鷗亭チューンクリニックのエージェンチューン（Agentune）です。\n\n人気レストランに行く前にメニューを確認するように、カウンセリング前にお悩みを整理していただくと、院長が最初から要点に集中できます。\n\n簡単な選択式質問9個と短い会話で約2分で完了します。\n\nお肌のお悩みをお聞かせください。",
    chiefComplaintPlaceholder: "お肌のお悩みをお聞かせください...",
    replyPlaceholder: "回答を入力してください...",
    nextButton: "次へ",
    skipLabel: "わかりません",
    headerTitle: "チューンクリニック エージェンチューン",
    headerSubtitle: "カウンセリング中",
    headerSubtitleQuickCollect: "基本情報入力",
    headerSubtitleComplete: "完了",
    headerSubtitleEscalated: "エスカレーション",
    completionMessage: "カウンセリングが完了しました。院長が確認後、ご連絡いたします。",
    escalationMessage: "緊急の状況です。クリニック(02-540-8011)にお電話いただくか、最寄りの救急病院を受診してください。",
    errorMessage: "接続に失敗しました。",
    retryButton: "再試行",
    loadingText: "読み込み中...",
    steps: {
      patient_name: { question: "お名前を教えてください。", placeholder: "山田太郎" },
      patient_phone: { question: "連絡可能な電話番号を教えてください。", placeholder: "+82-10-0000-0000" },
      skin_concerns: {
        question: "どのようなお肌のお悩みがありますか？",
        options: { "처짐/주름": "たるみ / しわ", "기미/색소": "シミ / 色素", "모공": "毛穴", "여드름/흉터": "ニキビ / 傷跡", "탄력": "弾力低下", "피부톤/결": "肌色 / きめ" },
      },
      treatment_interests: { question: "ご興味のある施術はありますか？", skipLabel: "わかりません" },
      age_range: {
        question: "年齢層を教えてください。",
        options: { "20대": "20代", "30대": "30代", "40대": "40代", "50대": "50代", "60대 이상": "60代以上" },
      },
      gender: { question: "性別を教えてください。", options: { "여성": "女性", "남성": "男性" } },
      previous_treatments: { question: "以前に美容施術を受けたことはありますか？", options: { "있음": "あり", "없음": "なし" } },
      retinoid_use: { question: "レチノール（ビタミンA）製品を使用していますか？", options: { "사용 중": "使用中", "사용 안 함": "使用していない", "모름": "わかりません" } },
      pregnancy_status: { question: "妊娠中または授乳中ですか？", options: { "해당 없음": "該当なし", "임신 중": "妊娠中", "수유 중": "授乳中" } },
    },
  },

  zh: {
    greeting: "您好，我是狎鸥亭Tune医院的Agentune——您追求自然美的伙伴。\n\n就像去人气餐厅前先看菜单一样，提前整理您的困扰，院长从一开始就能抓住重点。\n\n9道快速选择题和简短对话，大约2分钟即可完成。\n\n请告诉我您的皮肤困扰。",
    chiefComplaintPlaceholder: "请告诉我您的皮肤困扰...",
    replyPlaceholder: "请输入您的回答...",
    nextButton: "下一步",
    skipLabel: "不太清楚",
    headerTitle: "狎鸥亭Tune医院 Agentune",
    headerSubtitle: "咨询进行中",
    headerSubtitleQuickCollect: "基本信息",
    headerSubtitleComplete: "咨询完成",
    headerSubtitleEscalated: "紧急升级",
    completionMessage: "咨询已完成。院长确认后会联系您。",
    escalationMessage: "情况紧急，请立即拨打医院电话 02-540-8011 或前往最近的急诊室。",
    errorMessage: "连接失败。",
    retryButton: "重试",
    loadingText: "加载中...",
    steps: {
      patient_name: { question: "请告诉我您的姓名。", placeholder: "张三" },
      patient_phone: { question: "请告诉我您的联系电话。", placeholder: "+86-138-0000-0000" },
      skin_concerns: {
        question: "您有什么皮肤困扰？",
        options: { "처짐/주름": "松弛 / 皱纹", "기미/색소": "黄褐斑 / 色素", "모공": "毛孔", "여드름/흉터": "痘痘 / 疤痕", "탄력": "弹性下降", "피부톤/결": "肤色 / 肤质" },
      },
      treatment_interests: { question: "有感兴趣的项目吗？", skipLabel: "不太清楚" },
      age_range: {
        question: "请选择您的年龄段。",
        options: { "20대": "20多岁", "30대": "30多岁", "40대": "40多岁", "50대": "50多岁", "60대 이상": "60岁以上" },
      },
      gender: { question: "请选择您的性别。", options: { "여성": "女", "남성": "男" } },
      previous_treatments: { question: "您之前做过医美项目吗？", options: { "있음": "做过", "없음": "没有" } },
      retinoid_use: { question: "您在使用视黄醇（维生素A）产品吗？", options: { "사용 중": "在使用", "사용 안 함": "未使用", "모름": "不清楚" } },
      pregnancy_status: { question: "您是否怀孕或哺乳中？", options: { "해당 없음": "不适用", "임신 중": "怀孕中", "수유 중": "哺乳中" } },
    },
  },
};

export function detectLang(param: string | null): Lang {
  if (param === "en" || param === "ja" || param === "zh") return param;
  return "ko";
}
