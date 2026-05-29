// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * 입차 현황 v2 — 실시간 주차중 + ⚠️ 유예초과 + 번호판 수정 + 강제출차(요금/무료)
 * (GAP-P0-3)
 *
 * API (모두 기존):
 *   GET   /api/v1/tickets/active                         실시간 미완료 티켓 (admin=전체매장 / crew=배정매장)
 *   PATCH /api/v1/tickets/:id/plate   { plate_number }   번호판 수정
 *   POST  /api/v1/fee/calculate       { entry_time, store_id, visit_place_id?, is_valet?, ticket_id }  요금계산
 *   PATCH /api/v1/tickets/:id/complete{ calculated_fee, payment_method? }  강제출차(유료=요금 / 무료=0)
 *
 * 레이아웃: /v2/layout.tsx 가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용
 * ⚠️ API-first — Supabase 직접 호출 없음. 신규 라우트·SQL 없음(active select 필드만 가산).
 */

import { useState, useEffect, useCallback, useMemo } from "react";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

// 상태 표기 (mepark_tickets.status)
const STATUS_META: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  parking:        { label: "주차중",   bg: "#ECFDF5", color: "#059669", dot: "🟢" },
  pre_paid:       { label: "사전정산", bg: "#EEF2FF", color: NAVY,      dot: "💳" },
  exit_requested: { label: "출차요청", bg: "#FFF7E6", color: "#B45309", dot: "🚗" },
  overdue:        { label: "유예초과", bg: "#FEF2F2", color: "#DC2626", dot: "⚠️" },
};

const PAY_METHODS = ["현금", "카드", "계좌이체", "기타"];

// 경과시간 (분 → "N시간 M분")
function elapsedText(fromISO: string): string {
  if (!fromISO) return "-";
  const min = Math.max(0, Math.floor((Date.now() - new Date(fromISO).getTime()) / 60000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}
// 초과시간 (마감 대비 경과 분)
function overMin(deadlineISO?: string): number {
  if (!deadlineISO) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(deadlineISO).getTime()) / 60000));
}
function fmtTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function plateLabel(t: any): string {
  return t.plate_number || (t.plate_last4 ? `**** ${t.plate_last4}` : "번호미상");
}

