// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { showToast } from "@/lib/utils/toast";
import * as XLSX from "xlsx";

const styles = `
  .ac-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 24px;
  }
  .ac-kpi-card {
    background: #fff;
    border-radius: 14px;
    padding: 18px 20px;
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  .ac-kpi-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ac-kpi-value {
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
  }
  .ac-filter-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    align-items: center;
  }
  .ac-table-wrap { display: block; }
  .ac-mobile-list { display: none; }

  /* 모바일 카드 v3 */
  .ac-mob-card {
    background: #fff;
    border-radius: 20px;
    border: none;
    padding: 16px;
    box-shadow: 0 2px 12px rgba(20,40,160,0.08);
    cursor: pointer;
    transition: all 0.2s;
  }
  .ac-mob-card:hover { border-color: var(--navy); box-shadow: var(--shadow-md); }
  .ac-mob-card:active { transform: scale(0.99); }

  .ac-mob-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .ac-mob-vehicle {
    font-size: 17px;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 3px;
  }
  .ac-mob-sub {
    font-size: 13px;
    color: var(--text-secondary);
  }
  .ac-mob-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
    font-size: 12px;
    color: var(--text-muted);
  }
  .ac-mob-reporter {
    font-weight: 600;
    color: var(--text-secondary);
  }
  .ac-mob-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    background: #f1f5f9;
    color: #475569;
    margin-bottom: 8px;
  }
  .ac-mob-memo {
    font-size: 12px;
    color: var(--text-muted);
    background: var(--bg-card);
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 8px;
    line-height: 1.5;
  }

  .ac-sel {
    padding: 9px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-size: 14px;
    color: var(--text-primary);
    background: #fff;
    outline: none;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .ac-sel:hover, .ac-sel:focus { border-color: var(--navy); }

  .ac-detail-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px;
  }
  .ac-detail-modal {
    background: #fff; border-radius: 20px;
    width: 100%; max-width: 560px; max-height: 90vh;
    overflow-y: auto; padding: 28px;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
  }

  @media (max-width: 767px) {
    .ac-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 16px; }
    .ac-kpi-card { padding: 14px 16px; }
    .ac-kpi-value { font-size: 24px; }
    .ac-filter-row { gap: 8px; flex-direction: column; align-items: stretch; }
    .ac-filter-row .ac-filter-row-inner {
      display: flex; gap: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .ac-sel { width: 100%; padding: 11px 14px; font-size: 14px; }
    .ac-table-wrap { display: none; }
    .ac-mobile-list { display: flex; flex-direction: column; gap: 10px; padding: 4px 0; }
    .ac-detail-modal { padding: 20px 16px; border-radius: 16px; }
    .ac-filter-excel { display: none !important; }
  }
`;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "접수":   { bg: "#eff6ff", color: "#3b82f6" },
  "처리중": { bg: "#fffbeb", color: "#f59e0b" },
  "완료":   { bg: "#ecfdf5", color: "#10b981" },
};

const STATUS_LIST = ["전체", "접수", "처리중", "완료"];

const PERIOD_OPTIONS = [
  { label: "전체", value: "all" },
  { label: "이번 달", value: "month" },
  { label: "지난 3개월", value: "3month" },
  { label: "올해", value: "year" },
];

