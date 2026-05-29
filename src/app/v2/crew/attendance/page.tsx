// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * CREW v2 — 개인 근태 조회 페이지 (GAP-P0-5, A안: 읽기 전용)
 *
 * 데이터 소스: GET /api/v1/attendance/personal/:empId?year=&month=
 *   - 근태는 v2 모델(마감보고/현장일보 근무인원 + 관리자 override) 기준으로 집계됨
 *   - 본 페이지는 "내 이번달 출퇴근 현황"을 보여주는 뷰 (자가 체크인은 B안 후속 파트)
 *
 * 인증: localStorage.crew_store_id 가드 + /api/v1/auth/me 로 본인 employee_id 획득 (SELF 권한)
 * Supabase 직접 호출 없음 (API-first)
 * BottomNav/하단여백은 layout.tsx 가 처리 (NavSpacer + CrewV2BottomNav)
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── 근태 상태 메타 (라벨/색상) ──
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  present:    { label: "출근", color: "#1428A0", bg: "#EEF2FF" },
  late:       { label: "지각", color: "#D97706", bg: "#FEF3C7" },
  absent:     { label: "결근", color: "#DC2626", bg: "#FEF2F2" },
  peak:       { label: "피크", color: "#7C3AED", bg: "#F5F3FF" },
  support:    { label: "지원", color: "#0891B2", bg: "#ECFEFF" },
  additional: { label: "추가", color: "#059669", bg: "#ECFDF5" },
  off:        { label: "휴무", color: "#64748B", bg: "#F1F5F9" },
  leave:      { label: "연차", color: "#0EA5E9", bg: "#E0F2FE" },
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "슈퍼관리자", admin: "관리자", owner: "오너",
  crew: "크루", field_member: "현장직원",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// "HH:MM:SS" / "HH:MM" → "HH:MM"
