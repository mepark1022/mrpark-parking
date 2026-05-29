// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * 사고보고 관리 v2 — admin (GAP-P1-3 / P1-6 Part 2)
 *
 * API (전부 기존/Part 1 신규, 신규 SQL 없음):
 *   GET    /api/v1/accidents?store_id=&status=&from=&to=   목록(서버 org_id/매장 스코핑)
 *   GET    /api/v1/accidents/:id                            상세 + 사진(signedUrl)
 *   PATCH  /api/v1/accidents/:id  { status?, admin_memo? }  상태변경/관리자 메모
 *   DELETE /api/v1/accidents/:id                            삭제(+사진 정리)
 *   GET    /api/v1/stores?status=active                     필터용 매장 목록
 *
 * 정책: v2 전화번호 미저장 → 차주 연락처 컬럼 없음. Supabase 직접호출 금지(API-first).
 * 레이아웃: /v2/layout.tsx 가 AppLayout(Sidebar+Header+MobileTabBar) 자동 적용.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const NAVY = "#1428A0";
const GOLD = "#F5B731";

// 상태값(레거시 동일): 접수 → 처리중 → 완료
const STATUS_META: Record<string, { bg: string; fg: string }> = {
  접수: { bg: "#EFF6FF", fg: "#2563EB" },
  처리중: { bg: "#FFFBEB", fg: "#D97706" },
  완료: { bg: "#ECFDF5", fg: "#059669" },
};
const STATUS_LIST = ["접수", "처리중", "완료"] as const;

const PERIOD_OPTIONS = [
  { label: "이번 달", value: "month" },
  { label: "지난 3개월", value: "3month" },
  { label: "올해", value: "year" },
  { label: "전체", value: "all" },
];

const fmt = (d: string) =>
  !d
    ? "-"
    : new Date(d).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