export default function AccidentPage() {
  const [accidents, setAccidents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<any>(null);

  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterPeriod, setFilterPeriod] = useState("month");

  const [selected, setSelected] = useState<any>(null);
  const [memo, setMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoSaved, setMemoSaved] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showExcelMenu, setShowExcelMenu] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const c = await getUserContext();
    setCtx(c);
    await Promise.all([loadStores(c), loadAccidents(c)]);
    setLoading(false);
  };

  const loadStores = async (c: any) => {
    const supabase = createClient();
    if (!c?.orgId) return;
    let q = supabase.from("stores").select("id, name").eq("org_id", c.orgId).eq("is_active", true).order("name");
    if (!c.allStores && c.storeIds?.length > 0) q = q.in("id", c.storeIds);
    const { data } = await q;
    if (data) setStores(data);
  };

  const loadAccidents = async (c: any) => {
    const supabase = createClient();
    if (!c?.orgId) return;
    let q = supabase
      .from("accident_reports")
      .select("*, stores(name)")
      .eq("org_id", c.orgId)
      .order("accident_at", { ascending: false });
    if (!c.allStores && c.storeIds?.length > 0) q = q.in("store_id", c.storeIds);
    const { data } = await q;
    if (data) setAccidents(data);
  };

  const openDetail = async (a: any) => {
    setSelected(a);
    setMemo(a.admin_memo || "");
    setMemoSaved(false);
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("accident-photos")
      .list(`${a.id}/`, { limit: 10 });
    if (data && data.length > 0) {
      const urls = data.map((f: any) => {
        const { data: urlData } = supabase.storage
          .from("accident-photos")
          .getPublicUrl(`${a.id}/${f.name}`);
        return urlData.publicUrl;
      });
      setPhotos(urls);
    } else {
      setPhotos([]);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!ctx?.orgId) return;
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId);
    if (error) { alert("상태 변경 실패: " + error.message); return; }
    setAccidents(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: newStatus }));
    showToast("✅ 상태가 변경되었습니다");
  };

  const handleSaveMemo = async () => {
    if (!selected || !ctx?.orgId) return;
    setSavingMemo(true);
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports")
      .update({ admin_memo: memo, updated_at: new Date().toISOString() })
      .eq("id", selected.id).eq("org_id", ctx.orgId);
    setSavingMemo(false);
    if (error) { alert("메모 저장 실패: " + error.message); return; }
    setMemoSaved(true);
    setAccidents(prev => prev.map(a => a.id === selected.id ? { ...a, admin_memo: memo } : a));
    setTimeout(() => setMemoSaved(false), 2000);
    showToast("✅ 메모가 저장되었습니다");
  };

  const handleExcelDownload = (mode: "current" | "monthly") => {
    const now = new Date();
    if (mode === "monthly") {
      const wb = XLSX.utils.book_new();
      const monthMap: Record<string, any[]> = {};
      accidents.forEach(a => {
        const d = new Date(a.accident_at);
        const key = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월`;
        if (!monthMap[key]) monthMap[key] = [];
        monthMap[key].push(a);
      });
      Object.entries(monthMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([month, rows]) => {
          const sheetData = rows.map(a => ({
            "사고 일시": fmt(a.accident_at),
            "매장": a.stores?.name || "-",
            "사고 유형": a.accident_type,
            "차량번호": a.vehicle,
            "차주 연락처": a.phone || "-",
            "보고자": a.reporter,
            "상태": a.status,
            "크루 보고내용": a.detail || "-",
            "관리자 메모": a.admin_memo || "-",
            "접수 일시": fmt(a.created_at),
          }));
          const ws = XLSX.utils.json_to_sheet(sheetData);
          ws["!cols"] = [20, 12, 12, 14, 16, 10, 8, 30, 30, 20].map(w => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, month);
        });
      XLSX.writeFile(wb, `사고보고_월별_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}.xlsx`);
    } else {
      const data = filtered.map(a => ({
        "사고 일시": fmt(a.accident_at),
        "매장": a.stores?.name || "-",
        "사고 유형": a.accident_type,
        "차량번호": a.vehicle,
        "차주 연락처": a.phone || "-",
        "보고자": a.reporter,
        "상태": a.status,
        "크루 보고내용": a.detail || "-",
        "관리자 메모": a.admin_memo || "-",
        "접수 일시": fmt(a.created_at),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [20, 12, 12, 14, 16, 10, 8, 30, 30, 20].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "사고보고");
      const periodLabel = PERIOD_OPTIONS.find(p => p.value === filterPeriod)?.label || "";
      XLSX.writeFile(wb, `사고보고_${periodLabel}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}.xlsx`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!ctx?.orgId) return;
    if (!confirm("이 사고보고를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports").delete().eq("id", id).eq("org_id", ctx.orgId);
    if (error) { alert("삭제 실패: " + error.message); return; }
    setAccidents(prev => prev.filter(a => a.id !== id));
    setSelected(null);
    showToast("🗑️ 사고보고가 삭제되었습니다");
  };

  const filtered = accidents.filter(a => {
    if (filterStore !== "all" && a.store_id !== filterStore) return false;
    if (filterStatus !== "전체" && a.status !== filterStatus) return false;
    if (filterPeriod !== "all") {
      const d = new Date(a.accident_at);
      const now = new Date();
      if (filterPeriod === "month") {
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      } else if (filterPeriod === "3month") {
        const limit = new Date(); limit.setMonth(limit.getMonth() - 3);
        if (d < limit) return false;
      } else if (filterPeriod === "year") {
        if (d.getFullYear() !== now.getFullYear()) return false;
      }
    }
    return true;
  });

  const now = new Date();
  const thisMonth = accidents.filter(a => {
    const d = new Date(a.accident_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const kpi = [
    { title: "이번 달 사고", value: `${thisMonth.length}건`, color: "#dc2626", icon: "🚨" },
    { title: "접수", value: `${accidents.filter(a => a.status === "접수").length}건`, color: "#3b82f6", icon: "📥" },
    { title: "처리중", value: `${accidents.filter(a => a.status === "처리중").length}건`, color: "#f59e0b", icon: "⏳" },
    { title: "완료", value: `${accidents.filter(a => a.status === "완료").length}건`, color: "#10b981", icon: "✅" },
  ];

  const fmt = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const fmtDate = (d: string) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
  };

  const fmtTime = (d: string) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, fontSize: 15, color: "#94a3b8" }}>
        데이터 불러오는 중...
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <style>{styles}</style>
      <div className="max-w-6xl mx-auto">

        {/* 페이지 헤더 (PC) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>사고보고</h2>
        </div>

        {/* 크루앱 연동 안내 배너 */}
        <div style={{
          background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
          border: "1px solid #86efac", borderRadius: 14,
          padding: "14px 18px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: "#10b981",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, flexShrink: 0,
            }}>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#065f46", marginBottom: 3 }}>
                크루앱 사고보고 연동 완료
              </div>
              <div style={{ fontSize: 13, color: "#047857", lineHeight: 1.5 }}>
                현장 크루가 크루앱 → 사고보고 메뉴에서 접수합니다. 어드민은 접수된 내역의 상태 관리 및 메모를 작성할 수 있습니다.
              </div>
            </div>
            <div style={{
              padding: "5px 12px", borderRadius: 8,
              background: "#10b981", color: "#fff",
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              ✓ 연동 완료
            </div>
          </div>
        </div>
        {/* 크루앱 예정 기능 배너 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)",
          border: "1px solid #c7d2fe", borderRadius: 14,
          padding: "12px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>🛠️</div>
          <div style={{ flex: 1, fontSize: 13, color: "#4338ca", lineHeight: 1.5 }}>
            <strong>크루앱 예정:</strong> 접수 이력 조회 · 보고 내역 수정/삭제 기능 추가 예정
          </div>
          <div style={{
            padding: "4px 10px", borderRadius: 6,
            background: "#e0e7ff", color: "#4338ca",
            fontSize: 11, fontWeight: 700, flexShrink: 0, border: "1px solid #c7d2fe",
          }}>
            예정
          </div>
        </div>

        {/* KPI */}
        <div className="ac-kpi-grid">
          {kpi.map((k, i) => (
            <div key={i} className="ac-kpi-card">
              <div className="ac-kpi-label">{k.icon} {k.title}</div>
              <div className="ac-kpi-value" style={{ color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="ac-filter-row">
          {/* 모바일: 세로 스택 / PC: 가로 */}
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="ac-sel">
            <option value="all">전체 매장</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="ac-sel">
            {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="ac-sel">
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="ac-filter-excel" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>{filtered.length}건</div>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowExcelMenu(v => !v)}
                className="cursor-pointer"
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9,
                  border: "1px solid #16a34a", background: "#f0fdf4", color: "#16a34a", fontSize: 13, fontWeight: 700 }}>
                📥 엑셀 다운 ▾
              </button>
              {showExcelMenu && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowExcelMenu(false)} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff",
                    borderRadius: 10, border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,.1)",
                    zIndex: 100, minWidth: 200, overflow: "hidden" }}>
                    <button onClick={() => { handleExcelDownload("current"); setShowExcelMenu(false); }}
                      className="cursor-pointer"
                      style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
                        fontSize: 13, fontWeight: 600, color: "var(--text-primary)", border: "none", background: "none",
                        borderBottom: "1px solid #f1f5f9" }}>
                      📄 현재 필터 결과 다운로드
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>선택한 조건 기준 ({filtered.length}건)</div>
                    </button>
                    <button onClick={() => { handleExcelDownload("monthly"); setShowExcelMenu(false); }}
                      className="cursor-pointer"
                      style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
                        fontSize: 13, fontWeight: 600, color: "var(--text-primary)", border: "none", background: "none" }}>
                      📊 월별 보고서 (시트 분리)
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>전체 이력을 월별 시트로 분리</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 빈 상태 */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>사고보고 내역이 없습니다</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>크루앱에서 접수된 사고보고가 여기에 실시간으로 표시됩니다</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 10,
              background: "#ecfdf5", border: "1px solid #86efac",
              fontSize: 13, color: "#065f46", fontWeight: 600,
            }}>
              📱 크루앱 → 사고보고 메뉴에서 접수 가능
            </div>
          </div>
        ) : (
          <>
            {/* PC 테이블 */}
            <div className="ac-table-wrap">
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid var(--border-light)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fb" }}>
                      {["사고 일시", "매장", "유형", "차량번호", "보고자", "상태", "메모", ""].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border-light)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--border-light)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafbfd")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{fmt(a.accident_at)}</td>
                        <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 600 }}>{a.stores?.name || "-"}</td>
                        <td style={{ padding: "13px 16px", fontSize: 13 }}>{a.accident_type}</td>
                        <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 700 }}>{a.vehicle}</td>
                        <td style={{ padding: "13px 16px", fontSize: 13 }}>{a.reporter}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)}
                            className="cursor-pointer"
                            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                              border: "1px solid var(--border)",
                              background: STATUS_STYLE[a.status]?.bg,
                              color: STATUS_STYLE[a.status]?.color }}>
                            {["접수", "처리중", "완료"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-muted)", maxWidth: 140 }}>
                          {a.admin_memo
                            ? <span style={{ color: "var(--text-secondary)" }}>{a.admin_memo.slice(0, 20)}{a.admin_memo.length > 20 ? "…" : ""}</span>
                            : <span style={{ color: "#d1d5db" }}>-</span>}
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <button onClick={() => openDetail(a)} className="cursor-pointer"
                            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "#fff", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                            상세
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 모바일 카드 리스트 v3 ── */}
            <div className="ac-mobile-list">
              {/* 건수 + 엑셀 (모바일 전용 상단 바) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px 4px" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{filtered.length}건</span>
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowExcelMenu(v => !v)} className="cursor-pointer"
                    style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #16a34a",
                      background: "#f0fdf4", color: "#16a34a", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    📥 엑셀 ▾
                  </button>
                  {showExcelMenu && (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowExcelMenu(false)} />
                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff",
                        borderRadius: 10, border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,.1)",
                        zIndex: 100, minWidth: 190, overflow: "hidden" }}>
                        <button onClick={() => { handleExcelDownload("current"); setShowExcelMenu(false); }}
                          className="cursor-pointer"
                          style={{ display: "block", width: "100%", padding: "11px 14px", textAlign: "left",
                            fontSize: 13, fontWeight: 600, color: "var(--text-primary)", border: "none", background: "none",
                            borderBottom: "1px solid #f1f5f9" }}>
                          📄 현재 필터 결과
                        </button>
                        <button onClick={() => { handleExcelDownload("monthly"); setShowExcelMenu(false); }}
                          className="cursor-pointer"
                          style={{ display: "block", width: "100%", padding: "11px 14px", textAlign: "left",
                            fontSize: 13, fontWeight: 600, color: "var(--text-primary)", border: "none", background: "none" }}>
                          📊 월별 보고서
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {filtered.map(a => (
                <div key={a.id} className="ac-mob-card" onClick={() => openDetail(a)}>
                  {/* 상단: 차량번호 + 상태뱃지 */}
                  <div className="ac-mob-card-header">
                    <div>
                      <div className="ac-mob-vehicle">{a.vehicle}</div>
                      <div className="ac-mob-sub">{a.stores?.name || "-"}</div>
                    </div>
                    <span style={{
                      padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color,
                      flexShrink: 0
                    }}>
                      {a.status}
                    </span>
                  </div>

                  {/* 중단: 사고 유형 뱃지 */}
                  <div className="ac-mob-type-badge">
                    🔖 {a.accident_type}
                  </div>

                  {/* 관리자 메모 (있을 때만) */}
                  {a.admin_memo && (
                    <div className="ac-mob-memo">
                      🗒 {a.admin_memo.slice(0, 50)}{a.admin_memo.length > 50 ? "…" : ""}
                    </div>
                  )}

                  {/* 하단: 보고자 + 날짜시간 */}
                  <div className="ac-mob-footer">
                    <span>보고자 <span className="ac-mob-reporter">{a.reporter}</span></span>
                    <span>{fmtDate(a.accident_at)} {fmtTime(a.accident_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="ac-detail-overlay" onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="ac-detail-modal">
            {/* 헤더 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>📋 사고보고 상세</div>
              <button onClick={() => setSelected(null)} className="cursor-pointer"
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 13, fontWeight: 600 }}>✕ 닫기</button>
            </div>

            {/* 상태 변경 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["접수", "처리중", "완료"].map(s => (
                <button key={s} onClick={() => handleStatusChange(selected.id, s)}
                  className="cursor-pointer"
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid",
                    borderColor: selected.status === s ? STATUS_STYLE[s]?.color : "var(--border)",
                    background: selected.status === s ? STATUS_STYLE[s]?.bg : "#fff",
                    color: selected.status === s ? STATUS_STYLE[s]?.color : "var(--text-muted)",
                    fontSize: 13, fontWeight: 700, transition: "all .15s" }}>
                  {s}
                </button>
              ))}
            </div>

            {/* 기본 정보 */}
            <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
              {[
                ["매장", selected.stores?.name || "-"],
                ["사고 유형", selected.accident_type],
                ["차량번호", selected.vehicle],
                ["차주 연락처", selected.phone || "-"],
                ["보고자", selected.reporter],
                ["사고 일시", fmt(selected.accident_at)],
                ["접수 일시", fmt(selected.created_at)],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", marginBottom: 10 }}>
                  <div style={{ width: 100, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>{l}</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* 크루 보고 내용 */}
            {selected.detail && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>📝 크루 보고 내용</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7, padding: "12px 14px", background: "#fff5f5", borderRadius: 10, border: "1px solid #fee2e2" }}>
                  {selected.detail}
                </div>
              </div>
            )}

            {/* 사진 */}
            {photos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>📸 사고 사진 ({photos.length}장)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`사고사진 ${i + 1}`}
                        style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {photos.length === 0 && (
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--bg-card)", borderRadius: 10, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                📷 등록된 사진 없음
              </div>
            )}

            {/* 관리자 메모 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>🗒 관리자 메모 (처리 내용 기록)</div>
              <textarea rows={4} value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="보험 접수 여부, 합의 내용, 처리 경위 등 내부 메모를 입력하세요..."
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)",
                  fontSize: 13, color: "var(--text-primary)", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit" }} />
              <button onClick={handleSaveMemo} disabled={savingMemo} className="cursor-pointer"
                style={{ marginTop: 8, width: "100%", padding: "11px", borderRadius: 10, border: "none",
                  background: memoSaved ? "#16a34a" : "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700,
                  transition: "background .2s", fontFamily: "inherit" }}>
                {savingMemo ? "저장 중..." : memoSaved ? "✅ 저장 완료!" : "메모 저장"}
              </button>
            </div>

            {/* 삭제 */}
            <button onClick={() => handleDelete(selected.id)} className="cursor-pointer"
              style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid #fee2e2",
                background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
              🗑 사고보고 삭제
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