function fmtTime(t: string | null): string {
  if (!t) return "—";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

// 근무시간(소수 h) → "8.5h" / "—"
function fmtHours(h: number | null | undefined): string {
  const n = Number(h ?? 0);
  if (!n) return "—";
  return `${Math.round(n * 10) / 10}h`;
}

export default function CrewV2AttendancePage() {
  const router = useRouter();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1~12

  const [empId, setEmpId] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("crew");
  const [noEmployee, setNoEmployee] = useState(false); // 직원 레코드 미연결

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  // 현재 월이 최신(미래로 못 감) 여부
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  // ── 1) 본인 employee_id 획득 ──
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    if (!sid) { router.replace("/v2/crew/login"); return; }

    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (!res.ok) { router.replace("/v2/crew/login?error=session_expired"); return; }
        const { data: me } = await res.json();
        setEmpName(me?.employee?.name || me?.emp_no || "크루");
        setEmpRole(me?.role || "crew");
        if (me?.employee?.id) {
          setEmpId(me.employee.id);
        } else {
          // 계정에 employee 레코드가 연결되지 않음 → 근태 집계 불가
          setNoEmployee(true);
          setLoading(false);
        }
      } catch {
        setError("사용자 정보를 불러오지 못했습니다");
        setLoading(false);
      }
    })();
  }, [router]);

  // ── 2) 월별 근태 조회 ──
  const loadAttendance = useCallback(async (eid: string, y: number, m: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/v1/attendance/personal/${eid}?year=${y}&month=${m}`,
        { credentials: "include" }
      );
      if (res.status === 401) { router.replace("/v2/crew/login?error=session_expired"); return; }
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "근태 정보를 불러오지 못했습니다");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (empId) loadAttendance(empId, year, month);
  }, [empId, year, month, loadAttendance]);

  // ── 월 이동 ──
  const goPrevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (isCurrentMonth) return; // 미래 차단
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const summary = data?.summary;
  const stats = data?.hours_stats;
  const rows: any[] = data?.rows ?? [];
  const dist: any[] = data?.store_distribution ?? [];
  const rowsDesc = [...rows].sort((a, b) => (a.date < b.date ? 1 : -1)); // 최신순

  return (
    <>
      <style>{`
        .cv2-att { min-height: 100dvh; background: #F8FAFC; font-family: 'Noto Sans KR', sans-serif; }
        .cv2-att-header {
          background: linear-gradient(135deg, #0a1352 0%, #1428A0 100%);
          padding: 20px 20px 22px;
          padding-top: calc(20px + env(safe-area-inset-top, 0));
        }
        .cv2-num { font-family: 'Outfit', sans-serif; }
        .cv2-kpi {
          background: #fff; border: 1px solid #E2E8F0; border-radius: 14px;
          padding: 14px; text-align: center;
        }
        .cv2-monthnav-btn {
          width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.1); color: #fff; font-size: 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          -webkit-tap-highlight-color: transparent; transition: all .15s;
        }
        .cv2-monthnav-btn:active { transform: scale(0.92); }
        .cv2-monthnav-btn:disabled { opacity: 0.3; cursor: default; }
        .cv2-row {
          background: #fff; border: 1px solid #E2E8F0; border-radius: 12px;
          padding: 13px 14px; display: flex; align-items: center; gap: 12px;
        }
      `}</style>

      <div className="cv2-att">
        {/* ── 헤더 ── */}
        <div className="cv2-att-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
                {empName}님
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  color: "#F5B731", background: "rgba(245,183,49,0.15)",
                  padding: "3px 8px", borderRadius: 6,
                }}>
                  {ROLE_LABEL[empRole] || empRole}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                내 근태 현황
              </div>
            </div>
          </div>

          {/* 월 네비게이션 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <button className="cv2-monthnav-btn" onClick={goPrevMonth} aria-label="이전 달">‹</button>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              <span className="cv2-num" style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
                {year}.{String(month).padStart(2, "0")}
              </span>
            </div>
            <button className="cv2-monthnav-btn" onClick={goNextMonth} disabled={isCurrentMonth} aria-label="다음 달">›</button>
          </div>
        </div>

        {/* ── 본문 ── */}
        <div style={{ padding: "16px 16px 8px" }}>
          {/* 직원 미연결 안내 */}
          {noEmployee ? (
            <div style={{
              background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16,
              padding: "40px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🪪</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1D2B", marginBottom: 6 }}>
                직원 정보가 연결되지 않았습니다
              </div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
                근태는 직원 계정 기준으로 집계됩니다.<br />
                관리자에게 직원 등록/연결을 요청해 주세요.
              </div>
            </div>
          ) : loading ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "#64748B", fontSize: 14 }}>
              로딩 중...
            </div>
          ) : error ? (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 14,
              padding: "20px", textAlign: "center", color: "#DC2626", fontSize: 14,
            }}>
              {error}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => empId && loadAttendance(empId, year, month)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "1px solid #FCA5A5",
                    background: "#fff", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── KPI 4칸 ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div className="cv2-kpi">
                  <div className="cv2-num" style={{ fontSize: 24, fontWeight: 800, color: "#1428A0" }}>
                    {summary?.total ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>출근일</div>
                </div>
                <div className="cv2-kpi">
                  <div className="cv2-num" style={{ fontSize: 24, fontWeight: 800, color: "#0a1352" }}>
                    {fmtHours(summary?.total_hours)}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>근무시간</div>
                </div>
                <div className="cv2-kpi" style={(summary?.late ?? 0) > 0 ? { background: "#FFFBEB", borderColor: "#FDE68A" } : {}}>
                  <div className="cv2-num" style={{ fontSize: 24, fontWeight: 800, color: (summary?.late ?? 0) > 0 ? "#D97706" : "#475569" }}>
                    {summary?.late ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: (summary?.late ?? 0) > 0 ? "#D97706" : "#64748B", marginTop: 3 }}>지각</div>
                </div>
                <div className="cv2-kpi" style={(summary?.absent ?? 0) > 0 ? { background: "#FEF2F2", borderColor: "#FECACA" } : {}}>
                  <div className="cv2-num" style={{ fontSize: 24, fontWeight: 800, color: (summary?.absent ?? 0) > 0 ? "#DC2626" : "#475569" }}>
                    {summary?.absent ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: (summary?.absent ?? 0) > 0 ? "#DC2626" : "#64748B", marginTop: 3 }}>결근</div>
                </div>
              </div>

              {/* ── 근무시간 통계 ── */}
              {stats && stats.days_worked > 0 && (
                <div style={{
                  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
                  padding: "14px 16px", marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 10 }}>⏱ 근무시간 통계</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                    <div>
                      <div className="cv2-num" style={{ fontSize: 18, fontWeight: 800, color: "#1428A0" }}>{fmtHours(stats.avg)}</div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>평균</div>
                    </div>
                    <div>
                      <div className="cv2-num" style={{ fontSize: 18, fontWeight: 800, color: "#475569" }}>{fmtHours(stats.max)}</div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>최대</div>
                    </div>
                    <div>
                      <div className="cv2-num" style={{ fontSize: 18, fontWeight: 800, color: "#475569" }}>{fmtHours(stats.min)}</div>
                      <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>최소</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 사업장 분포 (2곳 이상일 때만) ── */}
              {dist.length > 1 && (
                <div style={{
                  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
                  padding: "14px 16px", marginBottom: 16,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 10 }}>📍 사업장별 근무</div>
                  {dist.map((d: any) => (
                    <div key={d.store_id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "7px 0", borderBottom: "1px solid #F1F5F9",
                    }}>
                      <span style={{ fontSize: 13, color: "#334155" }}>{d.store_name || "—"}</span>
                      <span style={{ fontSize: 13, color: "#64748B" }}>
                        <b className="cv2-num" style={{ color: "#1428A0" }}>{d.count}</b>일 · {fmtHours(d.hours)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 일자별 상세 ── */}
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B", margin: "4px 2px 10px" }}>
                일자별 기록 <span style={{ color: "#94A3B8", fontWeight: 500 }}>({rows.length}건)</span>
              </div>

              {rowsDesc.length === 0 ? (
                <div style={{
                  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14,
                  padding: "40px 20px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🗓️</div>
                  <div style={{ fontSize: 14, color: "#64748B" }}>이 달의 근태 기록이 없습니다</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rowsDesc.map((r: any) => {
                    const meta = STATUS_META[r.status] || { label: r.status, color: "#64748B", bg: "#F1F5F9" };
                    const d = new Date(r.date + "T00:00:00");
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <div key={r.date} className="cv2-row">
                        {/* 날짜 */}
                        <div style={{ minWidth: 42, textAlign: "center" }}>
                          <div className="cv2-num" style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", lineHeight: 1 }}>
                            {d.getDate()}
                          </div>
                          <div style={{
                            fontSize: 11, marginTop: 3,
                            color: dow === 0 ? "#DC2626" : dow === 6 ? "#2563EB" : "#94A3B8",
                          }}>
                            {WEEKDAYS[dow]}
                          </div>
                        </div>

                        {/* 상태 + 매장 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            display: "inline-block", fontSize: 12, fontWeight: 700,
                            color: meta.color, background: meta.bg,
                            padding: "3px 9px", borderRadius: 7,
                          }}>
                            {meta.label}
                          </span>
                          {r.store_name && (
                            <div style={{
                              fontSize: 12, color: "#94A3B8", marginTop: 5,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {r.store_name}
                            </div>
                          )}
                        </div>

                        {/* 시각 + 근무시간 */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div className="cv2-num" style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                            {fmtTime(r.check_in)} <span style={{ color: "#CBD5E1" }}>~</span> {fmtTime(r.check_out)}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                            {fmtHours(r.work_hours)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── 안내 푸터 ── */}
              <div style={{
                marginTop: 16, padding: "11px 14px", borderRadius: 10,
                background: "#F1F5F9", fontSize: 12, color: "#94A3B8", lineHeight: 1.6,
              }}>
                ℹ️ 근태는 마감보고(현장일보)와 관리자 기록을 기준으로 집계됩니다.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
