// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

export default function SettingsPage() {
  const [stores, setStores] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");
  const [weekdayWorkers, setWeekdayWorkers] = useState([]);
  const [weekendWorkers, setWeekendWorkers] = useState([]);
  const [message, setMessage] = useState("");

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

  const renderWorkerList = (list, dayType) => {
    const isWeekday = dayType === "weekday";
    return (
      <div className="settings-worker-card">
        {/* 카드 헤더 */}
        <div className="settings-worker-card-header">
          <div className="settings-worker-card-title">
            <span className="settings-worker-card-icon">{isWeekday ? "☀️" : "🌴"}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {isWeekday ? "평일 근무자" : "주말 근무자"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {isWeekday ? "월요일 ~ 금요일" : "토요일 · 일요일"}
              </div>
            </div>
          </div>
          <button
            onClick={() => addDefaultWorker(dayType)}
            className="settings-add-btn"
          >+ 추가</button>
        </div>

        {/* 근무자 카운트 배지 */}
        <div className="settings-worker-count-bar">
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            배정된 근무자
          </span>
          <span className="settings-worker-count-badge">
            {list.length}명
          </span>
        </div>

        {/* 근무자 목록 */}
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
                <select
                  value={dw.worker_id}
                  onChange={e => changeWorker(dw.id, e.target.value)}
                  className="settings-worker-select"
                >
                  {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <button
                  onClick={() => removeDefaultWorker(dw.id)}
                  className="settings-remove-btn"
                >×</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const selectedStoreName = stores.find(s => s.id === selectedStore)?.name || "";

  return (
    <AppLayout>
      <style>{`
        /* ── 페이지 기본 ── */
        .settings-page { max-width: 860px; margin: 0 auto; padding-bottom: 80px; }

        /* ── 페이지 헤더 ── */
        .settings-page-header {
          background: linear-gradient(135deg, #020617 0%, #0a1352 50%, #1428A0 100%);
          border-radius: 16px;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-md);
        }
        .settings-header-icon {
          width: 48px; height: 48px; border-radius: 14px;
          background: #F5B731;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; flex-shrink: 0;
        }
        .settings-header-text h1 { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px; }
        .settings-header-text p { font-size: 13px; color: rgba(255,255,255,0.6); }

        /* ── 매장 선택 카드 ── */
        .settings-store-card {
          background: #fff;
          border-radius: 16px;
          padding: 20px 24px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          margin-bottom: 20px;
        }
        .settings-store-label {
          font-size: 13px; font-weight: 600; color: var(--text-secondary);
          margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
        }
        .settings-store-select-wrap {
          display: flex; align-items: center; gap: 12px;
        }
        .settings-store-select-input {
          flex: 1;
          padding: 12px 16px;
          border-radius: 12px;
          border: 2px solid var(--border);
          font-size: 15px; font-weight: 700;
          color: var(--text-primary);
          background: var(--bg-card);
          transition: border-color 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235c6370' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }
        .settings-store-select-input:focus {
          outline: none; border-color: var(--navy);
          background-color: #fff;
        }
        .settings-store-badge {
          padding: 6px 14px; border-radius: 8px;
          background: rgba(20,40,160,0.08); color: var(--navy);
          font-size: 12px; font-weight: 700; white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── 근무자 카드 그리드 ── */
        .settings-worker-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        /* ── 근무자 카드 ── */
        .settings-worker-card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .settings-worker-card-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-light);
          background: var(--bg-card);
        }
        .settings-worker-card-title { display: flex; align-items: center; gap: 10px; }
        .settings-worker-card-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #fff; display: flex; align-items: center;
          justify-content: center; font-size: 18px;
          border: 1px solid var(--border-light);
        }
        .settings-add-btn {
          padding: 8px 16px; border-radius: 8px;
          border: none; background: var(--navy);
          color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: background 0.2s; white-space: nowrap;
        }
        .settings-add-btn:hover { background: #1e3a8a; }

        /* ── 카운트 바 ── */
        .settings-worker-count-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 20px;
          border-bottom: 1px solid var(--border-light);
        }
        .settings-worker-count-badge {
          padding: 4px 12px; border-radius: 6px;
          background: rgba(20,40,160,0.08); color: var(--navy);
          font-size: 12px; font-weight: 700;
        }

        /* ── 근무자 목록 ── */
        .settings-worker-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        .settings-empty-state {
          text-align: center; padding: 32px 16px;
          color: var(--text-muted);
        }
        .settings-worker-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border-light);
        }
        .settings-worker-num {
          width: 22px; height: 22px; border-radius: 50%;
          background: var(--navy); color: #fff;
          font-size: 11px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .settings-worker-select {
          flex: 1; min-width: 0;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          font-size: 14px; font-weight: 600;
          color: var(--text-primary);
          background: #fff;
        }
        .settings-remove-btn {
          width: 30px; height: 30px; border-radius: 8px;
          border: none; background: #fee2e2; color: #dc2626;
          font-size: 16px; font-weight: 700; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.2s;
        }
        .settings-remove-btn:hover { background: #fca5a5; }

        /* ── 메시지 토스트 ── */
        .settings-toast {
          padding: 12px 18px; border-radius: 12px;
          background: #fee2e2; color: #dc2626;
          font-size: 13px; font-weight: 600;
          margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── 모바일 (≤ 767px) ── */
        @media (max-width: 767px) {
          .settings-page-header { padding: 18px 16px; border-radius: 14px; gap: 12px; }
          .settings-header-icon { width: 40px; height: 40px; font-size: 20px; border-radius: 12px; }
          .settings-header-text h1 { font-size: 16px; }
          .settings-header-text p { font-size: 12px; }

          .settings-store-card { padding: 16px; border-radius: 14px; }
          .settings-store-select-wrap { flex-direction: column; align-items: stretch; gap: 8px; }
          .settings-store-badge { text-align: center; }
          .settings-store-select-input { font-size: 14px; padding: 11px 40px 11px 14px; }

          /* 근무자 카드: 2열 → 1열 */
          .settings-worker-grid { grid-template-columns: 1fr; gap: 12px; }

          .settings-worker-card-header { padding: 14px 16px; }
          .settings-worker-count-bar { padding: 8px 16px; }
          .settings-worker-list { padding: 10px 12px; gap: 6px; }

          .settings-worker-item { padding: 8px 10px; gap: 8px; }
          .settings-worker-select { font-size: 13px; padding: 7px 8px; }
          .settings-add-btn { padding: 7px 12px; font-size: 12px; }
        }
      `}</style>

      <div className="settings-page">

        {/* 페이지 헤더 */}
        <div className="settings-page-header">
          <div className="settings-header-icon">⚙️</div>
          <div className="settings-header-text">
            <h1>설정</h1>
            <p>매장별 기본 근무자를 설정합니다</p>
          </div>
        </div>

        {/* 매장 선택 카드 */}
        <div className="settings-store-card">
          <div className="settings-store-label">
            <span>🏢</span> 매장 선택
          </div>
          <div className="settings-store-select-wrap">
            <select
              value={selectedStore}
              onChange={e => setSelectedStore(e.target.value)}
              className="settings-store-select-input"
            >
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {selectedStoreName && (
              <div className="settings-store-badge">📍 {selectedStoreName}</div>
            )}
          </div>
        </div>

        {/* 토스트 메시지 */}
        {message && (
          <div className="settings-toast">⚠️ {message}</div>
        )}

        {/* 근무자 카드 그리드 */}
        <div className="settings-worker-grid">
          {renderWorkerList(weekdayWorkers, "weekday")}
          {renderWorkerList(weekendWorkers, "weekend")}
        </div>

      </div>
    </AppLayout>
  );
}
