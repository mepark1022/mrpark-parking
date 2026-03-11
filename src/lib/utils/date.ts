// @ts-nocheck
import {
  format, isWeekend, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, addDays, parseISO, isValid,
} from "date-fns";
import { ko } from "date-fns/locale";

// ── KST 안전 유틸 ──────────────────────────────
// toISOString()은 UTC 변환 → KST에서 하루 밀리는 버그 발생
// 아래 함수들은 로컬(KST) 기준으로 안전하게 날짜 문자열 생성

/** Date → "YYYY-MM-DD" (KST 기준, 서버/클라이언트 모두 안전) */
export function toKSTDateStr(d: Date): string {
  // KST = UTC + 9시간
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 날짜 "YYYY-MM-DD" (KST) */
export function getToday(): string {
  return toKSTDateStr(new Date());
}

/** KST 오늘 자정 ISO 문자열 (DB 범위 쿼리용) */
export function getKSTTodayStart(): string {
  const today = getToday();
  return new Date(today + "T00:00:00+09:00").toISOString();
}

/** KST 현재 시각 ISO 문자열 */
export function getKSTNow(): string {
  return new Date().toISOString();
}

/** 해당월 말일 Date 객체 */
export function getLastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** 해당월 말일 "YYYY-MM-DD" (KST) */
export function getLastDayOfMonthStr(d: Date): string {
  return toKSTDateStr(getLastDayOfMonth(d));
}

// ── 기존 유틸 (date-fns 기반) ──────────────────

export function formatDate(date: Date | string, fmt: string = "yyyy-MM-dd"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, fmt, { locale: ko }) : "";
}

export function formatDateKR(date: Date | string): string {
  return formatDate(date, "yyyy년 M월 d일 EEEE");
}

export function formatDateShort(date: Date | string): string {
  return formatDate(date, "M/d");
}

export function getDayType(date: Date | string): "weekday" | "weekend" {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isWeekend(d) ? "weekend" : "weekday";
}

export function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    end: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  return {
    start: format(startOfMonth(now), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export function daysAgo(n: number): string {
  return format(subDays(new Date(), n), "yyyy-MM-dd");
}

export function daysLater(n: number): string {
  return format(addDays(new Date(), n), "yyyy-MM-dd");
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}시`;
}

export const BUSINESS_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
