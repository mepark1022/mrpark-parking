// 한국 공휴일 데이터 (2025-2027)
// 매년 초에 다음 해 데이터 추가 필요 (음력 기반 명절은 매년 날짜가 다름)

interface HolidayInfo {
  date: string; // YYYY-MM-DD
  name: string;
  type: "holiday" | "substitute"; // 공휴일 / 대체공휴일
}

const HOLIDAYS: HolidayInfo[] = [
  // ── 2025년 ──
  { date: "2025-01-01", name: "신정", type: "holiday" },
  { date: "2025-01-28", name: "설날 연휴", type: "holiday" },
  { date: "2025-01-29", name: "설날", type: "holiday" },
  { date: "2025-01-30", name: "설날 연휴", type: "holiday" },
  { date: "2025-03-01", name: "삼일절", type: "holiday" },
  { date: "2025-03-03", name: "삼일절 대체공휴일", type: "substitute" },
  { date: "2025-05-05", name: "어린이날", type: "holiday" },
  { date: "2025-05-06", name: "부처님오신날/어린이날 대체공휴일", type: "substitute" },
  { date: "2025-06-06", name: "현충일", type: "holiday" },
  { date: "2025-08-15", name: "광복절", type: "holiday" },
  { date: "2025-10-03", name: "개천절", type: "holiday" },
  { date: "2025-10-05", name: "추석 연휴", type: "holiday" },
  { date: "2025-10-06", name: "추석", type: "holiday" },
  { date: "2025-10-07", name: "추석 연휴", type: "holiday" },
  { date: "2025-10-08", name: "추석 대체공휴일", type: "substitute" },
  { date: "2025-10-09", name: "한글날", type: "holiday" },
  { date: "2025-12-25", name: "크리스마스", type: "holiday" },

  // ── 2026년 ──
  { date: "2026-01-01", name: "신정", type: "holiday" },
  { date: "2026-02-16", name: "설날 연휴", type: "holiday" },
  { date: "2026-02-17", name: "설날", type: "holiday" },
  { date: "2026-02-18", name: "설날 연휴", type: "holiday" },
  { date: "2026-03-01", name: "삼일절", type: "holiday" },
  { date: "2026-03-02", name: "삼일절 대체공휴일", type: "substitute" },
  { date: "2026-05-05", name: "어린이날", type: "holiday" },
  { date: "2026-05-24", name: "부처님오신날", type: "holiday" },
  { date: "2026-05-25", name: "부처님오신날 대체공휴일", type: "substitute" },
  { date: "2026-06-06", name: "현충일", type: "holiday" },
  { date: "2026-08-15", name: "광복절", type: "holiday" },
  { date: "2026-08-17", name: "광복절 대체공휴일", type: "substitute" },
  { date: "2026-09-24", name: "추석 연휴", type: "holiday" },
  { date: "2026-09-25", name: "추석", type: "holiday" },
  { date: "2026-09-26", name: "추석 연휴", type: "holiday" },
  { date: "2026-10-03", name: "개천절", type: "holiday" },
  { date: "2026-10-05", name: "개천절 대체공휴일", type: "substitute" },
  { date: "2026-10-09", name: "한글날", type: "holiday" },
  { date: "2026-12-25", name: "크리스마스", type: "holiday" },

  // ── 2027년 ──
  { date: "2027-01-01", name: "신정", type: "holiday" },
  { date: "2027-02-06", name: "설날 연휴", type: "holiday" },
  { date: "2027-02-07", name: "설날", type: "holiday" },
  { date: "2027-02-08", name: "설날 연휴", type: "holiday" },
  { date: "2027-02-09", name: "설날 대체공휴일", type: "substitute" },
  { date: "2027-03-01", name: "삼일절", type: "holiday" },
  { date: "2027-05-05", name: "어린이날", type: "holiday" },
  { date: "2027-05-13", name: "부처님오신날", type: "holiday" },
  { date: "2027-06-06", name: "현충일", type: "holiday" },
  { date: "2027-06-07", name: "현충일 대체공휴일", type: "substitute" },
  { date: "2027-08-15", name: "광복절", type: "holiday" },
  { date: "2027-08-16", name: "광복절 대체공휴일", type: "substitute" },
  { date: "2027-10-03", name: "개천절", type: "holiday" },
  { date: "2027-10-04", name: "개천절 대체공휴일", type: "substitute" },
  { date: "2027-10-09", name: "한글날", type: "holiday" },
  { date: "2027-10-11", name: "한글날 대체공휴일", type: "substitute" },
  { date: "2027-10-14", name: "추석 연휴", type: "holiday" },
  { date: "2027-10-15", name: "추석", type: "holiday" },
  { date: "2027-10-16", name: "추석 연휴", type: "holiday" },
  { date: "2027-12-25", name: "크리스마스", type: "holiday" },
];

// 빠른 조회를 위한 Map
const holidayMap = new Map<string, HolidayInfo>();
HOLIDAYS.forEach(h => holidayMap.set(h.date, h));

/**
 * 날짜의 근무 유형 판별
 * @returns "weekday" | "weekend" | "holiday"
 */
export function getDayType(dateStr: string): "weekday" | "weekend" | "holiday" {
  // 공휴일 체크 (주말보다 우선)
  if (holidayMap.has(dateStr)) return "holiday";
  
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  if (day === 0 || day === 6) return "weekend";
  
  return "weekday";
}

/**
 * 공휴일 이름 반환 (공휴일이 아니면 null)
 */
export function getHolidayName(dateStr: string): string | null {
  return holidayMap.get(dateStr)?.name || null;
}

/**
 * 공휴일 상세 정보 반환
 */
export function getHolidayInfo(dateStr: string): HolidayInfo | null {
  return holidayMap.get(dateStr) || null;
}

/**
 * 날짜 유형 라벨 (UI 표시용)
 */
export function getDayTypeLabel(dateStr: string): { label: string; color: string; bg: string } {
  const holiday = holidayMap.get(dateStr);
  if (holiday) {
    return { 
      label: holiday.name, 
      color: "#dc2626", 
      bg: "#fee2e2" 
    };
  }
  
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  
  if (day === 0) return { label: "일요일", color: "#dc2626", bg: "#fee2e2" };
  if (day === 6) return { label: "토요일", color: "#2563eb", bg: "#dbeafe" };
  
  return { label: "평일", color: "#15803d", bg: "#dcfce7" };
}
