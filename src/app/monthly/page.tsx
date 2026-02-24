// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { showToast } from "@/lib/utils/toast";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import type { Store } from "@/lib/types/database";

type MonthlyRow = {
  id: string;
  org_id: string;
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
  d7_alimtalk_sent?: boolean;
  d7_alimtalk_sent_at?: string | null;
  stores: { name: string } | null;
};

type AlimtalkModal = {
  open: boolean;
  contract: MonthlyRow | null;
  sending: boolean;
  sent: boolean;
  error: string;
};

type RenewModal = {
  open: boolean;
  contract: MonthlyRow | null;
  months: number;
  customEnd: string;
  newFee: number;
  saving: boolean;
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
  const [alimModal, setAlimModal] = useState<AlimtalkModal>({ open: false, contract: null, sending: false, sent: false, error: "" });
  const [renewModal, setRenewModal] = useState<RenewModal>({ open: false, contract: null, months: 1, customEnd: "", newFee: 0, saving: false });

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
    const ctx = await getUserContext();
    if (!ctx.orgId) { setLoading(false); return; }

    // 만료일이 지난 active 계약 자동 expired 처리
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("monthly_parking")
      .update({ contract_status: "expired" })
      .eq("contract_status", "active")
      .eq("org_id", ctx.orgId)
      .lt("end_date", today);

    let query = supabase
      .from("monthly_parking")
      .select("*, stores(name)")
      .eq("org_id", ctx.orgId)
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
    const { error } = await supabase.from("monthly_parking").update({ contract_status: "cancelled" }).eq("id", id);
    if (error) { alert("해지 실패: " + error.message); return; }
    showToast("✅ 계약이 해지되었습니다");
    loadContracts();
  }

  function openAlimModal(c: MonthlyRow) {
    setAlimModal({ open: true, contract: c, sending: false, sent: false, error: "" });
  }

  function closeAlimModal() {
    setAlimModal(m => ({ ...m, open: false }));
  }

  function openRenewModal(c: MonthlyRow) {
    const newEnd = calcRenewEnd(c.end_date, 1);
    setRenewModal({ open: true, contract: c, months: 1, customEnd: newEnd, newFee: c.monthly_fee, saving: false });
  }

  function calcRenewEnd(baseEnd: string, months: number): string {
    const base = new Date(baseEnd < new Date().toISOString().slice(0,10) ? new Date().toISOString().slice(0,10) : baseEnd);
    base.setMonth(base.getMonth() + months);
    base.setDate(base.getDate() - 1);
    return base.toISOString().slice(0, 10);
  }

  function handleRenewMonths(months: number) {
    if (!renewModal.contract) return;
    const newEnd = calcRenewEnd(renewModal.contract.end_date, months);
    setRenewModal(m => ({ ...m, months, customEnd: newEnd }));
  }

  async function saveRenew() {
    const c = renewModal.contract;
    if (!c || !renewModal.customEnd) return;
    setRenewModal(m => ({ ...m, saving: true }));
    const today = new Date().toISOString().slice(0, 10);
    const newStart = c.end_date < today ? today : c.end_date;
    const { error } = await supabase.from("monthly_parking").update({
      start_date: newStart,
      end_date: renewModal.customEnd,
      monthly_fee: renewModal.newFee,
      contract_status: "active",
      payment_status: "unpaid",
    }).eq("id", c.id);
    if (error) { alert("갱신 실패: " + error.message); setRenewModal(m => ({ ...m, saving: false })); return; }
    showToast("✅ 계약이 갱신되었습니다");
    setRenewModal(m => ({ ...m, open: false, saving: false }));
    loadContracts();
  }

  async function sendAlimtalk() {
    const c = alimModal.contract;
    if (!c) return;
    setAlimModal(m => ({ ...m, sending: true, error: "" }));
    try {
      const res = await fetch("/api/alimtalk/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: c.customer_phone,
          customerName: c.customer_name,
          vehicleNumber: c.vehicle_number,
          storeName: c.stores?.name ?? "",
          endDate: c.end_date,
          fee: c.monthly_fee,
          templateType: "renewal_remind",
          contractId: c.id,
          orgId: c.org_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAlimModal(m => ({ ...m, sending: false, sent: true }));
        loadContracts(); // 발송 후 목록 새로고침
      } else {
        setAlimModal(m => ({ ...m, sending: false, error: data.error || "발송 실패" }));
      }
    } catch {
      setAlimModal(m => ({ ...m, sending: false, error: "네트워크 오류" }));
    }
  }

  const filtered = getFiltered();
  const activeCount = contracts.filter(c => c.contract_status === "active").length;
  const expiringSoon = contracts.filter(c => c.contract_status === "active" && isExpiringSoon(c.end_date));
  const totalFee = contracts.filter(c => c.contract_status === "active").reduce((s, c) => s + c.monthly_fee, 0);

  // 최근 30일 내 만료된 계약 (갱신 독려 대상)
  const recentlyExpired = contracts.filter(c => {
    if (c.contract_status !== "expired") return false;
    const daysSince = Math.abs(getDaysLeft(c.end_date));
    return daysSince <= 30;
  });

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
        {expiringSoon.length > 0 && (() => {
          const urgent = expiringSoon.filter(c => getDaysLeft(c.end_date) <= 3);
          const isUrgent = urgent.length > 0;
          return (
            <div style={{
              background: isUrgent ? "linear-gradient(135deg,#fef2f2,#fee2e2)" : "linear-gradient(135deg,#fff7ed,#ffedd5)",
              border: `1px solid ${isUrgent ? "#fecaca" : "#fed7aa"}`,
              borderLeft: `4px solid ${isUrgent ? "#dc2626" : "#ea580c"}`,
              borderRadius: 14, padding: "18px 20px", marginBottom: 20
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{isUrgent ? "🚨" : "⚠️"}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: isUrgent ? "#991b1b" : "#9a3412" }}>
                    {isUrgent
                      ? `긴급! D-3 이하 ${urgent.length}건 포함 · 만료 임박 총 ${expiringSoon.length}건`
                      : `만료 예정 ${expiringSoon.length}건 (7일 이내) · 알림톡을 보내 연장을 유도하세요`
                    }
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expiringSoon
                  .sort((a, b) => getDaysLeft(a.end_date) - getDaysLeft(b.end_date))
                  .map((c) => {
                    const days = getDaysLeft(c.end_date);
                    const isD3 = days <= 3;
                    return (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: isD3 ? "#fff5f5" : "#fff",
                        border: `1px solid ${isD3 ? "#fecaca" : "#fed7aa"}`,
                        borderRadius: 10, padding: "10px 14px", flexWrap: "wrap", gap: 8
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
                            background: isD3 ? "#dc2626" : "#ea580c", color: "#fff"
                          }}>D-{days}</span>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#1428A0", fontFamily: "monospace" }}>{c.vehicle_number}</span>
                          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{c.customer_name}</span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{c.stores?.name}</span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{c.end_date} 만료</span>
                        </div>
                        <button
                          onClick={() => openAlimModal(c)}
                          style={{
                            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            background: isD3 ? "#dc2626" : "#ea580c", color: "#fff",
                            display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
                          }}>
                          📨 알림톡 발송
                        </button>
                        {c.d7_alimtalk_sent && (
                          <span style={{
                            padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "#ecfdf5", color: "#059669", whiteSpace: "nowrap"
                          }}>
                            ✓ D-7 발송됨
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })()}

        {/* 만료 계약 배너 */}
        {recentlyExpired.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg,#f8f9fb,#f1f5f9)",
            border: "1px solid #cbd5e1",
            borderLeft: "4px solid #64748b",
            borderRadius: 14, padding: "18px 20px", marginBottom: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#334155" }}>
                  최근 30일 내 만료 {recentlyExpired.length}건 · 갱신 연락이 필요합니다
                </span>
              </div>
              <button
                onClick={() => setFilterStatus("expired")}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #94a3b8", background: "#fff", color: "#475569", cursor: "pointer", fontFamily: "inherit" }}
              >
                만료 탭으로 보기 →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentlyExpired
                .sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
                .slice(0, 5)
                .map((c) => {
                  const daysSince = Math.abs(getDaysLeft(c.end_date));
                  return (
                    <div key={c.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 10, padding: "10px 14px", flexWrap: "wrap", gap: 8
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 6,
                          background: "#f1f5f9", color: "#64748b"
                        }}>만료 {daysSince}일</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#1428A0", fontFamily: "monospace" }}>{c.vehicle_number}</span>
                        <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{c.customer_name}</span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{c.stores?.name}</span>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{c.end_date} 만료</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => openAlimModal(c)}
                          style={{
                            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "1px solid #c7d2fe", cursor: "pointer", fontFamily: "inherit",
                            background: "#eef2ff", color: "#4f46e5",
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                          }}>
                          📨 알림톡
                        </button>
                        <button
                          onClick={() => openRenewModal(c)}
                          style={{
                            padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            background: "#10b981", color: "#fff",
                            display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                          }}>
                          🔄 갱신
                        </button>
                      </div>
                    </div>
                  );
                })}
              {recentlyExpired.length > 5 && (
                <button
                  onClick={() => setFilterStatus("expired")}
                  style={{ padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 700, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}
                >
                  +{recentlyExpired.length - 5}건 더보기
                </button>
              )}
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
                            <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
                              <button className="btn-sm navy" onClick={() => router.push(`/monthly/register?id=${c.id}`)}>수정</button>
                              {c.contract_status === "active" && (
                                <button className="btn-sm" style={{ borderColor: "#7c3aed", color: "#7c3aed" }} onClick={() => openAlimModal(c)}>📨 알림톡</button>
                              )}
                              {c.contract_status === "expired" && (
                                <button className="btn-sm" style={{ borderColor: "#10b981", color: "#10b981", background: "#ecfdf5" }} onClick={() => openRenewModal(c)}>🔄 갱신</button>
                              )}
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
                        {c.contract_status === "active" && (
                          <button className="btn-sm" style={{ borderColor: "#7c3aed", color: "#7c3aed" }} onClick={() => openAlimModal(c)}>📨</button>
                        )}
                        {c.contract_status === "expired" && (
                          <button className="btn-sm" style={{ borderColor: "#10b981", color: "#10b981", background: "#ecfdf5" }} onClick={() => openRenewModal(c)}>🔄 갱신</button>
                        )}
                        {c.contract_status === "active" && <button className="btn-sm red" onClick={() => cancelContract(c.id)}>해지</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── 알림톡 발송 모달 ─── */}
        {alimModal.open && alimModal.contract && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={closeAlimModal}>
            <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
              {/* 모달 헤더 */}
              <div style={{ background: "linear-gradient(135deg, #1a237e, #0d1442)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#F5B731", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>카카오 알림톡</div>
                  <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>월주차 연장 안내 발송</div>
                </div>
                <button onClick={closeAlimModal} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>

              <div style={{ padding: "20px 24px" }}>
                {/* 수신자 정보 */}
                <div style={{ background: "#f8f9fb", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "#8b919d", fontWeight: 600, marginBottom: 8 }}>수신자 정보</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div><div style={{ fontSize: 11, color: "#8b919d" }}>고객명</div><div style={{ fontSize: 14, fontWeight: 700 }}>{alimModal.contract.customer_name}</div></div>
                    <div><div style={{ fontSize: 11, color: "#8b919d" }}>연락처</div><div style={{ fontSize: 14, fontWeight: 700 }}>{alimModal.contract.customer_phone}</div></div>
                    <div><div style={{ fontSize: 11, color: "#8b919d" }}>차량번호</div><div style={{ fontSize: 14, fontWeight: 700, color: "#1428A0" }}>{alimModal.contract.vehicle_number}</div></div>
                  </div>
                </div>

                {/* 알림톡 미리보기 */}
                <div style={{ border: "1px solid #e2e4e9", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ background: "#FEE500", padding: "10px 14px", fontSize: 12, fontWeight: 700, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>💬</span> 카카오 알림톡 미리보기
                  </div>
                  <div style={{ padding: "16px", background: "#fff", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.8, whiteSpace: "pre-line" }}>
{`[미팍 월주차 안내]

안녕하세요, ${alimModal.contract.customer_name}님! 🚗

${alimModal.contract.stores?.name ?? ""} 월주차 계약 만료가 임박했습니다.

📋 계약 정보
• 차량번호: ${alimModal.contract.vehicle_number}
• 계약기간: ${alimModal.contract.start_date} ~ ${alimModal.contract.end_date}
• 월 요금: ${alimModal.contract.monthly_fee.toLocaleString()}원

만기일 이후에는 일반 주차 요금이 부과됩니다.
연장을 원하시면 매장으로 연락해 주세요 😊`}
                    </div>

                  </div>
                </div>

                {/* 에러/성공 메시지 */}
                {alimModal.error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>
                    ⚠️ {alimModal.error}
                  </div>
                )}
                {alimModal.sent && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#10b981", marginBottom: 12 }}>
                    ✅ 알림톡이 정상 발송되었습니다!
                  </div>
                )}

                {/* 버튼 */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeAlimModal} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid #e2e4e9", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#5c6370" }}>
                    취소
                  </button>
                  {!alimModal.sent ? (
                    <button onClick={sendAlimtalk} disabled={alimModal.sending} style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: alimModal.sending ? "#c7d2fe" : "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: alimModal.sending ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                      {alimModal.sending ? "⏳ 발송 중..." : "📨 알림톡 발송"}
                    </button>
                  ) : (
                    <button onClick={closeAlimModal} style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      ✓ 완료
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── 갱신 모달 ─── */}
      {renewModal.open && renewModal.contract && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setRenewModal(m => ({ ...m, open: false }))}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{ background: "linear-gradient(135deg, #064e3b, #047857)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#6ee7b7", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>계약 갱신</div>
                <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>월주차 계약 연장</div>
              </div>
              <button onClick={() => setRenewModal(m => ({ ...m, open: false }))} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* 현재 계약 정보 */}
              <div style={{ background: "#f8f9fb", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#8b919d", fontWeight: 600, marginBottom: 8 }}>현재 계약</div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: 11, color: "#8b919d" }}>차량번호</div><div style={{ fontSize: 14, fontWeight: 800, color: "#1428A0" }}>{renewModal.contract.vehicle_number}</div></div>
                  <div><div style={{ fontSize: 11, color: "#8b919d" }}>고객명</div><div style={{ fontSize: 14, fontWeight: 700 }}>{renewModal.contract.customer_name}</div></div>
                  <div><div style={{ fontSize: 11, color: "#8b919d" }}>만료일</div><div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{renewModal.contract.end_date}</div></div>
                </div>
              </div>

              {/* 갱신 기간 선택 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>갱신 기간</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[1, 3, 6].map(m => (
                    <button key={m} onClick={() => handleRenewMonths(m)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${renewModal.months === m ? "#10b981" : "#e5e7eb"}`, background: renewModal.months === m ? "#ecfdf5" : "#fff", color: renewModal.months === m ? "#065f46" : "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                      {m}개월
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>갱신 만료일</div>
                  <input
                    type="date"
                    value={renewModal.customEnd}
                    onChange={e => setRenewModal(m => ({ ...m, customEnd: e.target.value, months: 0 }))}
                    style={{ flex: 1, padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  />
                </div>
              </div>

              {/* 요금 */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>월 요금</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={renewModal.newFee}
                    onChange={e => setRenewModal(m => ({ ...m, newFee: Number(e.target.value) }))}
                    style={{ flex: 1, padding: "9px 12px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>원</span>
                </div>
              </div>

              {/* 갱신 결과 미리보기 */}
              <div style={{ background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#065f46", fontWeight: 700, marginBottom: 6 }}>갱신 후 계약 내용</div>
                <div style={{ fontSize: 13, color: "#047857" }}>
                  📅 {new Date().toISOString().slice(0,10) > renewModal.contract.end_date ? new Date().toISOString().slice(0,10) : renewModal.contract.end_date}
                  {" → "}
                  <strong>{renewModal.customEnd || "-"}</strong>
                </div>
                <div style={{ fontSize: 13, color: "#047857", marginTop: 4 }}>
                  💰 월 요금: <strong>₩{renewModal.newFee.toLocaleString()}</strong>
                </div>
              </div>

              {/* 버튼 */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setRenewModal(m => ({ ...m, open: false }))} style={{ flex: 1, padding: "13px", borderRadius: 10, border: "1px solid #e2e4e9", background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#5c6370" }}>
                  취소
                </button>
                <button onClick={saveRenew} disabled={renewModal.saving || !renewModal.customEnd} style={{ flex: 2, padding: "13px", borderRadius: 10, border: "none", background: renewModal.saving ? "#a7f3d0" : "#10b981", color: "#fff", fontSize: 14, fontWeight: 700, cursor: renewModal.saving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                  {renewModal.saving ? "⏳ 저장 중..." : "🔄 갱신 확정"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
