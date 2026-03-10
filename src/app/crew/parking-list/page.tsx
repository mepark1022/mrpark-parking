// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";
import CrewHeader from "@/components/crew/CrewHeader";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";
import { fmtPlate, splitPlate } from "@/lib/utils/format";

const CSS = `
  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .plist-page {
    min-height: 100dvh;
    background: #F8FAFC;
  }

  /* ── 검색/필터 바 ── */
  .plist-toolbar {
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: sticky;
    top: 56px;
    z-index: 30;
  }
  .plist-search {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #F1F5F9;
    border-radius: 10px;
    padding: 0 12px;
    height: 40px;
  }
  .plist-search input {
    flex: 1; border: none; background: transparent;
    font-size: 15px; color: #1A1D2B; outline: none;
  }
  .plist-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .plist-tabs::-webkit-scrollbar { display: none; }
  .plist-tab {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: 1.5px solid #E2E8F0;
    background: #fff; color: #64748B;
    white-space: nowrap;
  }
  .plist-tab.active {
    background: #1428A0; color: #fff; border-color: #1428A0;
  }
  .plist-tab.active-exit {
    background: #94A3B8; color: #fff; border-color: #94A3B8;
  }

  /* ── 통계 바 ── */
  .plist-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    background: #fff;
    border-bottom: 1px solid #E2E8F0;
    padding: 10px 0;
  }
  .plist-stat-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    border-right: 1px solid #E2E8F0;
  }
  .plist-stat-item:last-child { border-right: none; }
  .plist-stat-num { font-size: 20px; font-weight: 800; color: #1A1D2B; }
  .plist-stat-label { font-size: 10px; color: #94A3B8; }

  /* ── 차량 카드 ── */
  .plist-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }

  .vehicle-card {
    background: #fff;
    border-radius: 14px;
    border: 1.5px solid #E2E8F0;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.1s;
    active { transform: scale(0.98); }
  }
  .vehicle-card:active { transform: scale(0.98); }

  .vehicle-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid #F1F5F9;
  }
  .vehicle-plate {
    font-size: 20px; font-weight: 800;
    letter-spacing: 2px; color: #1A1D2B;
  }
  .btn-plate-edit-sm {
    width: 28px; height: 28px; border-radius: 50%;
    background: #F1F5F9; border: 1.5px solid #E2E8F0;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
  }
  .btn-plate-edit-sm:active { background: #E2E8F0; transform: scale(0.9); }
  .status-badge {
    padding: 4px 10px; border-radius: 20px;
    font-size: 12px; font-weight: 700;
  }

  .vehicle-card-body {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .vehicle-type-badge {
    padding: 3px 9px; border-radius: 6px;
    font-size: 11px; font-weight: 600;
  }
  .vehicle-type-badge.valet { background: #FFF7ED; color: #EA580C; }
  .vehicle-type-badge.self  { background: #EEF2FF; color: #1428A0; }
  .vehicle-type-badge.monthly { background: #F0FDF4; color: #16A34A; }

  .vehicle-info-row {
    display: flex; align-items: center; gap: 4px;
    font-size: 12px; color: #64748B;
  }
  .vehicle-elapsed {
    font-size: 14px; font-weight: 700;
    margin-left: auto;
  }
  .vehicle-elapsed.warn { color: #DC2626; }
  .vehicle-elapsed.caution { color: #EA580C; }
  .vehicle-elapsed.ok { color: #16A34A; }

  .vehicle-card-footer {
    padding: 8px 14px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .vehicle-location { font-size: 12px; color: #94A3B8; }
  .vehicle-fee { font-size: 14px; font-weight: 700; color: #1A1D2B; }

  /* ── 상태별 카드 강조 ── */
  .vehicle-card.exit_requested {
    border-color: #EA580C;
    border-width: 2.5px;
    background: #FFF7ED;
    box-shadow: 0 0 0 3px rgba(234,88,12,0.15);
    animation: pulseOrange 1.5s ease-in-out infinite;
  }
  @keyframes pulseOrange {
    0%, 100% { box-shadow: 0 0 0 3px rgba(234,88,12,0.15); }
    50%       { box-shadow: 0 0 0 6px rgba(234,88,12,0.08); }
  }
  .vehicle-card.car_ready { border-color: #16A34A; border-width: 2px; background: #F0FDF4; }

  /* ── 출차처리 버튼 ── */
  .btn-checkout-inline {
    flex-shrink: 0;
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: none;
    background: #16A34A;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(22,163,74,0.3);
  }
  .btn-checkout-inline:active { transform: scale(0.95); opacity: 0.9; }
  .btn-checkout-inline.exit_requested,
  .btn-checkout-inline.car_ready {
    background: #EA580C;
    box-shadow: 0 2px 8px rgba(234,88,12,0.3);
  }

  /* ── 새로고침 버튼 ── */
  .fab-refresh {
    position: fixed;
    bottom: calc(72px + env(safe-area-inset-bottom, 0));
    right: 20px;
    width: 52px; height: 52px;
    background: #1428A0; color: #fff;
    border-radius: 50%; border: none;
    font-size: 22px; cursor: pointer;
    box-shadow: 0 4px 16px rgba(20,40,160,0.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 40;
  }

  /* ── 빈 화면 ── */
  .empty-state {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 60px 20px; text-align: center;
  }
  .empty-icon { font-size: 56px; margin-bottom: 16px; }
  .empty-title { font-size: 17px; font-weight: 700; color: #1A1D2B; margin-bottom: 6px; }
  .empty-desc  { font-size: 14px; color: #64748B; }

  /* ── 로딩 ── */
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .loading-card {
    height: 96px; background: #E2E8F0; border-radius: 14px;
    animation: pulse 1.2s ease infinite;
  }
`;

