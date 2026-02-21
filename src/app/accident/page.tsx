// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";

const styles = `
  .ac-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
    margin-bottom: 24px;
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
    .ac-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .ac-filter-row { gap: 8px; }
    .ac-filter-row select,
    .ac-filter-row input { font-size: 13px !important; }
    .ac-table-wrap { display: none; }
    .ac-mobile-list { display: flex; flex-direction: column; gap: 10px; }
    .ac-detail-modal { padding: 20px 16px; border-radius: 16px; }
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

  // 필터
  const [filterStore, setFilterStore] = useState("all");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [filterPeriod, setFilterPeriod] = useState("month");

  // 상세 모달
  const [selected, setSelected] = useState<any>(null);
  const [memo, setMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);
  const [memoSaved, setMemoSaved] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

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
    // 사진 로드
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
    const supabase = createClient();
    await supabase.from("accident_reports")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id).eq("org_id", ctx.orgId);
    setAccidents(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: newStatus }));
  };

  const handleSaveMemo = async () => {
    if (!selected) return;
    setSavingMemo(true);
    const supabase = createClient();
    const { error } = await supabase.from("accident_reports")
      .update({ admin_memo: memo, updated_at: new Date().toISOString() })
      .eq("id", selected.id).eq("org_id", ctx.orgId);
    setSavingMemo(false);
    if (!error) {
      setMemoSaved(true);
      setAccidents(prev => prev.map(a => a.id === selected.id ? { ...a, admin_memo: memo } : a));
      setTimeout(() => setMemoSaved(false), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 사고보고를 삭제하시겠습니까?")) return;
    const supabase = createClient();
    await supabase.from("accident_reports").delete().eq("id", id).eq("org_id", ctx.orgId);
    setAccidents(prev => prev.filter(a => a.id !== id));
    setSelected(null);
  };

  // 필터 적용
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

  const selStyle = {
    padding: "9px 14px", borderRadius: 9, border: "1px solid #e2e8f0",
    fontSize: 14, color: "#1e293b", background: "#fff", outline: "none", cursor: "pointer",
  } as const;

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

        {/* KPI */}
        <div className="ac-kpi-grid">
          {kpi.map((k, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", border: "1px solid #eef0f3", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 6 }}>{k.icon} {k.title}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="ac-filter-row">
          <select value={filterStore} onChange={e => setFilterStore(e.target.value)} style={selStyle}>
            <option value="all">전체 매장</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} style={selStyle}>
            {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selStyle}>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
            {filtered.length}건
          </div>
        </div>

        {/* 빈 상태 */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #eef0f3", padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>🚨</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26", marginBottom: 6 }}>사고보고 내역이 없습니다</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>크루앱에서 접수된 사고보고가 여기에 표시됩니다</div>
          </div>
        ) : (
          <>
            {/* PC 테이블 */}
            <div className="ac-table-wrap">
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #eef0f3", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fb" }}>
                      {["사고 일시", "매장", "유형", "차량번호", "보고자", "상태", "메모", ""].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#5c6370", borderBottom: "1px solid #eef0f3" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid #eef0f3" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#fafbfd")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "#5c6370" }}>{fmt(a.accident_at)}</td>
                        <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 600 }}>{a.stores?.name || "-"}</td>
                        <td style={{ padding: "13px 16px", fontSize: 13 }}>{a.accident_type}</td>
                        <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 700 }}>{a.vehicle}</td>
                        <td style={{ padding: "13px 16px", fontSize: 13 }}>{a.reporter}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)}
                            className="cursor-pointer"
                            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                              border: "1px solid #e2e8f0",
                              background: STATUS_STYLE[a.status]?.bg,
                              color: STATUS_STYLE[a.status]?.color }}>
                            {["접수", "처리중", "완료"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 12, color: "#94a3b8", maxWidth: 140 }}>
                          {a.admin_memo
                            ? <span style={{ color: "#5c6370" }}>{a.admin_memo.slice(0, 20)}{a.admin_memo.length > 20 ? "…" : ""}</span>
                            : <span style={{ color: "#d1d5db" }}>-</span>}
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <button onClick={() => openDetail(a)} className="cursor-pointer"
                            style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                            상세
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 모바일 카드 */}
            <div className="ac-mobile-list">
              {filtered.map(a => (
                <div key={a.id} onClick={() => openDetail(a)}
                  style={{ background: "#fff", borderRadius: 14, border: "1px solid #eef0f3", padding: "16px", boxShadow: "0 1px 2px rgba(0,0,0,.04)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1d26", marginBottom: 3 }}>{a.vehicle}</div>
                      <div style={{ fontSize: 13, color: "#5c6370" }}>{a.stores?.name || "-"} · {a.accident_type}</div>
                    </div>
                    <span style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: STATUS_STYLE[a.status]?.bg, color: STATUS_STYLE[a.status]?.color }}>
                      {a.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #eef0f3", fontSize: 12, color: "#94a3b8" }}>
                    <span>보고자: <b style={{ color: "#5c6370" }}>{a.reporter}</b></span>
                    <span>{fmt(a.accident_at).slice(0, 13)}</span>
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
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1a1d26" }}>📋 사고보고 상세</div>
              <button onClick={() => setSelected(null)} className="cursor-pointer"
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 13, fontWeight: 600 }}>✕ 닫기</button>
            </div>

            {/* 상태 변경 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["접수", "처리중", "완료"].map(s => (
                <button key={s} onClick={() => handleStatusChange(selected.id, s)}
                  className="cursor-pointer"
                  style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid",
                    borderColor: selected.status === s ? STATUS_STYLE[s]?.color : "#e2e8f0",
                    background: selected.status === s ? STATUS_STYLE[s]?.bg : "#fff",
                    color: selected.status === s ? STATUS_STYLE[s]?.color : "#94a3b8",
                    fontSize: 13, fontWeight: 700, transition: "all .15s" }}>
                  {s}
                </button>
              ))}
            </div>

            {/* 기본 정보 */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
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
                  <div style={{ width: 100, fontSize: 13, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>{l}</div>
                  <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* 사고 상세내용 (크루 입력) */}
            {selected.detail && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5c6370", marginBottom: 8 }}>📝 크루 보고 내용</div>
                <div style={{ fontSize: 13, color: "#1e293b", lineHeight: 1.7, padding: "12px 14px", background: "#fff5f5", borderRadius: 10, border: "1px solid #fee2e2" }}>
                  {selected.detail}
                </div>
              </div>
            )}

            {/* 사진 */}
            {photos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#5c6370", marginBottom: 8 }}>📸 사고 사진 ({photos.length}장)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`사고사진 ${i + 1}`}
                        style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {photos.length === 0 && (
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>
                📷 등록된 사진 없음
              </div>
            )}

            {/* 관리자 메모 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#5c6370", marginBottom: 8 }}>🗒 관리자 메모 (처리 내용 기록)</div>
              <textarea rows={4} value={memo} onChange={e => setMemo(e.target.value)}
                placeholder="보험 접수 여부, 합의 내용, 처리 경위 등 내부 메모를 입력하세요..."
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0",
                  fontSize: 13, color: "#1e293b", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
              <button onClick={handleSaveMemo} disabled={savingMemo} className="cursor-pointer"
                style={{ marginTop: 8, width: "100%", padding: "11px", borderRadius: 10, border: "none",
                  background: memoSaved ? "#16a34a" : "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700,
                  transition: "background .2s" }}>
                {savingMemo ? "저장 중..." : memoSaved ? "✅ 저장 완료!" : "메모 저장"}
              </button>
            </div>

            {/* 삭제 */}
            <button onClick={() => handleDelete(selected.id)} className="cursor-pointer"
              style={{ width: "100%", padding: "11px", borderRadius: 10, border: "1px solid #fee2e2",
                background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
              🗑 사고보고 삭제
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
