import {
  format, isWeekend, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, addDays, parseISO, isValid,
} from "date-fns";
import { ko } from "date-fns/locale";

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

export function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
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

export const BUSINESS_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);import {
  format, isWeekend, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, subDays, addDays, parseISO, isValid,
} from "date-fns";
import { ko } from "date-fns/locale";

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

export function getToday(): string {
  return format(new Date(), "yyyy-MM-dd");
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