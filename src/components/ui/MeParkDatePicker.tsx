// @ts-nocheck
"use client";
import { useState, useRef, useEffect, useCallback } from "react";

/**
 * ME.PARK 브랜드 날짜 선택기
 * - 네이비(#1428A0) 선택일 / 골드(#F5B731) 오늘 표시
 * - 드롭다운 캘린더 팝업
 * - value: "YYYY-MM-DD", onChange: (val: string) => void
 */

const C = {
  navy: "#1428A0",
  gold: "#F5B731",
  goldBg: "#FFF8E7",
  text: "#222222",
  gray: "#666666",
  muted: "#8B90A0",
  border: "#D0D2DA",
  lightGray: "#F5F6F8",
  white: "#FFFFFF",
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  value: string;           // "YYYY-MM-DD"
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  compact?: boolean;       // 모바일용 작은 사이즈
}

export default function MeParkDatePicker({ value, onChange, style, compact }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // value 파싱
  const selected = parseDate(value);
  const today = new Date();
  const todayStr = fmt(today);

  // 캘린더 표시 월
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  // value 변경 시 뷰 동기화
  useEffect(() => {
    const d = parseDate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  // 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 월 이동
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // 날짜 선택
  const selectDate = (d: number) => {
    const str = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    onChange(str);
    setOpen(false);
  };

  // 오늘 이동
  const goToday = () => {
    onChange(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setOpen(false);
  };

  // 달력 데이터
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  // 6주 고정 그리드
  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevMonthDays - firstDay + 1 + i, inMonth: false });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ day: i, inMonth: true });
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, inMonth: false });

  const selectedDay = selected.getFullYear() === viewYear && selected.getMonth() === viewMonth ? selected.getDate() : -1;
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : -1;

  const sz = compact ? { fontSize: 13, padding: "8px 10px" } : { fontSize: 14, padding: "10px 14px" };

  // 표시 텍스트
  const displayText = `${selected.getFullYear()}.${String(selected.getMonth() + 1).padStart(2, "0")}.${String(selected.getDate()).padStart(2, "0")}`;
  const dayLabel = ["일", "월", "화", "수", "목", "금", "토"][selected.getDay()];
  const isToday = value === todayStr;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", ...style }}>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          ...sz,
          borderRadius: 10,
          border: `1px solid ${open ? C.navy : C.border}`,
          background: C.white,
          color: C.text,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          whiteSpace: "nowrap",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <rect x="1" y="2.5" width="14" height="12" rx="2" stroke={C.navy} strokeWidth="1.5" fill="none"/>
          <path d="M1 6.5h14" stroke={C.navy} strokeWidth="1.5"/>
          <path d="M5 1v3M11 1v3" stroke={C.navy} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span>{displayText}</span>
        <span style={{ color: C.muted, fontSize: compact ? 11 : 12, fontWeight: 400 }}>({dayLabel})</span>
        {isToday && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: C.gold, background: C.goldBg,
            padding: "1px 6px", borderRadius: 4, marginLeft: "auto"
          }}>오늘</span>
        )}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: isToday ? 0 : "auto", flexShrink: 0 }}>
          <path d="M1 1l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* 캘린더 드롭다운 */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          right: 0,
          zIndex: 9999,
          background: C.white,
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(20,40,160,0.15), 0 2px 8px rgba(0,0,0,0.08)",
          border: `1px solid ${C.border}`,
          width: 300,
          overflow: "hidden",
          animation: "meparkCalFadeIn 0.15s ease-out",
        }}>
          {/* 헤더 */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${C.lightGray}`,
          }}>
            <button type="button" onClick={prevMonth} style={navBtn}>
              <svg width="7" height="12" viewBox="0 0 7 12"><path d="M6 1L1 6l5 5" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.navy, letterSpacing: -0.3 }}>
              {viewYear}년 {String(viewMonth + 1).padStart(2, "0")}월
            </span>
            <button type="button" onClick={nextMonth} style={navBtn}>
              <svg width="7" height="12" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 12px 4px", gap: 0 }}>
            {DAYS.map((d, i) => (
              <div key={d} style={{
                textAlign: "center", fontSize: 11, fontWeight: 600,
                color: i === 0 ? "#DC2626" : i === 6 ? "#2563EB" : C.muted,
                paddingBottom: 4,
              }}>{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "2px 12px 8px", gap: 2 }}>
            {cells.map((cell, idx) => {
              if (!cell.inMonth) {
                return <div key={`e-${idx}`} style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, color: "#D0D2DA" }}>{cell.day}</span>
                </div>;
              }
              const isSelected = cell.day === selectedDay;
              const isTodayCell = cell.day === todayDay;
              const dayOfWeek = (firstDay + cell.day - 1) % 7;
              const isSun = dayOfWeek === 0;
              const isSat = dayOfWeek === 6;

              let bg = "transparent";
              let color = C.text;
              let fontWeight = 500;
              let border = "2px solid transparent";

              if (isSelected) {
                bg = C.navy;
                color = C.white;
                fontWeight = 700;
              } else if (isTodayCell) {
                bg = C.goldBg;
                color = C.navy;
                fontWeight = 700;
                border = `2px solid ${C.gold}`;
              } else {
                if (isSun) color = "#DC2626";
                if (isSat) color = "#2563EB";
              }

              return (
                <button
                  key={`d-${cell.day}`}
                  type="button"
                  onClick={() => selectDate(cell.day)}
                  style={{
                    height: 36, width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: bg, color, fontWeight,
                    border, borderRadius: 10,
                    fontSize: 13, cursor: "pointer",
                    transition: "all 0.12s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.target as HTMLElement).style.background = C.lightGray; }}
                  onMouseLeave={e => { if (!isSelected && !isTodayCell) (e.target as HTMLElement).style.background = "transparent"; else if (isTodayCell && !isSelected) (e.target as HTMLElement).style.background = C.goldBg; }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* 하단 버튼 */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 14px 12px",
            borderTop: `1px solid ${C.lightGray}`,
          }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              fontSize: 13, fontWeight: 600, color: C.muted, background: "none", border: "none",
              cursor: "pointer", padding: "4px 8px",
            }}>닫기</button>
            <button type="button" onClick={goToday} style={{
              fontSize: 13, fontWeight: 700, color: C.white, background: C.navy,
              border: "none", borderRadius: 8, cursor: "pointer",
              padding: "6px 16px",
              transition: "opacity 0.15s",
            }}
              onMouseEnter={e => (e.target as HTMLElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.target as HTMLElement).style.opacity = "1"}
            >오늘</button>
          </div>
        </div>
      )}

      {/* 애니메이션 */}
      <style>{`
        @keyframes meparkCalFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "none", border: `1px solid ${C.border}`, borderRadius: 8,
  cursor: "pointer", transition: "background 0.15s",
};

function parseDate(s: string): Date {
  const [y, m, d] = (s || "").split("-").map(Number);
  if (y && m && d) return new Date(y, m - 1, d);
  return new Date();
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