const STATUS_CONFIG = {
  parking:        { label: "주차 중",   bg: "#EEF2FF", color: "#1428A0" },
  pre_paid:       { label: "사전정산",  bg: "#F0FDF4", color: "#16A34A" },
  exit_requested: { label: "출차요청",  bg: "#FFF7ED", color: "#EA580C" },
  car_ready:      { label: "차량준비",  bg: "#DCFCE7", color: "#16A34A" },
  completed:      { label: "출차완료",  bg: "#F1F5F9", color: "#94A3B8" },
};

const TABS = [
  { key: "all",     label: "전체" },
  { key: "valet",   label: "🔑 발렛" },
  { key: "self",    label: "🏢 자주식" },
  { key: "monthly", label: "📅 월주차" },
  { key: "exited",  label: "🚗 출차" },
];

function elapsedString(entryAt) {
  const mins = Math.floor((Date.now() - new Date(entryAt).getTime()) / 60000);
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function feeFromMinutes(mins, feeStructure) {
  if (!feeStructure) return null;
  const { free_minutes = 30, base_fee = 0, base_minutes = 30, extra_fee = 0, daily_max = 0 } = feeStructure;
  if (mins <= free_minutes) return 0;
  const chargeable = mins - free_minutes;
  if (chargeable <= base_minutes) return Math.min(base_fee, daily_max || Infinity);
  const extraUnits = Math.ceil((chargeable - base_minutes) / 10);
  const total = base_fee + extraUnits * extra_fee;
  return daily_max ? Math.min(total, daily_max) : total;
}

export default function CrewParkingListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [storeId, setStoreId] = useState(null);
  const [plateEditTarget, setPlateEditTarget] = useState(null);
  const [editPlateValue, setEditPlateValue] = useState("");
  const [plateEditLoading, setPlateEditLoading] = useState(false);
  const [exitToast, setExitToast] = useState(null); // { plate, id }
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [exitedTickets, setExitedTickets] = useState([]);
  const [exitedLoading, setExitedLoading] = useState(false);

  useEffect(() => {
    const savedStoreId = localStorage.getItem("crew_store_id");
    setStoreId(savedStoreId);
    fetchTickets(savedStoreId);

    // 5초 폴링 - 출차요청 상태 변화 감지
    let prevExitIds = new Set<string>();
    const interval = setInterval(async () => {
      if (!savedStoreId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("mepark_tickets")
        .select("id, plate_number, status")
        .eq("store_id", savedStoreId)
        .eq("status", "exit_requested");

      if (data) {
        const newExitIds = new Set(data.map((t) => t.id));
        // 새로 추가된 출차요청 감지
        const newRequests = data.filter((t) => !prevExitIds.has(t.id));
        if (newRequests.length > 0) {
          fetchTickets(savedStoreId);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          const first = newRequests[0];
          setExitToast({ plate: first.plate_number, id: first.id });
          setTimeout(() => setExitToast(null), 6000);
        } else if (data.length !== prevExitIds.size) {
          // 출차요청 수 변화 시 목록 새로고침
          fetchTickets(savedStoreId);
        }
        prevExitIds = newExitIds;
      }
    }, 5000);

    return () => { clearInterval(interval); };
  }, []);

  const fetchTickets = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    const { data } = await supabase
      .from("mepark_tickets")
      .select(`
        id, plate_number, plate_last4, parking_type, status,
        entry_at, pre_paid_at, parking_location, is_monthly, paid_amount,
        visit_place_id, visit_places(name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee)
      `)
      .eq("store_id", sid)
      .neq("status", "completed")
      .order("entry_at", { ascending: false });

    setTickets(data || []);
    setLoading(false);
  }, [supabase]);

  const refresh = () => {
    const sid = localStorage.getItem("crew_store_id");
    if (activeTab === "exited") fetchExitedTickets(sid, selectedDate);
    else fetchTickets(sid);
  };

  const fetchExitedTickets = useCallback(async (sid, date) => {
    if (!sid) return;
    setExitedLoading(true);
    const { data } = await supabase
      .from("mepark_tickets")
      .select(`
        id, plate_number, plate_last4, parking_type, status,
        entry_at, exit_at, parking_location, is_monthly, paid_amount,
        entry_method, entry_crew_id, exit_crew_id,
        visit_place_id, visit_places(name, free_minutes, base_fee, base_minutes, extra_fee, daily_max, valet_fee)
      `)
      .eq("store_id", sid)
      .eq("status", "completed")
      .gte("entry_at", `${date}T00:00:00`)
      .lte("entry_at", `${date}T23:59:59`)
      .order("exit_at", { ascending: false });
    setExitedTickets(data || []);
    setExitedLoading(false);
  }, [supabase]);

  // 출차탭 선택 or 날짜 변경 시 fetch
  useEffect(() => {
    if (activeTab === "exited" && storeId) {
      fetchExitedTickets(storeId, selectedDate);
    }
  }, [activeTab, selectedDate, storeId]);

  const openPlateEdit = (e, ticketId, plate) => {
    e.stopPropagation();
    setPlateEditTarget({ id: ticketId, plate });
    setEditPlateValue(plate);
  };

  const handlePlateEdit = async () => {
    if (!plateEditTarget) return;
    const cleaned = editPlateValue.trim().toUpperCase().replace(/\s/g, "");
    if (!cleaned || cleaned.length < 4 || cleaned === plateEditTarget.plate) {
      setPlateEditTarget(null); return;
    }
    setPlateEditLoading(true);
    const last4 = cleaned.replace(/[^0-9]/g, "").slice(-4);
    const { error } = await supabase.from("mepark_tickets").update({
      plate_number: cleaned, plate_last4: last4, updated_at: new Date().toISOString(),
    }).eq("id", plateEditTarget.id);
    if (error) { alert("수정 실패: " + error.message); }
    else { setTickets(prev => prev.map(t => t.id === plateEditTarget.id ? { ...t, plate_number: cleaned, plate_last4: last4 } : t)); }
    setPlateEditLoading(false);
    setPlateEditTarget(null);
  };

  const filtered = tickets.filter(t => {
    const searchMatch = !search || t.plate_number.includes(search.toUpperCase()) ||
      t.plate_last4.includes(search);
    const tabMatch =
      activeTab === "all" ? true :
      activeTab === "monthly" ? t.is_monthly :
      activeTab === t.parking_type;
    return searchMatch && tabMatch;
  });

  // 통계
  const stats = {
    total: tickets.length,
    valet: tickets.filter(t => t.parking_type === "valet").length,
    exitReq: tickets.filter(t => t.status === "exit_requested" || t.status === "car_ready").length,
    monthly: tickets.filter(t => t.is_monthly).length,
  };

  const exitReqCount = tickets.filter(t => t.status === "exit_requested").length;

  return (
    <>
      <style>{CSS}</style>
      <div className="plist-page">
        <CrewHeader title="입차 현황" />

        {/* ─── 출차요청 고정 배너 ─── */}
        {exitReqCount > 0 && (
          <div
            onClick={() => setActiveTab("all")}
            style={{
              position: "sticky", top: 56, zIndex: 50,
              background: "#EA580C", color: "#fff",
              padding: "12px 16px", display: "flex",
              alignItems: "center", justifyContent: "space-between",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🚗</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>
                출차요청 {exitReqCount}건 대기 중
              </span>
            </div>
            <span style={{ fontSize: 12, opacity: 0.85 }}>탭하여 확인 →</span>
          </div>
        )}

        {/* ─── 토스트 팝업 ─── */}
        {exitToast && (
          <div
            onClick={() => router.push(`/crew/parking-list/${exitToast.id}`)}
            style={{
              position: "fixed", top: 64, left: 16, right: 16,
              zIndex: 9999, background: "#EA580C", color: "#fff",
              borderRadius: 16, padding: "16px 18px",
              boxShadow: "0 8px 32px rgba(234,88,12,0.5)",
              display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer", animation: "slideDown 0.3s ease",
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, flexShrink: 0,
            }}>🚗</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 2 }}>출차요청 도착!</div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>
                {exitToast.plate}
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>탭하여 처리하기 →</div>
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); setExitToast(null); }}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}
            >✕</div>
          </div>
        )}

        {/* 검색/탭 */}
        <div className="plist-toolbar">
          <div className="plist-search">
            <span style={{ fontSize: 16, color: "#94A3B8" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="번호판 검색"
              inputMode="text"
            />
            {search && (
              <span onClick={() => setSearch("")}
                style={{ fontSize: 16, color: "#94A3B8", cursor: "pointer" }}>✕</span>
            )}
          </div>
          <div className="plist-tabs">
            {TABS.map(tab => (
              <div
                key={tab.key}
                className={`plist-tab${activeTab === tab.key ? (tab.key === "exited" ? " active-exit" : " active") : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </div>
            ))}
          </div>
          {activeTab === "exited" && (
            <MeParkDatePicker value={selectedDate} onChange={setSelectedDate} compact style={{ width: "100%" }} />
          )}
        </div>

        {/* 통계 */}
        <div className="plist-stats">
          {(activeTab === "exited" ? [
            { num: exitedTickets.length, label: "출차완료" },
            { num: exitedTickets.filter(t => t.parking_type === "valet").length, label: "발렛" },
            { num: exitedTickets.filter(t => t.is_monthly).length, label: "월주차" },
            { num: exitedTickets.reduce((s, t) => s + (t.paid_amount || 0), 0).toLocaleString() + "원", label: "매출", isText: true },
          ] : [
            { num: stats.total,   label: "주차 중" },
            { num: stats.valet,   label: "발렛" },
            { num: stats.monthly, label: "월주차" },
            { num: stats.exitReq, label: "출차요청", color: stats.exitReq > 0 ? "#EA580C" : undefined },
          ]).map((s, i) => (
            <div key={i} className="plist-stat-item">
              <div className="plist-stat-num" style={{ ...(s.color ? { color: s.color } : {}), ...(s.isText ? { fontSize: 14 } : {}) }}>
                {s.num}
              </div>
              <div className="plist-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 목록 */}
        <div className="plist-list">
          {activeTab === "exited" ? (
            /* ─── 출차 차량 목록 ─── */
            exitedLoading ? (
              [1,2,3,4].map(i => <div key={i} className="loading-card" />)
            ) : exitedTickets.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🚗</div>
                <div className="empty-title">출차 기록 없음</div>
                <div className="empty-desc">{selectedDate} 출차 차량이 없습니다</div>
              </div>
            ) : (
              exitedTickets.filter(t => !search || t.plate_number.includes(search.toUpperCase()) || t.plate_last4.includes(search)).map(ticket => {
                const entryTime = new Date(ticket.entry_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                const exitTime = ticket.exit_at ? new Date(ticket.exit_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-";
                const durationMins = ticket.exit_at ? Math.floor((new Date(ticket.exit_at).getTime() - new Date(ticket.entry_at).getTime()) / 60000) : 0;
                const durationStr = durationMins < 60 ? `${durationMins}분` : `${Math.floor(durationMins / 60)}시간 ${durationMins % 60 > 0 ? (durationMins % 60) + "분" : ""}`;

                return (
                  <div key={ticket.id} className="vehicle-card" style={{ borderColor: "#E2E8F0", opacity: 0.95 }}
                    onClick={() => router.push(`/crew/parking-list/${ticket.id}`)}
                  >
                    <div className="vehicle-card-top" style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <div className="vehicle-plate" style={{ color: "#64748B" }}>
                          {(() => { const [p, n] = splitPlate(ticket.plate_number); return p ? <>{p}<span style={{ marginLeft: 6 }}>{n}</span></> : ticket.plate_number; })()}
                        </div>
                        {ticket.entry_method && (
                          <span style={{ fontSize: 14, opacity: 0.7 }}>{ticket.entry_method === "camera" ? "📷" : "✏️"}</span>
                        )}
                      </div>
                      <div className="status-badge" style={{ background: "#F1F5F9", color: "#94A3B8" }}>출차완료</div>
                    </div>
                    <div className="vehicle-card-body">
                      <div className={`vehicle-type-badge ${ticket.is_monthly ? "monthly" : ticket.parking_type}`}>
                        {ticket.is_monthly ? "📅 월주차" : ticket.parking_type === "valet" ? "🔑 발렛" : "🏢 자주식"}
                      </div>
                      {ticket.visit_places?.name && (
                        <div className="vehicle-info-row"><span>🏥</span><span>{ticket.visit_places.name}</span></div>
                      )}
                      <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "#64748B" }}>{durationStr}</div>
                    </div>
                    <div className="vehicle-card-footer">
                      <div className="vehicle-location" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: "#1428A0" }}>🕐 {entryTime}</span>
                        <span style={{ color: "#94A3B8" }}>→</span>
                        <span style={{ color: "#16A34A" }}>{exitTime}</span>
                      </div>
                      {ticket.is_monthly ? (
                        <div className="vehicle-fee" style={{ color: "#16A34A" }}>무료</div>
                      ) : ticket.paid_amount ? (
                        <div className="vehicle-fee">{ticket.paid_amount.toLocaleString()}원</div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* ─── 주차 중 차량 목록 (기존) ─── */
            loading ? (
            [1,2,3,4].map(i => <div key={i} className="loading-card" />)
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🅿️</div>
              <div className="empty-title">주차 차량 없음</div>
              <div className="empty-desc">
                {search ? `"${search}" 검색 결과가 없습니다` : "현재 주차 중인 차량이 없습니다"}
              </div>
            </div>
          ) : (
            filtered.map(ticket => {
              const mins = Math.floor((Date.now() - new Date(ticket.entry_at).getTime()) / 60000);
              const elapsed = elapsedString(ticket.entry_at);
              const elapsedClass = mins > 120 ? "warn" : mins > 60 ? "caution" : "ok";
              const statusCfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.parking;

              // 추정 요금
              const vp = ticket.visit_places;
              let estFee = ticket.paid_amount || null;
              if (!estFee && !ticket.is_monthly && vp) {
                const valetFee = ticket.parking_type === "valet" ? (vp.valet_fee || 0) : 0;
                estFee = (feeFromMinutes(mins, vp) || 0) + valetFee;
              }

              return (
                <div
                  key={ticket.id}
                  className={`vehicle-card ${ticket.status}`}
                  onClick={() => router.push(`/crew/parking-list/${ticket.id}`)}
                >
                  <div className="vehicle-card-top">
                    <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                      <div className="vehicle-plate">{(()=>{const [p,n]=splitPlate(ticket.plate_number);return p?<>{p}<span style={{marginLeft:6}}>{n}</span></>:ticket.plate_number;})()}</div>
                      {ticket.status !== "completed" && (
                        <button className="btn-plate-edit-sm" onClick={(e) => openPlateEdit(e, ticket.id, ticket.plate_number)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                      <div className="status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </div>
                      <button
                        className={`btn-checkout-inline ${ticket.status}`}
                        onClick={(e) => { e.stopPropagation(); router.push(`/crew/parking-list/${ticket.id}`); }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                        </svg>
                        출차
                      </button>
                    </div>
                  </div>
                  <div className="vehicle-card-body">
                    <div className={`vehicle-type-badge ${ticket.is_monthly ? "monthly" : ticket.parking_type}`}>
                      {ticket.is_monthly ? "📅 월주차" : ticket.parking_type === "valet" ? "🔑 발렛" : "🏢 자주식"}
                    </div>
                    {ticket.visit_places?.name && (
                      <div className="vehicle-info-row">
                        <span>🏥</span><span>{ticket.visit_places.name}</span>
                      </div>
                    )}
                    <div className={`vehicle-elapsed ${elapsedClass}`}>{elapsed}</div>
                  </div>
                  <div className="vehicle-card-footer">
                    <div className="vehicle-location">
                      {ticket.parking_location || new Date(ticket.entry_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + " 입차"}
                    </div>
                    {ticket.is_monthly ? (
                      <div className="vehicle-fee" style={{ color: "#16A34A" }}>무료</div>
                    ) : estFee !== null ? (
                      <div className="vehicle-fee">{estFee.toLocaleString()}원</div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )
          )}
        </div>

        <CrewNavSpacer />
        <CrewBottomNav />

        {/* FAB 새로고침 */}
        <button className="fab-refresh" onClick={refresh}>↺</button>

        {/* 차량번호 수정 모달 */}
        {plateEditTarget && (
          <div onClick={() => setPlateEditTarget(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "flex-end", zIndex: 200,
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "#fff", width: "100%",
              borderRadius: "24px 24px 0 0", padding: "24px 20px",
              paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0))",
            }}>
              <div style={{ width: 40, height: 4, background: "#E2E8F0", borderRadius: 2, margin: "0 auto 20px" }} />
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", marginBottom: 4 }}>차량번호 수정</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>OCR 오인식이나 수기 입력 오류를 수정합니다.</div>

              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: 10, background: "#FEF2F2", borderRadius: 10,
                fontSize: 13, color: "#DC2626", fontWeight: 600, marginBottom: 12,
              }}>
                <span>기존:</span>
                <span style={{ letterSpacing: 2, fontWeight: 800, fontSize: 16 }}>{plateEditTarget.plate}</span>
              </div>

              <div style={{ textAlign: "center", padding: "4px 0", color: "#94A3B8" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
              </div>

              <input
                value={editPlateValue}
                onChange={(e) => setEditPlateValue(e.target.value.toUpperCase())}
                placeholder="12가3456"
                maxLength={12}
                autoFocus
                style={{
                  width: "100%", height: 56, border: "2px solid #1428A0",
                  borderRadius: 14, background: "#EEF2FF",
                  fontSize: 24, fontWeight: 800, letterSpacing: 3,
                  textAlign: "center", color: "#1A1D2B", outline: "none",
                  boxSizing: "border-box", marginTop: 8,
                }}
              />
              <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 6, marginBottom: 16 }}>
                차량번호를 정확히 입력해주세요
              </div>

              <button
                onClick={handlePlateEdit}
                disabled={plateEditLoading || !editPlateValue.trim() || editPlateValue.trim().length < 4 || editPlateValue.trim().toUpperCase() === plateEditTarget.plate}
                style={{
                  width: "100%", height: 52, borderRadius: 12, border: "none",
                  background: "#16A34A", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
                  opacity: (!editPlateValue.trim() || editPlateValue.trim().length < 4 || editPlateValue.trim().toUpperCase() === plateEditTarget.plate) ? 0.4 : 1,
                  marginBottom: 10,
                }}
              >
                {plateEditLoading ? "처리 중..." : "✏️ 수정 완료"}
              </button>
              <button onClick={() => setPlateEditTarget(null)} style={{
                width: "100%", height: 44, borderRadius: 12,
                border: "none", background: "#F1F5F9", color: "#475569",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>취소</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
