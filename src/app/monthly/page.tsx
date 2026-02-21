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

  function getContractBadge(row: MonthlyRow) {
    if (row.contract_status === "cancelled") {
      return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>해지</span>;
    }
    if (row.contract_status === "expired") {
      return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#f1f5f9", color: "#475569" }}>만료</span>;
    }
    if (isExpiringSoon(row.end_date)) {
      const days = getDaysLeft(row.end_date);
      return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fff7ed", color: "#ea580c" }}>D-{days}</span>;
    }
    return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#ecfdf5", color: "#10b981" }}>계약중</span>;
  }

  function getPaymentBadge(status: string) {
    switch (status) {
      case "paid":    return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#eff6ff", color: "#2563eb" }}>납부</span>;
      case "unpaid":  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fff7ed", color: "#ea580c" }}>미납</span>;
      case "overdue": return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#fee2e2", color: "#dc2626" }}>연체</span>;
      default: return null;
    }
  }

  async function cancelContract(id: string) {
    if (!confirm("계약을 해지하시겠습니까?")) return;
    await supabase.from("monthly_parking").update({ contract_status: "cancelled" }).eq("id", id);
    loadContracts();
  }

  const filtered = getFiltered();
  const activeCount = contracts.filter(c => c.contract_status === "active").length;
  const expiringSoon = contracts.filter(c => c.contract_status === "active" && isExpiringSoon(c.end_date));
  const expiredCount = contracts.filter(c => c.contract_status === "expired").length;

  // KPI 계산 (전체 계약 수는 filterStatus 무관하게 조회하기 어려우므로 현재 contracts 기반)
  const totalFee = contracts.filter(c => c.contract_status === "active").reduce((s, c) => s + c.monthly_fee, 0);

  return (
    <AppLayout>
      <div style={{ maxWidth: 1300 }}>

        {/* 상단 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1d26", marginBottom: 2 }}>월주차 관리</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>월정기 주차 계약 등록 및 현황 관리</p>
          </div>
          <button
            onClick={() => router.push("/monthly/register")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "11px 22px", borderRadius: 10,
              background: "var(--navy)", color: "#fff",
              fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer"
            }}
          >
            <span>+</span> 월주차 등록
          </button>
        </div>

        {/* KPI 카드 4개 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
          {[
            { icon: "📋", label: "전체 계약", value: contracts.length, color: "var(--navy)", bg: "rgba(20,40,160,0.08)" },
            { icon: "✅", label: "계약 중", value: activeCount, color: "#10b981", bg: "#ecfdf5" },
            { icon: "⏰", label: "만료 예정 (7일)", value: expiringSoon.length, color: "#ea580c", bg: "#fff7ed" },
            { icon: "💰", label: "월 계약 매출", value: `₩${(totalFee / 10000).toFixed(0)}만`, color: "var(--gold)", bg: "rgba(245,183,49,0.12)" },
          ].map((kpi, i) => (
            <div key={i} className="v3-info-card" style={{ borderLeft: `4px solid ${kpi.color}` }}>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {kpi.icon}
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{kpi.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 만료 예정 알림 배너 */}
        {expiringSoon.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
            border: "1px solid #fed7aa",
            borderRadius: 14, padding: "16px 20px",
            marginBottom: 20, borderLeft: "4px solid #ea580c"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#9a3412", marginBottom: 8 }}>
                  만료 예정 계약 {expiringSoon.length}건 (7일 이내)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {expiringSoon.map((c) => (
                    <span key={c.id} style={{
                      fontSize: 12, padding: "4px 12px",
                      background: "#fff", borderRadius: 6,
                      border: "1px solid #fed7aa", color: "#ea580c", fontWeight: 600
                    }}>
                      {c.stores?.name} · {c.vehicle_number} · D-{getDaysLeft(c.end_date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 필터 바 */}
        <div className="v3-info-card" style={{ marginBottom: 20 }}>
          <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginRight: 4 }}>🔍 필터</span>

            {/* 상태 탭 버튼 */}
            <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", padding: 4, borderRadius: 10 }}>
              {[
                { v: "active", label: "계약중" },
                { v: "expired", label: "만료" },
                { v: "cancelled", label: "해지" },
                { v: "", label: "전체" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setFilterStatus(opt.v)}
                  style={{
                    padding: "7px 14px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                    background: filterStatus === opt.v ? "#fff" : "transparent",
                    color: filterStatus === opt.v ? "var(--text-primary)" : "var(--text-secondary)",
                    boxShadow: filterStatus === opt.v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s"
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              style={{
                padding: "9px 12px", border: "1px solid var(--border)",
                borderRadius: 10, fontSize: 13, fontWeight: 500,
                background: "#fff", color: "var(--text-primary)",
                outline: "none", cursor: "pointer"
              }}
            >
              <option value="">전체 매장</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <div style={{
              display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "9px 14px"
            }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="차량번호, 고객명, 연락처 검색"
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: 13, outline: "none", color: "var(--text-primary)"
                }}
              />
              {searchText && (
                <button onClick={() => setSearchText("")}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}>
                  ✕
                </button>
              )}
            </div>

            <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
              총 {filtered.length}건
            </span>
          </div>
        </div>

        {/* 계약 목록 테이블 */}
        <div className="v3-info-card">
          <div className="v3-info-card-header">
            <div className="v3-info-card-title">
              <span>📅</span>
              <span>월주차 계약 목록</span>
            </div>
            <span className="v3-info-card-badge">{filterStatus === "active" ? "계약중" : filterStatus === "expired" ? "만료" : filterStatus === "cancelled" ? "해지" : "전체"}</span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <p style={{ fontSize: 14 }}>로딩 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>등록된 계약이 없습니다</p>
              <p style={{ fontSize: 13 }}>월주차 등록 버튼으로 새 계약을 추가하세요</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-card)", borderBottom: "2px solid var(--border)" }}>
                    {["매장", "차량번호", "고객명", "연락처", "계약 기간", "월 요금", "납부", "상태", "관리"].map(h => (
                      <th key={h} style={{
                        padding: "13px 16px", textAlign: "left",
                        fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
                        whiteSpace: "nowrap"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        background: isExpiringSoon(c.end_date) && c.contract_status === "active"
                          ? "#fffbeb"
                          : idx % 2 === 0 ? "#fff" : "var(--bg-page)",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={e => (e.currentTarget.style.background =
                        isExpiringSoon(c.end_date) && c.contract_status === "active"
                          ? "#fffbeb"
                          : idx % 2 === 0 ? "#fff" : "var(--bg-page)"
                      )}
                    >
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.stores?.name ?? "-"}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", fontFamily: "monospace, sans-serif" }}>
                          {c.vehicle_number}
                        </span>
                        {c.vehicle_type && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)", background: "var(--bg-card)", padding: "2px 8px", borderRadius: 5 }}>
                            {c.vehicle_type}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600 }}>{c.customer_name}</td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{c.customer_phone}</td>
                      <td style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {c.start_date} ~ {c.end_date}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                        ₩{c.monthly_fee.toLocaleString()}
                      </td>
                      <td style={{ padding: "14px 16px" }}>{getPaymentBadge(c.payment_status)}</td>
                      <td style={{ padding: "14px 16px" }}>{getContractBadge(c)}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => router.push(`/monthly/register?id=${c.id}`)}
                            style={{
                              padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                              border: "1px solid var(--border)", background: "#fff",
                              color: "var(--navy)", cursor: "pointer", transition: "all 0.15s"
                            }}
                          >
                            수정
                          </button>
                          {c.contract_status === "active" && (
                            <button
                              onClick={() => cancelContract(c.id)}
                              style={{
                                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: "1px solid #fecaca", background: "#fff",
                                color: "#dc2626", cursor: "pointer", transition: "all 0.15s"
                              }}
                            >
                              해지
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