export default function V2ParkingStatusPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  // 필터
  const [tab, setTab] = useState<"parked" | "overdue">("parked");
  const [statusFilter, setStatusFilter] = useState<"all" | "parking" | "pre_paid" | "exit_requested">("all");
  const [storeFilter, setStoreFilter] = useState("");
  const [search, setSearch] = useState("");

  // 번호판 수정 모달
  const [plateTarget, setPlateTarget] = useState<any>(null);
  const [plateInput, setPlateInput] = useState("");
  const [plateSaving, setPlateSaving] = useState(false);
  const [plateError, setPlateError] = useState("");

  // 강제출차 모달
  const [exitTarget, setExitTarget] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeData, setFeeData] = useState<any>(null);
  const [feeError, setFeeError] = useState("");
  const [payMethod, setPayMethod] = useState("현금");
  const [exitSaving, setExitSaving] = useState(false);

  // ── 실시간 목록 로드 ──
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/tickets/active", { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "주차 현황을 불러오지 못했습니다");
        if (!silent) setTickets([]);
      } else {
        setTickets(Array.isArray(json.data?.tickets) ? json.data.tickets : []);
        setRefreshedAt(new Date());
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      if (!silent) setTickets([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // 15초 자동 갱신 (조용히)
  useEffect(() => {
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [load]);

  // ── 매장 목록 (활성 티켓 기준) ──
  const storeOptions = useMemo(() => {
    const m = new Map<string, string>();
    tickets.forEach(t => { if (t.store_id) m.set(t.store_id, t.stores?.name || "매장"); });
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [tickets]);

  // ── KPI ──
  const kpi = useMemo(() => ({
    total: tickets.length,
    pre_paid: tickets.filter(t => t.status === "pre_paid").length,
    exit_requested: tickets.filter(t => t.status === "exit_requested").length,
    overdue: tickets.filter(t => t.status === "overdue").length,
  }), [tickets]);

  // ── 필터링된 리스트 ──
  const list = useMemo(() => {
    const q = search.trim().replace(/[^0-9a-zA-Z가-힣]/g, "");
    return tickets.filter(t => {
      if (storeFilter && t.store_id !== storeFilter) return false;
      if (tab === "overdue") {
        if (t.status !== "overdue") return false;
      } else {
        if (t.status === "overdue") return false; // 초과는 별도 탭에서만
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
      }
      if (q) {
        const hay = `${t.plate_number || ""}${t.plate_last4 || ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, tab, statusFilter, storeFilter, search]);

  // ── 번호판 수정 ──
  const openPlate = (t: any) => { setPlateTarget(t); setPlateInput(t.plate_number || ""); setPlateError(""); };
  const savePlate = async () => {
    const v = plateInput.trim();
    if (v.replace(/[^0-9]/g, "").length < 4) { setPlateError("숫자 4자리 이상이어야 합니다"); return; }
    setPlateSaving(true); setPlateError("");
    try {
      const res = await fetch(`/api/v1/tickets/${plateTarget.id}/plate`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate_number: v }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) { setPlateError(json?.error?.message || "수정 실패"); return; }
      setPlateTarget(null);
      await load(true);
    } catch { setPlateError("네트워크 오류"); }
    finally { setPlateSaving(false); }
  };

  // ── 강제출차: 모달 열고 요금 선조회 ──
  const openExit = async (t: any) => {
    setExitTarget(t); setFeeData(null); setFeeError(""); setPayMethod("현금");
    setFeeLoading(true);
    try {
      const res = await fetch("/api/v1/fee/calculate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_time: t.entry_at,
          store_id: t.store_id,
          visit_place_id: t.visit_place_id || undefined,
          is_valet: t.parking_type === "valet",
          ticket_id: t.id,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) { setFeeError(json?.error?.message || "요금 계산 실패"); }
      else setFeeData(json.data);
    } catch { setFeeError("네트워크 오류"); }
    finally { setFeeLoading(false); }
  };

  // ── 강제출차 실행 (free=true → 무료 0원) ──
  const doExit = async (free: boolean) => {
    if (!exitTarget) return;
    const fee = free ? 0 : (feeData?.total_fee ?? 0);
    setExitSaving(true);
    try {
      const res = await fetch(`/api/v1/tickets/${exitTarget.id}/complete`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculated_fee: fee, payment_method: free ? "무료" : payMethod }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) { setFeeError(json?.error?.message || "출차 처리 실패"); return; }
      setExitTarget(null);
      await load(true);
    } catch { setFeeError("네트워크 오류"); }
    finally { setExitSaving(false); }
  };

  const monthlyOrFree = !!feeData?.is_monthly || !!exitTarget?.is_monthly || !!exitTarget?.is_free;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: "0 auto" }}>
      <style>{`
        .v2ps-input { width: 100%; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
        .v2ps-input:focus { outline: none; border-color: ${NAVY}; }
        .v2ps-btn { padding: 9px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; }
        .v2ps-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
        .v2ps-kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
        .v2ps-num { font-family: 'Outfit', system-ui, sans-serif; font-weight: 800; }
        .v2ps-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 7px; font-size: 12px; font-weight: 800; }
        .v2ps-tab { padding: 9px 16px; border-radius: 9px; font-size: 14px; font-weight: 700; cursor: pointer; border: 1px solid transparent; background: #fff; }
        .v2ps-modal-bg { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 16px; }
        .v2ps-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
      `}</style>

      {/* ── 헤더 ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>입차 현황</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>
            실시간 주차중 차량 · 15초 자동 갱신{refreshedAt ? ` · 최근 ${fmtTime(refreshedAt.toISOString())}` : ""}
          </p>
        </div>
        <button className="v2ps-btn" onClick={() => load()} style={{ background: "#F1F5F9", color: "#334155" }}>↻ 새로고침</button>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {[
          { label: "주차중", value: kpi.total, color: "#059669" },
          { label: "사전정산", value: kpi.pre_paid, color: NAVY },
          { label: "출차요청", value: kpi.exit_requested, color: "#B45309" },
          { label: "⚠️ 유예초과", value: kpi.overdue, color: "#DC2626" },
        ].map((k, i) => (
          <div key={i} className="v2ps-kpi">
            <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>{k.label}</div>
            <div className="v2ps-num" style={{ fontSize: 30, color: k.color, marginTop: 2 }}>{k.value}<span style={{ fontSize: 14, marginLeft: 3 }}>대</span></div>
          </div>
        ))}
      </div>

      {/* ── 탭 ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="v2ps-tab" onClick={() => setTab("parked")}
          style={tab === "parked" ? { background: NAVY, color: "#fff" } : { color: "#475569", border: "1px solid #e2e8f0" }}>
          입차현황
        </button>
        <button className="v2ps-tab" onClick={() => setTab("overdue")}
          style={tab === "overdue" ? { background: "#DC2626", color: "#fff" } : { color: "#DC2626", border: "1px solid #FECACA" }}>
          ⚠️ 유예초과 {kpi.overdue > 0 ? `(${kpi.overdue})` : ""}
        </button>
      </div>

      {/* ── 필터 줄 ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
          <input className="v2ps-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="차량번호 검색" />
        </div>
        {storeOptions.length > 1 && (
          <select className="v2ps-input" value={storeFilter} onChange={e => setStoreFilter(e.target.value)} style={{ width: "auto", minWidth: 150 }}>
            <option value="">전체 매장</option>
            {storeOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {tab === "parked" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "all", label: "전체" },
              { id: "parking", label: "🟢 주차중" },
              { id: "pre_paid", label: "💳 사전정산" },
              { id: "exit_requested", label: "🚗 출차요청" },
            ].map(f => (
              <button key={f.id} className="v2ps-btn" onClick={() => setStatusFilter(f.id as any)}
                style={statusFilter === f.id ? { background: "#EEF2FF", color: NAVY, border: `1px solid ${NAVY}` } : { background: "#fff", color: "#64748B", border: "1px solid #e2e8f0" }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 본문 ── */}
      {loading ? (
        <div className="v2ps-card" style={{ textAlign: "center", color: "#94A3B8", padding: "50px 20px" }}>불러오는 중…</div>
      ) : error ? (
        <div className="v2ps-card" style={{ textAlign: "center", color: "#DC2626" }}>
          {error}
          <div><button className="v2ps-btn" onClick={() => load()} style={{ marginTop: 12, background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>다시 시도</button></div>
        </div>
      ) : list.length === 0 ? (
        <div className="v2ps-card" style={{ padding: "50px 20px", textAlign: "center", color: "#94A3B8" }}>
          {tab === "overdue" ? "유예시간 초과 차량이 없습니다" : "주차중인 차량이 없습니다"}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {list.map(t => {
            const sm = STATUS_META[t.status] || { label: t.status, bg: "#f1f5f9", color: "#475569", dot: "•" };
            const loc = t.parking_lots?.name || t.parking_location;
            const over = t.status === "overdue" ? overMin(t.pre_paid_deadline) : 0;
            return (
              <div key={t.id} className="v2ps-card" style={t.status === "overdue" ? { borderColor: "#FECACA", background: "#FFFCFC" } : {}}>
                {/* 상단: 번호 + 상태 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div className="v2ps-num" style={{ fontSize: 19, color: "#1A1D2B", letterSpacing: ".3px" }}>{plateLabel(t)}</div>
                    <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{t.stores?.name || "매장"}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                    <span className="v2ps-badge" style={{ background: sm.bg, color: sm.color }}>{sm.dot} {sm.label}</span>
                    {t.is_monthly && <span className="v2ps-badge" style={{ background: "#F3E8FF", color: "#7C3AED" }}>월주차</span>}
                    {t.is_free && !t.is_monthly && <span className="v2ps-badge" style={{ background: "#ECFDF5", color: "#059669" }}>🆓 무료</span>}
                  </div>
                </div>

                {/* 메타 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 12, fontSize: 12.5 }}>
                  <div><span style={{ color: "#94A3B8" }}>입차 </span><span style={{ color: "#334155", fontWeight: 600 }}>{fmtTime(t.entry_at)}</span></div>
                  <div><span style={{ color: "#94A3B8" }}>경과 </span><span style={{ color: "#334155", fontWeight: 600 }}>{elapsedText(t.entry_at)}</span></div>
                  {loc && <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#94A3B8" }}>위치 </span><span style={{ color: "#334155", fontWeight: 600 }}>🅿️ {loc}</span></div>}
                  {(t.car_type || t.car_color) && <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#94A3B8" }}>차량 </span><span style={{ color: "#334155", fontWeight: 600 }}>{[t.car_color, t.car_type].filter(Boolean).join(" ")}</span></div>}
                </div>

                {/* 초과 정보 */}
                {t.status === "overdue" && (
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "#FEF2F2", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 700 }}>
                      마감 {fmtTime(t.pre_paid_deadline)} · {over}분 초과
                    </span>
                    {(t.additional_fee ?? 0) > 0 && <span className="v2ps-num" style={{ fontSize: 14, color: "#DC2626" }}>추가 {Number(t.additional_fee).toLocaleString()}원</span>}
                  </div>
                )}

                {/* 액션 */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="v2ps-btn" onClick={() => openPlate(t)} style={{ flex: 1, background: "#F1F5F9", color: "#334155" }}>번호판 수정</button>
                  <button className="v2ps-btn" onClick={() => openExit(t)} style={{ flex: 1, background: NAVY, color: "#fff" }}>강제출차</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ════ 번호판 수정 모달 ════ */}
      {plateTarget && (
        <div className="v2ps-modal-bg" onClick={() => !plateSaving && setPlateTarget(null)}>
          <div className="v2ps-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>번호판 수정</h3>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0" }}>{plateTarget.stores?.name} · 입차 {fmtTime(plateTarget.entry_at)}</p>
            </div>
            <div style={{ padding: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>차량번호</label>
              <input className="v2ps-input" value={plateInput} onChange={e => setPlateInput(e.target.value)} placeholder="예: 12가 3456" autoFocus
                onKeyDown={e => e.key === "Enter" && savePlate()} />
              {plateError && <p style={{ fontSize: 12, color: "#DC2626", margin: "8px 0 0" }}>{plateError}</p>}
            </div>
            <div style={{ padding: "0 20px 20px", display: "flex", gap: 8 }}>
              <button className="v2ps-btn" onClick={() => setPlateTarget(null)} disabled={plateSaving} style={{ flex: 1, background: "#F1F5F9", color: "#334155" }}>취소</button>
              <button className="v2ps-btn" onClick={savePlate} disabled={plateSaving} style={{ flex: 1, background: NAVY, color: "#fff" }}>{plateSaving ? "저장 중…" : "저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ 강제출차 모달 ════ */}
      {exitTarget && (
        <div className="v2ps-modal-bg" onClick={() => !exitSaving && setExitTarget(null)}>
          <div className="v2ps-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>강제출차</h3>
              <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0" }}>
                <b className="v2ps-num">{plateLabel(exitTarget)}</b> · {exitTarget.stores?.name}
              </p>
            </div>
            <div style={{ padding: 20 }}>
              {feeLoading ? (
                <div style={{ textAlign: "center", color: "#94A3B8", padding: "20px 0" }}>요금 계산 중…</div>
              ) : feeError && !feeData ? (
                <div style={{ color: "#DC2626", fontSize: 13 }}>{feeError}</div>
              ) : (
                <>
                  {/* 요금 요약 */}
                  <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#64748B" }}>
                      <span>주차시간</span><span style={{ fontWeight: 600, color: "#334155" }}>{elapsedText(exitTarget.entry_at)}</span>
                    </div>
                    {monthlyOrFree ? (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#059669", fontWeight: 700 }}>
                        {feeData?.is_monthly || exitTarget.is_monthly ? "월주차 차량 — 정산 없음" : "무료 처리 차량"}
                      </div>
                    ) : (
                      <>
                        {feeData?.breakdown && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#94A3B8", marginTop: 6 }}>
                            <span>주차요금 {Number(feeData.breakdown.parking_fee || 0).toLocaleString()}원
                              {feeData.breakdown.valet_fee ? ` · 발렛 ${Number(feeData.breakdown.valet_fee).toLocaleString()}원` : ""}</span>
                            {feeData.breakdown.daily_max_applied && <span style={{ color: GOLD, fontWeight: 700 }}>일최대 적용</span>}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px dashed #e2e8f0" }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>정산 금액</span>
                          <span className="v2ps-num" style={{ fontSize: 24, color: NAVY }}>{Number(feeData?.total_fee || 0).toLocaleString()}<span style={{ fontSize: 14 }}>원</span></span>
                        </div>
                        {(exitTarget.paid_amount ?? 0) > 0 && (
                          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, textAlign: "right" }}>기결제 {Number(exitTarget.paid_amount).toLocaleString()}원</div>
                        )}
                      </>
                    )}
                  </div>

                  {/* 결제수단 (유료일 때만) */}
                  {!monthlyOrFree && (feeData?.total_fee ?? 0) > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>결제수단</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {PAY_METHODS.map(m => (
                          <button key={m} className="v2ps-btn" onClick={() => setPayMethod(m)}
                            style={payMethod === m ? { background: "#EEF2FF", color: NAVY, border: `1px solid ${NAVY}` } : { background: "#fff", color: "#64748B", border: "1px solid #e2e8f0" }}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {feeError && <p style={{ fontSize: 12, color: "#DC2626", margin: "0 0 10px" }}>{feeError}</p>}

                  {/* 실행 버튼 */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="v2ps-btn" onClick={() => doExit(true)} disabled={exitSaving}
                      style={{ flex: monthlyOrFree ? 2 : 1, background: "#fff", color: "#059669", border: "1px solid #A7F3D0" }}>
                      🆓 무료 출차
                    </button>
                    {!monthlyOrFree && (
                      <button className="v2ps-btn" onClick={() => doExit(false)} disabled={exitSaving}
                        style={{ flex: 2, background: NAVY, color: "#fff" }}>
                        {exitSaving ? "처리 중…" : `💳 ${Number(feeData?.total_fee || 0).toLocaleString()}원 출차`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "0 20px 18px" }}>
              <button className="v2ps-btn" onClick={() => setExitTarget(null)} disabled={exitSaving} style={{ width: "100%", background: "#F1F5F9", color: "#64748B" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