export default function V2AccidentPage() {
  const [accidents, setAccidents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 (status/period는 클라측 → KPI 정확도 유지, store는 API 스코핑)
  const [filterStore, setFilterStore] = useState(""); // ""=전체
  const [filterStatus, setFilterStatus] = useState(""); // ""=전체
  const [filterPeriod, setFilterPeriod] = useState("month");

  // 상세 모달
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [memo, setMemo] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [busy, setBusy] = useState(false);

  // 사진 라이트박스
  const [lightbox, setLightbox] = useState<string | null>(null);

  // ── 매장 목록(필터용, 1회) ──
  const loadStores = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/stores?status=active", { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        const arr = Array.isArray(json.data) ? json.data : json.data?.stores ?? [];
        setStores(arr);
      }
    } catch {
      /* 필터용 매장 로드 실패는 치명적 아님 */
    }
  }, []);

  // ── 사고 목록 로드(매장 스코핑만 API에, 상태/기간은 클라) ──
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterStore) params.set("store_id", filterStore);
      const qs = params.toString();
      const res = await fetch(`/api/v1/accidents${qs ? `?${qs}` : ""}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message || "사고 목록을 불러오지 못했습니다");
        setAccidents([]);
      } else {
        setAccidents(Array.isArray(json.data) ? json.data : []);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      setAccidents([]);
    } finally {
      setLoading(false);
    }
  }, [filterStore]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);
  useEffect(() => {
    load();
  }, [load]);

  // ── 상세 열기 ──
  const openDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    setActionMsg("");
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/accidents/${id}`, { credentials: "include" });
      const json = await res.json();
      if (res.ok && json?.success) {
        setDetail(json.data);
        setMemo(json.data.admin_memo || "");
      } else {
        setActionErr(json?.error?.message || "상세 조회 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
    setMemo("");
    setActionMsg("");
    setActionErr("");
    setLightbox(null);
  };

  // ── 상태 변경 (PATCH) ──
  const changeStatus = async (newStatus: string) => {
    if (!detail || detail.status === newStatus || busy) return;
    setBusy(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await fetch(`/api/v1/accidents/${detail.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setDetail((p: any) => ({ ...p, status: newStatus }));
        setAccidents((prev) => prev.map((a) => (a.id === detail.id ? { ...a, status: newStatus } : a)));
        setActionMsg("✅ 상태가 변경되었습니다");
      } else {
        setActionErr(json?.error?.message || "상태 변경 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  // ── 메모 저장 (PATCH) ──
  const saveMemo = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await fetch(`/api/v1/accidents/${detail.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_memo: memo }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setDetail((p: any) => ({ ...p, admin_memo: memo }));
        setAccidents((prev) => prev.map((a) => (a.id === detail.id ? { ...a, admin_memo: memo } : a)));
        setActionMsg("✅ 메모가 저장되었습니다");
      } else {
        setActionErr(json?.error?.message || "메모 저장 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  // ── 삭제 (DELETE) ──
  const handleDelete = async () => {
    if (!detail || busy) return;
    if (!confirm("이 사고보고를 삭제하시겠습니까? (사진도 함께 삭제됩니다)")) return;
    setBusy(true);
    setActionErr("");
    try {
      const res = await fetch(`/api/v1/accidents/${detail.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setAccidents((prev) => prev.filter((a) => a.id !== detail.id));
        closeDetail();
      } else {
        setActionErr(json?.error?.message || "삭제 실패");
      }
    } catch {
      setActionErr("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  // ── 기간 필터(클라) ──
  const inPeriod = useCallback(
    (a: any) => {
      if (filterPeriod === "all") return true;
      const d = new Date(a.accident_at);
      const now = new Date();
      if (filterPeriod === "month")
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (filterPeriod === "3month") {
        const limit = new Date();
        limit.setMonth(limit.getMonth() - 3);
        return d >= limit;
      }
      if (filterPeriod === "year") return d.getFullYear() === now.getFullYear();
      return true;
    },
    [filterPeriod]
  );

  // 표시 목록(상태+기간 클라 필터)
  const filtered = useMemo(
    () => accidents.filter((a) => (!filterStatus || a.status === filterStatus) && inPeriod(a)),
    [accidents, filterStatus, inPeriod]
  );

  // KPI (로드된 매장-스코프 전체 기준)
  const kpi = useMemo(() => {
    const now = new Date();
    const thisMonth = accidents.filter((a) => {
      const d = new Date(a.accident_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return [
      { title: "이번 달 사고", value: thisMonth, color: "#DC2626", icon: "🚨" },
      { title: "접수", value: accidents.filter((a) => a.status === "접수").length, color: "#2563EB", icon: "📥" },
      { title: "처리중", value: accidents.filter((a) => a.status === "처리중").length, color: "#D97706", icon: "⏳" },
      { title: "완료", value: accidents.filter((a) => a.status === "완료").length, color: "#059669", icon: "✅" },
    ];
  }, [accidents]);

  // ── 엑셀(클라측, 현재 필터 결과) ──
  const handleExcel = () => {
    const rows = filtered.map((a) => ({
      "사고 일시": fmt(a.accident_at),
      매장: a.stores?.name || "-",
      "사고 유형": a.accident_type,
      차량번호: a.vehicle,
      보고자: a.reporter,
      상태: a.status,
      "크루 보고내용": a.detail || "-",
      "관리자 메모": a.admin_memo || "-",
      "접수 일시": fmt(a.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [20, 14, 12, 14, 10, 8, 30, 30, 20].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "사고보고");
    const now = new Date();
    const periodLabel = PERIOD_OPTIONS.find((p) => p.value === filterPeriod)?.label || "";
    XLSX.writeFile(wb, `사고보고_${periodLabel}_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}.xlsx`);
  };

  const StatusBadge = ({ s }: { s: string }) => {
    const m = STATUS_META[s] || { bg: "#F1F5F9", fg: "#475569" };
    return (
      <span className="v2ac-badge" style={{ background: m.bg, color: m.fg }}>
        {s}
      </span>
    );
  };

  return (
    <div>
      <style>{`
        .v2ac-input { width: 100%; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; background:#fff; }
        .v2ac-input:focus { outline: none; border-color: ${NAVY}; }
        .v2ac-label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
        .v2ac-btn { padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
        .v2ac-btn:disabled { opacity: .5; cursor: not-allowed; }
        .v2ac-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
        .v2ac-card.click { cursor: pointer; transition: box-shadow .15s, border-color .15s; }
        .v2ac-card.click:hover { border-color: ${NAVY}; box-shadow: 0 4px 14px rgba(20,40,160,.10); }
        .v2ac-badge { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; display:inline-block; }
        .v2ac-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index: 60; padding: 16px; }
        .v2ac-modal { background:#fff; border-radius:16px; width:100%; max-width: 600px; max-height: 90vh; overflow:auto; }
        .v2ac-section { border-top: 1px solid #eef2f7; padding: 16px 20px; }
        .v2ac-num { font-family: 'Outfit', system-ui, sans-serif; }
        .v2ac-kpi { display:grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 18px; }
        .v2ac-kgrid { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 12px; }
        @media (max-width: 720px) {
          .v2ac-kpi { grid-template-columns: repeat(2,1fr); }
          .v2ac-kgrid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── 헤더 ── */}
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1D2B", margin: 0 }}>사고보고 관리</h1>
          <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>현장 사고 접수 · 상태 처리 · 사진 · 엑셀</p>
        </div>
        <button className="v2ac-btn" onClick={handleExcel} disabled={filtered.length === 0} style={{ background: "#fff", color: NAVY, border: `1px solid ${NAVY}` }}>
          📊 엑셀 다운로드
        </button>
      </div>

      {/* ── KPI ── */}
      <div className="v2ac-kpi">
        {kpi.map((k) => (
          <div key={k.title} className="v2ac-card" style={{ borderLeft: `4px solid ${k.color}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
              {k.icon} {k.title}
            </div>
            <div className="v2ac-num" style={{ fontSize: 28, fontWeight: 800, color: k.color, marginTop: 4 }}>
              {k.value}
              <span style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", marginLeft: 3 }}>건</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 필터 ── */}
      <div className="v2ac-card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px", minWidth: 140 }}>
          <label className="v2ac-label">매장</label>
          <select className="v2ac-input" value={filterStore} onChange={(e) => setFilterStore(e.target.value)}>
            <option value="">전체 매장</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 130px" }}>
          <label className="v2ac-label">상태</label>
          <select className="v2ac-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">전체</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: "0 0 130px" }}>
          <label className="v2ac-label">기간</label>
          <select className="v2ac-input" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 13, color: "#64748B", paddingBottom: 9 }}>
          총 <b className="v2ac-num" style={{ color: NAVY }}>{filtered.length}</b>건
        </div>
      </div>

      {/* ── 목록 ── */}
      {loading ? (
        <div className="v2ac-card" style={{ textAlign: "center", padding: "50px 20px", color: "#94A3B8" }}>불러오는 중…</div>
      ) : error ? (
        <div className="v2ac-card" style={{ textAlign: "center", color: "#DC2626" }}>
          <div style={{ marginBottom: 10 }}>{error}</div>
          <button className="v2ac-btn" onClick={load} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="v2ac-card" style={{ padding: "50px 20px", textAlign: "center", color: "#94A3B8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
          조건에 맞는 사고보고가 없습니다
        </div>
      ) : (
        <div className="v2ac-kgrid">
          {filtered.map((a) => (
            <div key={a.id} className="v2ac-card click" onClick={() => openDetail(a.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: NAVY }} className="v2ac-num">
                  {a.vehicle}
                </span>
                <StatusBadge s={a.status} />
              </div>
              <div style={{ fontSize: 13, color: "#334155", fontWeight: 600, marginBottom: 4 }}>{a.accident_type}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>🏢 {a.stores?.name || "-"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>🕒 {fmt(a.accident_at)}</div>
              <div style={{ fontSize: 12, color: "#94A3B8" }}>보고자 {a.reporter}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── 상세 모달 ── */}
      {detailId && (
        <div className="v2ac-overlay" onClick={closeDetail}>
          <div className="v2ac-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", borderBottom: "1px solid #eef2f7", zIndex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B" }}>📋 사고보고 상세</div>
              <button onClick={closeDetail} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94A3B8", lineHeight: 1 }}>
                ×
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: "50px 20px", textAlign: "center", color: "#94A3B8" }}>불러오는 중…</div>
            ) : !detail ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#DC2626" }}>{actionErr || "조회 실패"}</div>
            ) : (
              <>
                {/* 기본 정보 */}
                <div className="v2ac-section" style={{ borderTop: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span className="v2ac-num" style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>
                      {detail.vehicle}
                    </span>
                    <StatusBadge s={detail.status} />
                  </div>
                  <InfoRow label="사고 유형" value={detail.accident_type} />
                  <InfoRow label="매장" value={detail.stores?.name || "-"} />
                  <InfoRow label="사고 일시" value={fmt(detail.accident_at)} />
                  <InfoRow label="보고자" value={detail.reporter} />
                  <InfoRow label="접수 일시" value={fmt(detail.created_at)} />
                  {detail.detail && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>크루 보고내용</div>
                      <div style={{ fontSize: 14, color: "#1A1D2B", background: "#F8FAFC", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                        {detail.detail}
                      </div>
                    </div>
                  )}
                </div>

                {/* 상태 변경 */}
                <div className="v2ac-section">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>상태 변경</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {STATUS_LIST.map((s) => {
                      const active = detail.status === s;
                      const m = STATUS_META[s];
                      return (
                        <button
                          key={s}
                          className="v2ac-btn"
                          disabled={busy}
                          onClick={() => changeStatus(s)}
                          style={{
                            flex: 1,
                            background: active ? m.fg : "#fff",
                            color: active ? "#fff" : m.fg,
                            border: `1px solid ${m.fg}`,
                          }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 관리자 메모 */}
                <div className="v2ac-section">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>관리자 메모</div>
                  <textarea
                    className="v2ac-input"
                    rows={3}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="처리 내용·합의 사항 등을 기록하세요"
                    style={{ resize: "vertical" }}
                  />
                  <button className="v2ac-btn" disabled={busy} onClick={saveMemo} style={{ marginTop: 8, background: NAVY, color: "#fff" }}>
                    메모 저장
                  </button>
                </div>

                {/* 사진 */}
                <div className="v2ac-section">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                    📸 사고 사진 ({detail.photos?.length || 0}장)
                  </div>
                  {detail.photos?.length > 0 ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px,1fr))", gap: 8 }}>
                      {detail.photos.map((p: any, i: number) => (
                        <img
                          key={i}
                          src={p.url}
                          alt={`사고사진 ${i + 1}`}
                          onClick={() => setLightbox(p.url)}
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "1px solid #e2e8f0" }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "#94A3B8", padding: "16px 0", textAlign: "center" }}>📷 등록된 사진 없음</div>
                  )}
                </div>

                {/* 액션 메시지 + 삭제 */}
                <div className="v2ac-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, minHeight: 18 }}>
                    {actionMsg && <span style={{ color: "#059669" }}>{actionMsg}</span>}
                    {actionErr && <span style={{ color: "#DC2626" }}>{actionErr}</span>}
                  </div>
                  <button className="v2ac-btn" disabled={busy} onClick={handleDelete} style={{ background: "#fff", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                    🗑️ 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 사진 라이트박스 */}
      {lightbox && (
        <div className="v2ac-overlay" style={{ zIndex: 70, background: "rgba(0,0,0,.8)" }} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="사고사진 확대" style={{ maxWidth: "92vw", maxHeight: "88vh", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", padding: "4px 0", fontSize: 14 }}>
      <span style={{ width: 84, flexShrink: 0, color: "#64748B", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#1A1D2B" }}>{value}</span>
    </div>
  );
}
