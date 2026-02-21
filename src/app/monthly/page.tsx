// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import type { Store } from "@/lib/types/database";

type MonthlyRow = {
  id: string;
  store_id: string;
  vehicle_number: string;
  vehicle_type: string | null;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  monthly_fee: number;
  payment_status: string;
  contract_status: string;
  note: string | null;
  stores: { name: string } | null;
};

export default function MonthlyPage() {
  const supabase = createClient();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [contracts, setContracts] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFilterStore] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [searchText, setSearchText] = useState("");

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { loadContracts(); }, [filterStore, filterStatus]);

  async function loadStores() {
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    let query = supabase.from("stores").select("*").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) query = query.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const { data } = await query;
    if (data) setStores(data);
  }

  async function loadContracts() {
    setLoading(true);
    let query = supabase
      .from("monthly_parking")
      .select("*, stores(name)")
      .order("end_date", { ascending: true });
    if (filterStore) query = query.eq("store_id", filterStore);
    if (filterStatus) query = query.eq("contract_status", filterStatus);
    const { data } = await query;
    if (data) setContracts(data as MonthlyRow[]);
    setLoading(false);
  }

  function getFiltered(): MonthlyRow[] {
    if (!searchText) return contracts;
    const s = searchText.toLowerCase();
    return contracts.filter(
      (c) =>
        c.vehicle_number.toLowerCase().includes(s) ||
        c.customer_name.toLowerCase().includes(s) ||
        c.customer_phone.includes(s)
    );
  }

  function getDaysLeft(endDate: string): number {
    return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  }

  function isExpiringSoon(endDate: string): boolean {
    const diff = getDaysLeft(endDate);
    return diff >= 0 && diff <= 7;
  }

  function badgeStyle(bg: string, color: string) {
    return { padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700 as const, background: bg, color };
  }

  function getContractBadge(row: MonthlyRow) {
    if (row.contract_status === "cancelled") return <span style={badgeStyle("#fee2e2", "#dc2626")}>해지</span>;
    if (row.contract_status === "expired") return <span style={badgeStyle("#f1f5f9", "#475569")}>만료</span>;
    if (isExpiringSoon(row.end_date)) return <span style={badgeStyle("#fff7ed", "#ea580c")}>D-{getDaysLeft(row.end_date)}</span>;
    return <span style={badgeStyle("#ecfdf5", "#10b981")}>계약중</span>;
  }

  function getPaymentBadge(status: string) {
    if (status === "paid") return <span style={badgeStyle("#eff6ff", "#2563eb")}>납부</span>;
    if (status === "unpaid") return <span style={badgeStyle("#fff7ed", "#ea580c")}>미납</span>;
    if (status === "overdue") return <span style={badgeStyle("#fee2e2", "#dc2626")}>연체</span>;
    return null;
  }

  async function cancelContract(id: string) {
    if (!confirm("계약을 해지하시겠습니까?")) return;
    await supabase.from("monthly_parking").update({ contract_status: "cancelled" }).eq("id", id);
    loadContracts();
  }

  const filtered = getFiltered();
  const activeCount = contracts.filter(c => c.contract_status === "active").length;
  const expiringSoon = contracts.filter(c => c.contract_status === "active" && isExpiringSoon(c.end_date));
  const totalFee = contracts.filter(c => c.contract_status === "active").reduce((s, c) => s + c.monthly_fee, 0);

  return (
    <AppLayout>
      <style>{`
        .monthly-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
        .monthly-table-view { display: block; }
        .monthly-card-view { display: none; }
        .m-filter-row { display: flex; align-items: center; gap: 12px; padding: 14px 20px; flex-wrap: wrap; }
        .m-filter-status { display: flex; gap: 4px; background: var(--bg-card); padding: 4px; border-radius: 10px; flex-shrink: 0; }
        .m-filter-store { flex-shrink: 0; }
        .m-search { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 180px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 9px 14px; }
        .m-filter-count { font-size: 13px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
        .monthly-page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .m-contract-card {
          background: #fff; border: 1px solid var(--border-light);
          border-radius: 14px; padding: 16px; transition: all 0.2s;
        }
        .m-contract-card:hover { border-color: var(--navy); box-shadow: var(--shadow-md); }
        .m-contract-card.expiring { background: #fffbeb; border-left: 3px solid #ea580c; }
        .m-meta { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
        .btn-sm { padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 1px solid var(--border); background: #fff; font-family: inherit; }
        .btn-sm.navy { border-color: var(--navy); color: var(--navy); }
        .btn-sm.red { border-color: #fecaca; color: #dc2626; }
        .btn-sm:hover { background: var(--bg-card); }

        @media (max-width: 767px) {
          .monthly-kpi-grid { grid-template-columns: repeat(2,1fr); gap: 10px; }
          .monthly-table-view { display: none; }
          .monthly-card-view { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
          /* 필터: 세로 스택 */
          .m-filter-row { flex-direction: column; align-items: stretch; gap: 10px; padding: 14px 16px; }
          .m-filter-status { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .m-filter-store { width: 100%; }
          .m-filter-store select { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; font-size: 14px; background: #fff; outline: none; font-family: inherit; }
          .m-search { min-width: 0; width: 100%; }
          .m-filter-count { text-align: right; }
          /* 헤더 */
          .monthly-page-header { gap: 10px; }
          .monthly-page-header h2 { font-size: 18px !important; }
          .monthly-page-header button { padding: 9px 16px !important; font-size: 13px !important; }
          /* 카드 내 정보 세로 정렬 */
          .m-card-footer { flex-direction: column !important; gap: 12px !important; align-items: stretch !important; }
          .m-card-footer-actions { justify-content: flex-end; }
        }
      `}</style>

      <div style={{ maxWidth: 1300 }}>

        {/* 헤더 */}
        <div className="monthly-page-header">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 2 }}>월주차 관리</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>월정기 주차 계약 등록 및 현황 관리</p>
          </div>
          <button
            onClick={() => router.push("/monthly/register")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <span>+</span> 월주차 등록
          </button>
        </div>

        {/* KPI */}
        <div className="monthly-kpi-grid">
          {[
            { icon: "📋", label: "전체 계약", value: contracts.length, color: "var(--navy)", bg: "rgba(20,40,160,0.08)", border: "var(--navy)" },
            { icon: "✅", label: "계약 중", value: activeCount, color: "#10b981", bg: "#ecfdf5", border: "#10b981" },
            { icon: "⏰", label: "만료 예정 (7일)", value: expiringSoon.length, color: "#ea580c", bg: "#fff7ed", border: "#ea580c" },
            { icon: "💰", label: "월 계약 매출", value: `₩${(totalFee / 10000).toFixed(0)}만`, color: "var(--gold)", bg: "rgba(245,183,49,0.12)", border: "var(--gold)" },
          ].map((kpi, i) => (
            <div key={i} className="v3-info-card" style={{ borderLeft: `4px solid ${kpi.border}` }}>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{kpi.icon}</div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{kpi.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 만료 예정 배너 */}
        {expiringSoon.length > 0 && (
          <div style={{ background: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "1px solid #fed7aa", borderRadius: 14, padding: "16px 20px", marginBottom: 20, borderLeft: "4px solid #ea580c" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#9a3412", marginBottom: 8 }}>만료 예정 계약 {expiringSoon.length}건 (7일 이내)</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {expiringSoon.map((c) => (
                    <span key={c.id} style={{ fontSize: 12, padding: "4px 12px", background: "#fff", borderRadius: 6, border: "1px solid #fed7aa", color: "#ea580c", fontWeight: 600 }}>
                      {c.stores?.name} · {c.vehicle_number} · D-{getDaysLeft(c.end_date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="v3-info-card" style={{ marginBottom: 20 }}>
          <div className="m-filter-row">
            <div className="m-filter-status">
              {[{v:"active",label:"계약중"},{v:"expired",label:"만료"},{v:"cancelled",label:"해지"},{v:"",label:"전체"}].map(opt => (
                <button key={opt.v} onClick={() => setFilterStatus(opt.v)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: filterStatus === opt.v ? "#fff" : "transparent", color: filterStatus === opt.v ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: filterStatus === opt.v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="m-filter-store">
              <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)} style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "#fff", outline: "none", cursor: "pointer", fontFamily: "inherit", width: "auto" }}>
                <option value="">전체 매장</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="m-search">
              <span style={{ fontSize: 14 }}>🔍</span>
              <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="차량번호, 고객명, 연락처" style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              {searchText && <button onClick={() => setSearchText("")} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>✕</button>}
            </div>
            <span className="m-filter-count">총 {filtered.length}건</span>
          </div>
        </div>

        {/* 목록 */}
        <div className="v3-info-card">
          <div className="v3-info-card-header">
            <div className="v3-info-card-title"><span>📅</span><span>월주차 계약 목록</span></div>
            <span className="v3-info-card-badge">{filterStatus === "active" ? "계약중" : filterStatus === "expired" ? "만료" : filterStatus === "cancelled" ? "해지" : "전체"}</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div><p style={{ fontSize: 14 }}>로딩 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>등록된 계약이 없습니다</p>
              <p style={{ fontSize: 13 }}>월주차 등록 버튼으로 새 계약을 추가하세요</p>
            </div>
          ) : (
            <>
              {/* ─── PC 테이블 ─── */}
              <div className="monthly-table-view" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-card)", borderBottom: "2px solid var(--border)" }}>
                      {["매장","차량번호","고객명","연락처","계약 기간","월 요금","납부","상태","관리"].map(h => (
                        <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, idx) => {
                      const rowBg = isExpiringSoon(c.end_date) && c.contract_status === "active" ? "#fffbeb" : idx % 2 === 0 ? "#fff" : "var(--bg-page)";
                      return (
                        <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)", background: rowBg, transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                          onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                        >
                          <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>{c.stores?.name ?? "-"}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", fontFamily: "monospace, sans-serif" }}>{c.vehicle_number}</span>
                            {c.vehicle_type && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 8px", borderRadius: 5 }}>{c.vehicle_type}</span>}
                          </td>
                          <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>{c.customer_name}</td>
                          <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{c.customer_phone}</td>
                          <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{c.start_date} ~ {c.end_date}</td>
                          <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>₩{c.monthly_fee.toLocaleString()}</td>
                          <td style={{ padding: "14px 16px" }}>{getPaymentBadge(c.payment_status)}</td>
                          <td style={{ padding: "14px 16px" }}>{getContractBadge(c)}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="btn-sm navy" onClick={() => router.push(`/monthly/register?id=${c.id}`)}>수정</button>
                              {c.contract_status === "active" && <button className="btn-sm red" onClick={() => cancelContract(c.id)}>해지</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ─── 모바일 카드 ─── */}
              <div className="monthly-card-view">
                {filtered.map((c) => (
                  <div key={c.id} className={`m-contract-card${isExpiringSoon(c.end_date) && c.contract_status === "active" ? " expiring" : ""}`}>
                    {/* 차량번호 + 상태 뱃지 */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", fontFamily: "monospace" }}>{c.vehicle_number}</span>
                        {c.vehicle_type && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 8px", borderRadius: 5 }}>{c.vehicle_type}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {getPaymentBadge(c.payment_status)}
                        {getContractBadge(c)}
                      </div>
                    </div>
                    {/* 고객 정보 */}
                    <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                      <div><div className="m-meta">고객</div><div style={{ fontSize: 14, fontWeight: 700 }}>{c.customer_name}</div></div>
                      <div><div className="m-meta">연락처</div><div style={{ fontSize: 13 }}>{c.customer_phone}</div></div>
                      <div><div className="m-meta">매장</div><div style={{ fontSize: 13 }}>{c.stores?.name ?? "-"}</div></div>
                    </div>
                    {/* 기간 + 요금 + 버튼 */}
                    <div className="m-card-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border-light)" }}>
                      <div>
                        <div className="m-meta">계약 기간</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{c.start_date} ~ {c.end_date}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="m-meta">월 요금</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>₩{c.monthly_fee.toLocaleString()}</div>
                      </div>
                      <div className="m-card-footer-actions" style={{ display: "flex", gap: 8 }}>
                        <button className="btn-sm navy" onClick={() => router.push(`/monthly/register?id=${c.id}`)}>수정</button>
                        {c.contract_status === "active" && <button className="btn-sm red" onClick={() => cancelContract(c.id)}>해지</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
