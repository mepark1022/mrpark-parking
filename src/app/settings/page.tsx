// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [stores, setStores] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [weekdayWorkers, setWeekdayWorkers] = useState([]);
  const [weekendWorkers, setWeekendWorkers] = useState([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("workers"); // "workers" | "notifications"
  const [notifTab, setNotifTab] = useState("crew"); // "crew" | "kakao" | "admin"
  const [toast, setToast] = useState("");

  // 알림 설정 상태
  const [notifSettings, setNotifSettings] = useState({
    crew_entry: true,
    crew_exit: true,
    kakao_entry: true,
    kakao_settled: true,
    admin_monthly_expire: true,
    admin_monthly_days: [7, 3, 1],
    admin_unsettled: true,
    admin_unsettled_time: "09:00",
    admin_accident: true,
    admin_lateness: true,
    admin_fullness: true,
    admin_fullness_pct: 90,
  });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedStore) loadDefaultWorkers(); }, [selectedStore]);

  const loadData = async () => {
    const supabase = createClient();
    const { data: storeData } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
    const { data: workerData } = await supabase.from("workers").select("id, name").eq("status", "active").order("name");
    if (storeData) { setStores(storeData); if (storeData.length > 0) setSelectedStore(storeData[0].id); }
    if (workerData) setWorkers(workerData);
  };

  const loadDefaultWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("store_default_workers").select("*, workers(name)").eq("store_id", selectedStore).order("display_order");
    if (data) {
      setWeekdayWorkers(data.filter(d => d.day_type === "weekday"));
      setWeekendWorkers(data.filter(d => d.day_type === "weekend"));
    }
  };

  const addDefaultWorker = async (dayType) => {
    const existing = dayType === "weekday" ? weekdayWorkers : weekendWorkers;
    const existingIds = existing.map(w => w.worker_id);
    const available = workers.filter(w => !existingIds.includes(w.id));
    if (available.length === 0) { setMessage("추가할 수 있는 근무자가 없습니다"); setTimeout(() => setMessage(""), 2000); return; }
    const supabase = createClient();
    await supabase.from("store_default_workers").insert({ store_id: selectedStore, worker_id: available[0].id, day_type: dayType, display_order: existing.length + 1 });
    loadDefaultWorkers();
  };

  const removeDefaultWorker = async (id) => {
    const supabase = createClient();
    await supabase.from("store_default_workers").delete().eq("id", id);
    loadDefaultWorkers();
  };

  const changeWorker = async (id, newWorkerId) => {
    const supabase = createClient();
    await supabase.from("store_default_workers").update({ worker_id: newWorkerId }).eq("id", id);
    loadDefaultWorkers();
  };

  const toggleNotif = (key) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDay = (day) => {
    setNotifSettings(prev => {
      const days = prev.admin_monthly_days.includes(day)
        ? prev.admin_monthly_days.filter(d => d !== day)
        : [...prev.admin_monthly_days, day].sort((a,b) => b - a);
      return { ...prev, admin_monthly_days: days };
    });
  };

  const saveNotifSettings = () => {
    setToast("알림 설정이 저장되었습니다");
    setTimeout(() => setToast(""), 2500);
  };

  const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || "";

  const ToggleSwitch = ({ on, onToggle }) => (
    <div
      onClick={onToggle}
      style={{
        width: 48, height: 26, borderRadius: 13, cursor: "pointer",
        background: on ? "#1428A0" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 25 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
      }} />
    </div>
  );

  const NotifRow = ({ label, sub, keyName }) => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 20px", borderBottom: "1px solid var(--border-light)",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      <ToggleSwitch on={notifSettings[keyName]} onToggle={() => toggleNotif(keyName)} />
    </div>
  );

  const renderWorkerList = (list, dayType) => {
    const isWeekday = dayType === "weekday";
    return (
      <div className="settings-worker-card">
        <div className="settings-worker-card-header">
          <div className="settings-worker-card-title">
            <span className="settings-worker-card-icon">{isWeekday ? "☀️" : "🌴"}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{isWeekday ? "평일 근무자" : "주말 근무자"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{isWeekday ? "월요일 ~ 금요일" : "토요일 · 일요일"}</div>
            </div>
          </div>
          <button onClick={() => addDefaultWorker(dayType)} className="settings-add-btn">+ 추가</button>
        </div>
        <div className="settings-worker-count-bar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>배정된 근무자</span>
          <span className="settings-worker-count-badge">{list.length}명</span>
        </div>
        <div className="settings-worker-list">
          {list.length === 0 ? (
            <div className="settings-empty-state">
              <div style={{ fontSize: 28, marginBottom: 8 }}>👤</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>배정된 근무자가 없습니다</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>+ 추가 버튼으로 근무자를 배정하세요</div>
            </div>
          ) : (
            list.map((dw, i) => (
              <div key={dw.id} className="settings-worker-item">
                <span className="settings-worker-num">{i + 1}</span>
                <select value={dw.worker_id} onChange={e => changeWorker(dw.id, e.target.value)} className="settings-worker-select">
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button onClick={() => removeDefaultWorker(dw.id)} className="settings-remove-btn">×</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <style>{`
        .settings-page { max-width: 860px; margin: 0 auto; padding-bottom: 80px; }

        .settings-page-header {
          background: linear-gradient(135deg, #020617 0%, #0a1352 50%, #1428A0 100%);
          border-radius: 16px; padding: 24px 28px;
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 24px; box-shadow: var(--shadow-md);
        }
        .settings-header-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: #F5B731;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; flex-shrink: 0;
        }
        .settings-header-text h1 { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .settings-header-text p { font-size: 13px; color: rgba(255,255,255,0.6); }

        /* ── 상단 탭 (근무자 / 알림 설정) ── */
        .settings-main-tabs {
          display: flex; gap: 4px;
          background: #f1f5f9; border-radius: 12px; padding: 4px;
          margin-bottom: 20px;
        }
        .settings-main-tab {
          flex: 1; padding: 10px; border-radius: 10px;
          border: none; background: transparent;
          font-size: 14px; font-weight: 700; cursor: pointer;
          color: var(--text-secondary); transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .settings-main-tab.active {
          background: #fff; color: var(--navy);
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }

        /* ── 매장 선택 카드 ── */
        .settings-store-card {
          background: #fff; border-radius: 16px; padding: 20px 24px;
          border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); margin-bottom: 20px;
        }
        .settings-store-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .settings-store-select-wrap { display: flex; align-items: center; gap: 12px; }
        .settings-store-select-input {
          flex: 1; padding: 12px 16px; border-radius: 12px;
          border: 2px solid var(--border); font-size: 15px; font-weight: 700;
          color: var(--text-primary); background: var(--bg-card); transition: border-color 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c6370' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center; padding-right: 40px;
        }
        .settings-store-select-input:focus { outline: none; border-color: var(--navy); background-color: #fff; }
        .settings-store-badge {
          padding: 6px 14px; border-radius: 8px;
          background: rgba(20,40,160,0.08); color: var(--navy);
          font-size: 12px; font-weight: 700; white-space: nowrap; flex-shrink: 0;
        }

        /* ── 근무자 카드 ── */
        .settings-worker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .settings-worker-card { background: #fff; border-radius: 16px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); overflow: hidden; }
        .settings-worker-card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-light); background: var(--bg-card); }
        .settings-worker-card-title { display: flex; align-items: center; gap: 10px; }
        .settings-worker-card-icon { width: 36px; height: 36px; border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 1px solid var(--border-light); }
        .settings-add-btn { padding: 8px 16px; border-radius: 8px; border: none; background: var(--navy); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
        .settings-add-btn:hover { background: #1e3a8a; }
        .settings-worker-count-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; border-bottom: 1px solid var(--border-light); }
        .settings-worker-count-badge { padding: 4px 12px; border-radius: 6px; background: rgba(20,40,160,0.08); color: var(--navy); font-size: 12px; font-weight: 700; }
        .settings-worker-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .settings-empty-state { text-align: center; padding: 32px 16px; color: var(--text-muted); }
        .settings-worker-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--bg-card); border: 1px solid var(--border-light); }
        .settings-worker-num { width: 22px; height: 22px; border-radius: 50%; background: var(--navy); color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .settings-worker-select { flex: 1; min-width: 0; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); font-size: 14px; font-weight: 600; color: var(--text-primary); background: #fff; }
        .settings-remove-btn { width: 30px; height: 30px; border-radius: 8px; border: none; background: #fee2e2; color: #dc2626; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s; }
        .settings-remove-btn:hover { background: #fca5a5; }

        /* ── 알림 설정 ── */
        .notif-channel-tabs {
          display: flex; gap: 0;
          border-radius: 12px; overflow: hidden;
          border: 1px solid var(--border-light);
          margin-bottom: 16px;
        }
        .notif-channel-tab {
          flex: 1; padding: 12px 8px;
          border: none; background: #f8fafc;
          font-size: 13px; font-weight: 700; cursor: pointer;
          color: var(--text-secondary); transition: all 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border-right: 1px solid var(--border-light);
        }
        .notif-channel-tab:last-child { border-right: none; }
        .notif-channel-tab.active {
          background: #1428A0; color: #fff;
        }
        .notif-channel-tab .tab-emoji { font-size: 20px; }

        .notif-card {
          background: #fff; border-radius: 16px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          overflow: hidden; margin-bottom: 16px;
        }
        .notif-card-header {
          padding: 16px 20px; border-bottom: 1px solid var(--border-light);
          background: var(--bg-card);
          display: flex; align-items: center; gap: 10px;
        }
        .notif-card-header-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
        }

        .notif-extra {
          padding: 12px 20px 14px;
          background: #f8fafc;
          border-top: 1px solid var(--border-light);
        }
        .notif-extra-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; }
        .day-badge-group { display: flex; gap: 6px; flex-wrap: wrap; }
        .day-badge {
          padding: 6px 14px; border-radius: 20px;
          border: 2px solid var(--border);
          background: #fff; color: var(--text-secondary);
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.15s;
        }
        .day-badge.active {
          border-color: #1428A0; background: #1428A0; color: #fff;
        }

        .notif-time-input {
          padding: 8px 12px; border-radius: 8px;
          border: 2px solid var(--border);
          font-size: 14px; font-weight: 700; color: var(--text-primary);
          background: #fff;
        }
        .notif-time-input:focus { outline: none; border-color: #1428A0; }

        .notif-pct-input {
          width: 70px; padding: 8px 12px; border-radius: 8px;
          border: 2px solid var(--border); font-size: 14px; font-weight: 700;
          color: var(--text-primary); background: #fff; text-align: center;
        }
        .notif-pct-input:focus { outline: none; border-color: #1428A0; }

        .notif-channel-desc {
          padding: 12px 20px; margin-bottom: 16px;
          border-radius: 12px; border: 1px dashed var(--border);
          font-size: 12px; color: var(--text-muted); line-height: 1.6;
          background: #fafafa;
        }

        .notif-save-btn {
          width: 100%; padding: 14px; border-radius: 12px;
          border: none; background: #1428A0; color: #fff;
          font-size: 15px; font-weight: 800; cursor: pointer;
          transition: background 0.2s; margin-top: 4px;
        }
        .notif-save-btn:hover { background: #0f1f7a; }

        /* ── 성공 토스트 ── */
        .settings-toast-success {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          padding: 12px 24px; border-radius: 24px;
          background: #1428A0; color: #fff;
          font-size: 14px; font-weight: 700;
          box-shadow: 0 4px 16px rgba(20,40,160,0.3);
          z-index: 9999; white-space: nowrap;
          animation: fadeInUp 0.3s ease;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* ── 에러 토스트 ── */
        .settings-toast { padding: 12px 18px; border-radius: 12px; background: #fee2e2; color: #dc2626; font-size: 13px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

        /* ── 모바일 ── */
        @media (max-width: 767px) {
          .settings-page-header { padding: 18px 16px; border-radius: 14px; gap: 12px; }
          .settings-header-icon { width: 40px; height: 40px; font-size: 20px; border-radius: 12px; }
          .settings-header-text h1 { font-size: 16px; }
          .settings-header-text p { font-size: 12px; }
          .settings-store-card { padding: 16px; border-radius: 14px; }
          .settings-store-select-wrap { flex-direction: column; align-items: stretch; gap: 8px; }
          .settings-store-badge { text-align: center; }
          .settings-store-select-input { font-size: 14px; padding: 11px 40px 11px 14px; }
          .settings-worker-grid { grid-template-columns: 1fr; gap: 12px; }
          .settings-worker-card-header { padding: 14px 16px; }
          .settings-worker-count-bar { padding: 8px 16px; }
          .settings-worker-list { padding: 10px 12px; gap: 6px; }
          .settings-worker-item { padding: 8px 10px; gap: 8px; }
          .settings-worker-select { font-size: 13px; padding: 7px 8px; }
          .settings-add-btn { padding: 7px 12px; font-size: 12px; }
          .notif-channel-tab { font-size: 12px; padding: 10px 4px; }
          .notif-channel-tab .tab-emoji { font-size: 18px; }
        }
      `}</style>

      <div className="settings-page">

        {/* 페이지 헤더 */}
        <div className="settings-page-header">
          <div className="settings-header-icon">⚙️</div>
          <div className="settings-header-text">
            <h1>설정</h1>
            <p>매장 운영 및 알림을 설정합니다</p>
          </div>
        </div>

        {/* 상단 메인 탭 */}
        <div className="settings-main-tabs">
          <button className={`settings-main-tab ${activeTab === "workers" ? "active" : ""}`} onClick={() => setActiveTab("workers")}>
            👥 기본 근무자
          </button>
          <button className={`settings-main-tab ${activeTab === "notifications" ? "active" : ""}`} onClick={() => setActiveTab("notifications")}>
            🔔 알림 설정
          </button>
        </div>

        {/* ─── 기본 근무자 탭 ─── */}
        {activeTab === "workers" && (
          <>
            <div className="settings-store-card">
              <div className="settings-store-label"><span>🏢</span> 매장 선택</div>
              <div className="settings-store-select-wrap">
                <select value={selectedStore} onChange={e => setSelectedStore(e.target.value)} className="settings-store-select-input">
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {selectedStoreName && <div className="settings-store-badge">📍 {selectedStoreName}</div>}
              </div>
            </div>
            {message && <div className="settings-toast">⚠️ {message}</div>}
            <div className="settings-worker-grid">
              {renderWorkerList(weekdayWorkers, "weekday")}
              {renderWorkerList(weekendWorkers, "weekend")}
            </div>
          </>
        )}

        {/* ─── 알림 설정 탭 ─── */}
        {activeTab === "notifications" && (
          <>
            {/* 채널 탭 */}
            <div className="notif-channel-tabs">
              <button className={`notif-channel-tab ${notifTab === "crew" ? "active" : ""}`} onClick={() => setNotifTab("crew")}>
                <span className="tab-emoji">📱</span>크루앱 푸시
              </button>
              <button className={`notif-channel-tab ${notifTab === "kakao" ? "active" : ""}`} onClick={() => setNotifTab("kakao")}>
                <span className="tab-emoji">💬</span>카카오 알림톡
              </button>
              <button className={`notif-channel-tab ${notifTab === "admin" ? "active" : ""}`} onClick={() => setNotifTab("admin")}>
                <span className="tab-emoji">🔔</span>관리자 알림
              </button>
            </div>

            {/* ── 크루앱 푸시 ── */}
            {notifTab === "crew" && (
              <>
                <div className="notif-channel-desc">
                  📱 크루앱을 사용하는 매장 근무자에게 발송되는 푸시 알림입니다.<br/>
                  해당 매장에 배정된 크루가 수신 대상입니다.
                </div>
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#eef2ff" }}>🚗</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>입차 알림</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>차량이 입차될 때 해당 매장 크루에게 발송</div>
                    </div>
                    <ToggleSwitch on={notifSettings.crew_entry} onToggle={() => toggleNotif("crew_entry")} />
                  </div>
                </div>
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#f0fdf4" }}>🏁</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>출차 알림</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>출차 처리 완료 시 해당 매장 크루에게 발송</div>
                    </div>
                    <ToggleSwitch on={notifSettings.crew_exit} onToggle={() => toggleNotif("crew_exit")} />
                  </div>
                </div>
              </>
            )}

            {/* ── 카카오 알림톡 ── */}
            {notifTab === "kakao" && (
              <>
                <div className="notif-channel-desc">
                  💬 차량 소유자에게 카카오 알림톡으로 발송됩니다. 건당 약 8~15원 비용이 발생합니다.<br/>
                  <strong>정책: 입차 + 정산 완료 2회만 발송 (출차 알림 제외)</strong>
                </div>
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#fffbeb" }}>📩</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>입차 안내</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>차량 소유자에게 입차 확인 메시지 발송 · ~8~15원/건</div>
                    </div>
                    <ToggleSwitch on={notifSettings.kakao_entry} onToggle={() => toggleNotif("kakao_entry")} />
                  </div>
                </div>
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#f0fdf4" }}>✅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>정산 완료</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>정산 처리 완료 시 차량 소유자에게 발송 · ~8~15원/건</div>
                    </div>
                    <ToggleSwitch on={notifSettings.kakao_settled} onToggle={() => toggleNotif("kakao_settled")} />
                  </div>
                </div>
                <div style={{ padding: "12px 16px", background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>💡 예상 발송 비용</div>
                  <div style={{ fontSize: 13, color: "#78350f" }}>
                    월 90,000건 기준 약 <strong>180만원/월</strong> (건당 20원 기준)
                  </div>
                </div>
              </>
            )}

            {/* ── 관리자 알림 ── */}
            {notifTab === "admin" && (
              <>
                <div className="notif-channel-desc">
                  🔔 관리자 웹에 표시되는 인앱 알림입니다. 각 탭의 주요 이벤트 발생 시 알림을 받습니다.
                </div>

                {/* 월주차 만료 */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#eef2ff" }}>📅</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>월주차 만료 예정</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>월주차 관리 탭 연동 · 만료 N일 전 알림</div>
                    </div>
                    <ToggleSwitch on={notifSettings.admin_monthly_expire} onToggle={() => toggleNotif("admin_monthly_expire")} />
                  </div>
                  {notifSettings.admin_monthly_expire && (
                    <div className="notif-extra">
                      <div className="notif-extra-label">알림 기준일 설정</div>
                      <div className="day-badge-group">
                        {[7, 3, 1].map(d => (
                          <div key={d} className={`day-badge ${notifSettings.admin_monthly_days.includes(d) ? "active" : ""}`} onClick={() => toggleDay(d)}>
                            D-{d}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 미정산 경고 */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#fff7ed" }}>⚠️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>미정산 경고</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>데이터 입력 탭 연동 · 전일 미입력 매장 알림</div>
                    </div>
                    <ToggleSwitch on={notifSettings.admin_unsettled} onToggle={() => toggleNotif("admin_unsettled")} />
                  </div>
                  {notifSettings.admin_unsettled && (
                    <div className="notif-extra">
                      <div className="notif-extra-label">알림 발송 시간</div>
                      <input
                        type="time"
                        value={notifSettings.admin_unsettled_time}
                        onChange={e => setNotifSettings(prev => ({ ...prev, admin_unsettled_time: e.target.value }))}
                        className="notif-time-input"
                      />
                    </div>
                  )}
                </div>

                {/* 사고 접수 */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#fef2f2" }}>🚨</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>사고 보고 접수</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>사고 보고 탭 연동 · 새 보고서 등록 시 즉시 알림</div>
                    </div>
                    <ToggleSwitch on={notifSettings.admin_accident} onToggle={() => toggleNotif("admin_accident")} />
                  </div>
                </div>

                {/* 지각/결근 */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#fff7ed" }}>🕐</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>지각 / 결근 발생</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>근무자 관리 탭 연동 · 정상 출근 위반 시 알림</div>
                    </div>
                    <ToggleSwitch on={notifSettings.admin_lateness} onToggle={() => toggleNotif("admin_lateness")} />
                  </div>
                </div>

                {/* 만차 임박 */}
                <div className="notif-card">
                  <div className="notif-card-header">
                    <div className="notif-card-header-icon" style={{ background: "#f0fdf4" }}>🅿️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>주차장 만차 임박</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>대시보드 연동 · 점유율 기준 초과 시 알림</div>
                    </div>
                    <ToggleSwitch on={notifSettings.admin_fullness} onToggle={() => toggleNotif("admin_fullness")} />
                  </div>
                  {notifSettings.admin_fullness && (
                    <div className="notif-extra">
                      <div className="notif-extra-label">알림 발생 점유율 기준</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="number"
                          min={50} max={99}
                          value={notifSettings.admin_fullness_pct}
                          onChange={e => setNotifSettings(prev => ({ ...prev, admin_fullness_pct: Number(e.target.value) }))}
                          className="notif-pct-input"
                        />
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)" }}>% 이상 시 알림</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 저장 버튼 */}
            <button className="notif-save-btn" onClick={saveNotifSettings}>
              💾 알림 설정 저장
            </button>
          </>
        )}
      </div>

      {/* 성공 토스트 */}
      {toast && <div className="settings-toast-success">✅ {toast}</div>}
    </AppLayout>
  );
}
