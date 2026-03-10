// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";

/* ── 미팍티켓 알림 설정 기본값 ── */
const DEFAULT_NOTIF: NotifSettings = {
  notify_entry: true,
  notify_payment: true,
  notify_exit_request: true,
  push_enabled: true,
  sound_enabled: true,
  vibration_enabled: true,
};

type NotifSettings = {
  notify_entry: boolean;
  notify_payment: boolean;
  notify_exit_request: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
};

const SETTINGS_KEY = "mepark_notif_settings";

const DEFAULT_SETTINGS = {
  crew_entry: true,
  crew_exit: true,
  kakao_entry: true,
  kakao_settled: true,
  admin_monthly: true,
  admin_monthly_days: [7, 3, 1] as number[],
  admin_unsettled: true,
  admin_unsettled_time: "09:00",
  admin_accident: true,
  admin_lateness: true,
  admin_fullness: true,
  admin_fullness_pct: 90,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function SettingsPage() {
  const [notifTab, setNotifTab] = useState<"crew"|"kakao"|"admin">("crew");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [s, setS] = useState(DEFAULT_SETTINGS);

  /* ── 미팍티켓 알림 설정 (DB 연동) ── */
  const [notif, setNotif] = useState<NotifSettings>(DEFAULT_NOTIF);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>("viewer");
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [activeStore, setActiveStore] = useState<{id:string;name:string}|null>(null);

  const isAdmin = userRole === "admin" || userRole === "owner" || userRole === "super_admin";
  const isCrew = userRole === "crew";

  useEffect(() => {
    setS(loadSettings());
    loadNotifSettings();
    // 활성 매장 로드
    try {
      const saved = localStorage.getItem("mepark_active_store");
      if (saved) setActiveStore(JSON.parse(saved));
    } catch {}
  }, []);

  async function loadNotifSettings() {
    try {
      const ctx = await getUserContext();
      setUserRole(ctx.role);
      setUserId(ctx.userId);
      setOrgId(ctx.orgId);

      if (!ctx.userId || !ctx.orgId) return;

      const supabase = createClient();
      const { data } = await supabase
        .from("user_notification_settings")
        .select("*")
        .eq("user_id", ctx.userId)
        .single();

      if (data) {
        setNotif({
          notify_entry: data.notify_entry ?? true,
          notify_payment: data.notify_payment ?? true,
          notify_exit_request: data.notify_exit_request ?? true,
          push_enabled: data.push_enabled ?? true,
          sound_enabled: data.sound_enabled ?? true,
          vibration_enabled: data.vibration_enabled ?? true,
        });
      }
    } catch (e) {
      // 테이블 미존재 시 기본값 사용
    } finally {
      setNotifLoading(false);
    }
  }

  async function saveNotifSettings() {
    if (!userId || !orgId) return;
    setNotifSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("user_notification_settings")
        .upsert({
          user_id: userId,
          org_id: orgId,
          ...notif,
        }, { onConflict: "user_id" });

      showToast("✅ 알림 설정이 저장되었습니다");
    } catch (e) {
      showToast("❌ 저장 실패. 다시 시도해주세요.");
    } finally {
      setNotifSaving(false);
    }
  }

  const toggleNotif = (key: keyof NotifSettings) => {
    setNotif(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllNotif = (enabled: boolean) => {
    setNotif(prev => ({
      ...prev,
      notify_entry: enabled,
      notify_payment: enabled,
      notify_exit_request: enabled,
      push_enabled: enabled,
    }));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const toggle = (key: string) => setS(p => ({ ...p, [key]: !p[key] }));
  const toggleDay = (d: number) => setS(p => ({
    ...p,
    admin_monthly_days: p.admin_monthly_days.includes(d)
      ? p.admin_monthly_days.filter(x => x !== d)
      : [...p.admin_monthly_days, d].sort((a, b) => b - a),
  }));

  const save = async () => {
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      await new Promise(r => setTimeout(r, 400));
      showToast("✅ 알림 설정이 저장되었습니다");
    } catch {
      showToast("❌ 저장 실패. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText("mepark1022@gmail.com").catch(() => {});
    showToast("📋 이메일이 복사되었습니다");
  };

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      style={{
        width: 50, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
        background: on ? "#1428A0" : "#d1d5db", position: "relative",
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 4, left: on ? 26 : 4,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
      }} />
    </button>
  );

  const NotifRow = ({
    icon, iconBg, title, sub, badge, badgeColor, keyName, children,
  }: any) => {
    const isOn = s[keyName];
    return (
      <div style={{ background: "#fff", borderRadius: 20, border: "none", boxShadow: "0 2px 12px rgba(20,40,160,0.07)", overflow: "hidden", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              <span style={{
                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, marginRight: 4,
                ...badgeColor,
              }}>{badge}</span>
              {sub}
            </div>
          </div>
          <Toggle on={isOn} onToggle={() => toggle(keyName)} />
        </div>
        {isOn && children && (
          <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  const BADGE = {
    blue: { background: "rgba(20,40,160,0.08)", color: "#1428A0" },
    gold: { background: "#fffbeb", color: "#92400e" },
    green: { background: "#dcfce7", color: "#16A34A" },
    red: { background: "#fee2e2", color: "#DC2626" },
    orange: { background: "#fff7ed", color: "#EA580C" },
  };

  const TABS = [
    { id: "crew", emoji: "📱", label: "크루앱 푸시" },
    { id: "kakao", emoji: "💬", label: "카카오 알림톡" },
    { id: "admin", emoji: "🔔", label: "관리자 알림" },
  ];

  return (
    <AppLayout>
      <style>{`
        .sp { max-width: 720px; margin: 0 auto; padding-bottom: 80px; }
        .sp-header {
          background: linear-gradient(135deg,#020617 0%,#0a1352 50%,#1428A0 100%);
          border-radius: 18px; padding: 22px 24px;
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .sp-header-icon {
          width: 48px; height: 48px; border-radius: 14px; background: #F5B731;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; flex-shrink: 0;
        }
        .sp-section-label {
          font-size: 11px; font-weight: 800; letter-spacing: 1.2px;
          color: #94a3b8; text-transform: uppercase;
          padding: 0 4px; margin: 24px 0 10px;
          display: flex; align-items: center; gap: 8px;
        }
        .sp-section-label::after { content:''; flex:1; height:1px; background:#e2e8f0; }
        .sp-channel-tabs {
          display: grid; grid-template-columns: repeat(3,1fr);
          border-radius: 14px; overflow: hidden;
          border: 1px solid #e2e8f0; margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .sp-channel-tab {
          padding: 14px 8px; border: none; background: #fff;
          font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
          color: #94a3b8; transition: all 0.18s;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          border-right: 1px solid #e2e8f0;
        }
        .sp-channel-tab:last-child { border-right: none; }
        .sp-channel-tab.active { background: #1428A0; color: #fff; }
        .sp-channel-desc {
          padding: 11px 16px; background: #fafafa;
          border-radius: 10px; border: 1px dashed #e2e8f0;
          font-size: 12px; color: #475569; line-height: 1.7; margin-bottom: 14px;
        }
        .sp-extra-label { font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 10px; }
        .sp-day-chip {
          padding: 7px 16px; border-radius: 20px;
          border: 2px solid #e2e8f0; background: #fff; color: #475569;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.15s; user-select: none; display: inline-block;
        }
        .sp-day-chip.on { border-color: #1428A0; background: #1428A0; color: #fff; }
        .sp-time-input {
          padding: 9px 14px; border-radius: 10px;
          border: 2px solid #e2e8f0;
          font-size: 15px; font-weight: 700; color: #0f172a;
          background: #fff; transition: border-color 0.2s;
        }
        .sp-time-input:focus { outline: none; border-color: #1428A0; }
        .sp-pct-input {
          width: 76px; padding: 9px 10px; border-radius: 10px;
          border: 2px solid #e2e8f0; text-align: center;
          font-size: 18px; font-weight: 800; color: #1428A0;
          background: #fff; transition: border-color 0.2s;
        }
        .sp-pct-input:focus { outline: none; border-color: #1428A0; }
        input[type=range] { width:100%; height:4px; border-radius:2px; accent-color:#1428A0; cursor:pointer; }
        .sp-range-marks { display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin-top:6px; font-weight:600; }
        .sp-cost-box { padding:12px 16px; border-radius:12px; background:#fffbeb; border:1px solid #fde68a; margin-top:10px; }
        .sp-save-btn {
          width: 100%; padding: 15px; border-radius: 14px; border: none;
          background: linear-gradient(135deg,#0d1670,#1428A0);
          color: #fff; font-family: inherit; font-size: 15px; font-weight: 800;
          cursor: pointer; transition: all 0.2s; margin-top: 20px;
          box-shadow: 0 4px 12px rgba(20,40,160,0.25);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .sp-save-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(20,40,160,0.35); }
        /* 현재 매장 카드 */
        .sp-store-card { background:#fff; border-radius:16px; border:1.5px solid #e2e8f0; padding:16px; box-shadow:0 2px 8px rgba(20,40,160,0.05); }
        .sp-store-row { display:flex; align-items:center; gap:12px; }
        .sp-store-icon { width:44px; height:44px; background:#ecf0ff; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
        .sp-store-info { flex:1; min-width:0; }
        .sp-store-label { font-size:10px; color:#8b90a0; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:3px; }
        .sp-store-name { font-size:16px; font-weight:800; color:#1a1d2b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sp-store-change { flex-shrink:0; padding:8px 14px; background:#1428A0; color:#fff; border:none; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
        .sp-store-change:active { opacity:0.8; }
        .sp-store-empty { padding:20px; text-align:center; color:#8b90a0; font-size:14px; }
        .sp-store-empty-icon { font-size:32px; margin-bottom:8px; }
        .sp-store-select-btn { width:100%; padding:12px; background:#ecf0ff; color:#1428A0; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; margin-top:8px; }
        .sp-info-card { background:#fff; border-radius:20px; border:none; box-shadow:0 2px 12px rgba(20,40,160,0.07); overflow:hidden; }
        .sp-info-row { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid #f1f5f9; font-size:14px; }
        .sp-info-row:last-child { border-bottom:none; }
        .sp-info-label { font-weight:700; color:#475569; display:flex; align-items:center; gap:8px; }
        .sp-info-value { font-weight:700; color:#0f172a; font-size:13px; }
        .sp-info-value.mono { font-size:12px; color:#94a3b8; font-weight:600; letter-spacing:0.3px; }
        .sp-version-badge {
          display:inline-flex; align-items:center; gap:6px; padding:4px 12px;
          border-radius:20px; background:linear-gradient(90deg,#0d1670,#1428A0);
          color:#fff; font-size:13px; font-weight:800;
        }
        .sp-version-dot {
          width:6px; height:6px; border-radius:50%; background:#F5B731;
          animation: vdot 2s ease-in-out infinite;
        }
        @keyframes vdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
        .sp-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px);
          padding: 12px 24px; border-radius: 24px; background: #1428A0; color: #fff;
          font-size: 14px; font-weight: 700; box-shadow: 0 4px 20px rgba(20,40,160,0.4);
          z-index: 9999; white-space: nowrap; pointer-events: none;
          opacity: 0; transition: all 0.3s;
        }
        .sp-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
        @media (max-width:767px) {
          .sp-header { padding: 18px 16px; border-radius: 14px; }
          .sp-channel-tab { font-size: 11px; padding: 10px 4px; }
          .sp-toast { bottom: 140px; }
          .sp-card { padding: 18px 16px; border-radius: 14px; }
        }
      `}</style>

      <div className="sp">

        {/* 헤더 */}
        <div className="sp-header">
          <div className="sp-header-icon">⚙️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>설정</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>알림 채널 및 앱 정보를 관리합니다</div>
          </div>
        </div>

        {/* ── 현재 활성 매장 ── */}
        <div className="sp-section-label">🏢 현재 활성 매장</div>
        <div className="sp-store-card">
          {activeStore ? (
            <div className="sp-store-row">
              <div className="sp-store-icon">🏢</div>
              <div className="sp-store-info">
                <div className="sp-store-label">근무 중인 매장</div>
                <div className="sp-store-name">{activeStore.name}</div>
              </div>
              <button
                className="sp-store-change"
                onClick={() => window.location.href = "/store-select?change=1&return=/settings"}
              >
                변경
              </button>
            </div>
          ) : (
            <div className="sp-store-empty">
              <div className="sp-store-empty-icon">🏢</div>
              <div>선택된 매장이 없습니다</div>
              <button
                className="sp-store-select-btn"
                onClick={() => window.location.href = "/store-select?return=/settings"}
              >
                매장 선택하기
              </button>
            </div>
          )}
        </div>

        {/* ── 미팍티켓 알림 설정 (DB) ── */}
        <div className="sp-section-label">📲 미팍티켓 알림 설정</div>

        {notifLoading ? (
          <div style={{ textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: 14 }}>
            ⏳ 알림 설정 불러오는 중...
          </div>
        ) : (
          <>
            {/* 역할 뱃지 */}
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                background: userRole === "super_admin" ? "#fffbeb" : userRole === "admin" || userRole === "owner" ? "#eef2ff" : "#f0fdf4",
                color: userRole === "super_admin" ? "#92400e" : userRole === "admin" || userRole === "owner" ? "#1428A0" : "#16A34A",
                border: `1.5px solid ${userRole === "super_admin" ? "#fde68a" : userRole === "admin" || userRole === "owner" ? "#c7d2fe" : "#bbf7d0"}`,
              }}>
                {userRole === "super_admin" ? "⭐ 최고관리자" : userRole === "admin" || userRole === "owner" ? "🛡️ 관리자" : "👷 CREW"}
              </div>
              {isCrew && (
                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                  CREW는 필수 알림을 수신합니다
                </span>
              )}
            </div>

            {/* 전체 OFF (admin/super_admin만) */}
            {isAdmin && (
              <div style={{
                background: notif.push_enabled ? "#eef2ff" : "#fef2f2",
                border: `1.5px solid ${notif.push_enabled ? "#c7d2fe" : "#fecaca"}`,
                borderRadius: 14, padding: "14px 18px", marginBottom: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: notif.push_enabled ? "#1428A0" : "#DC2626" }}>
                    {notif.push_enabled ? "🔔 알림 활성화" : "🔕 전체 알림 OFF"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {notif.push_enabled ? "모든 알림을 수신 중입니다" : "모든 알림이 비활성화되어 있습니다"}
                  </div>
                </div>
                <button
                  onClick={() => setAllNotif(!notif.push_enabled)}
                  style={{
                    width: 50, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
                    background: notif.push_enabled ? "#1428A0" : "#d1d5db", position: "relative",
                    transition: "background 0.2s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: "absolute", top: 4, left: notif.push_enabled ? 26 : 4,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                  }} />
                </button>
              </div>
            )}

            {/* 알림 종류 3가지 */}
            {[
              { key: "notify_entry", icon: "🚗", iconBg: "#eef2ff", title: "입차 알림", desc: "새 차량 입차 시 실시간 알림", required: isCrew },
              { key: "notify_payment", icon: "💳", iconBg: "#fffbeb", title: "결제 알림", desc: "사전결제 완료 시 알림", required: isCrew },
              { key: "notify_exit_request", icon: "🏁", iconBg: "#f0fdf4", title: "출차요청 알림", desc: "출차요청 접수 시 알림", required: isCrew },
            ].map(item => {
              const isOn = item.required ? true : notif[item.key as keyof NotifSettings] as boolean;
              const locked = item.required || (!notif.push_enabled && isAdmin);
              return (
                <div key={item.key} style={{
                  background: "#fff", borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 1px 6px rgba(20,40,160,0.05)",
                  marginBottom: 10, overflow: "hidden",
                  opacity: locked && !item.required ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, background: item.iconBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, flexShrink: 0,
                    }}>{item.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{item.title}</span>
                        {item.required && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                            background: "#dcfce7", color: "#16A34A",
                          }}>필수</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.desc}</div>
                    </div>
                    {item.required ? (
                      <div style={{
                        width: 50, height: 28, borderRadius: 14,
                        background: "#16A34A", position: "relative", flexShrink: 0,
                        opacity: 0.8,
                      }}>
                        <div style={{
                          position: "absolute", top: 4, left: 26,
                          width: 20, height: 20, borderRadius: "50%", background: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </div>
                    ) : (
                      <button
                        onClick={() => !locked && toggleNotif(item.key as keyof NotifSettings)}
                        disabled={locked}
                        style={{
                          width: 50, height: 28, borderRadius: 14, border: "none",
                          cursor: locked ? "not-allowed" : "pointer",
                          background: isOn ? "#1428A0" : "#d1d5db",
                          position: "relative", transition: "background 0.2s", flexShrink: 0,
                        }}
                      >
                        <div style={{
                          position: "absolute", top: 4, left: isOn ? 26 : 4,
                          width: 20, height: 20, borderRadius: "50%", background: "#fff",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                        }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 알림음 / 진동 */}
            <div style={{
              background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0",
              boxShadow: "0 1px 6px rgba(20,40,160,0.05)", marginBottom: 10, overflow: "hidden",
            }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>🎵 수신 방식</span>
              </div>
              {[
                { key: "sound_enabled", icon: "🔊", label: "알림음", desc: "소리로 알림" },
                { key: "vibration_enabled", icon: "📳", label: "진동", desc: "진동으로 알림" },
              ].map(item => {
                const isOn = notif[item.key as keyof NotifSettings] as boolean;
                return (
                  <div key={item.key} style={{
                    display: "flex", alignItems: "center", padding: "13px 18px", gap: 14,
                    borderBottom: item.key === "sound_enabled" ? "1px solid #f1f5f9" : "none",
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => toggleNotif(item.key as keyof NotifSettings)}
                      style={{
                        width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                        background: isOn ? "#1428A0" : "#d1d5db",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, left: isOn ? 23 : 3,
                        width: 20, height: 20, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={saveNotifSettings}
              disabled={notifSaving || !userId}
              style={{
                width: "100%", padding: "13px", borderRadius: 12, border: "none",
                background: notifSaving ? "#94a3b8" : "linear-gradient(135deg,#0d1670,#1428A0)",
                color: "#fff", fontSize: 14, fontWeight: 800, cursor: notifSaving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 12px rgba(20,40,160,0.2)", marginBottom: 8,
                fontFamily: "inherit",
              }}
            >
              {notifSaving ? "⏳ 저장 중..." : "💾 미팍티켓 알림 설정 저장"}
            </button>
            {!userId && (
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginBottom: 8 }}>
                로그인 후 저장할 수 있습니다
              </div>
            )}
          </>
        )}

        {/* ── 알림 설정 ── */}
        <div className="sp-section-label">🔔 알림 설정</div>

        {/* 채널 탭 */}
        <div className="sp-channel-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`sp-channel-tab ${notifTab === t.id ? "active" : ""}`}
              onClick={() => setNotifTab(t.id as any)}
            >
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 크루앱 푸시 */}
        {notifTab === "crew" && (
          <>
            <div className="sp-channel-desc">
              📱 크루앱에 등록된 매장 근무자에게 발송되는 <strong>실시간 푸시 알림</strong>입니다.
              해당 매장에 배정된 크루가 수신 대상입니다.
            </div>
            <NotifRow icon="🚗" iconBg="#eef2ff" title="입차 알림" badge="입차현황" badgeColor={BADGE.blue} sub="차량 입차 감지 즉시 발송" keyName="crew_entry" />
            <NotifRow icon="🏁" iconBg="#f0fdf4" title="출차 알림" badge="입차현황" badgeColor={BADGE.blue} sub="출차 처리 완료 시 발송" keyName="crew_exit" />
          </>
        )}

        {/* 카카오 알림톡 */}
        {notifTab === "kakao" && (
          <>
            <div className="sp-channel-desc">
              💬 차량 소유자에게 카카오 알림톡으로 발송됩니다.<br />
              <strong>정책: 입차 + 정산완료 2회만 발송</strong> (출차 알림 제외)
            </div>
            <NotifRow icon="📩" iconBg="#fffbeb" title="입차 안내" badge="건당 8~15원" badgeColor={BADGE.gold} sub="차량 소유자에게 입차 확인 발송" keyName="kakao_entry" />
            <NotifRow icon="✅" iconBg="#f0fdf4" title="정산 완료" badge="건당 8~15원" badgeColor={BADGE.gold} sub="정산 처리 완료 시 발송" keyName="kakao_settled" />
            <div className="sp-cost-box">
              <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 5 }}>💡 예상 발송 비용</div>
              <div style={{ fontSize: 13, color: "#78350f" }}>
                월 2,000건 기준 약 <strong>3~4만원/월</strong>
                (입차 1,000건 + 정산 1,000건 × 15~20원)
              </div>
            </div>
          </>
        )}

        {/* 관리자 알림 */}
        {notifTab === "admin" && (
          <>
            <div className="sp-channel-desc">
              🔔 관리자 웹에 표시되는 <strong>인앱 알림</strong>입니다. 각 탭의 주요 이벤트 발생 시 알림을 받습니다.
            </div>
            <NotifRow icon="📅" iconBg="#eef2ff" title="월주차 만료 예정" badge="월주차 관리" badgeColor={BADGE.blue} sub="만료 N일 전 자동 알림" keyName="admin_monthly">
              <div className="sp-extra-label">📌 알림 기준일</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[7, 3, 1].map(d => (
                  <div
                    key={d}
                    className={`sp-day-chip ${s.admin_monthly_days.includes(d) ? "on" : ""}`}
                    onClick={() => toggleDay(d)}
                  >
                    D-{d}
                  </div>
                ))}
              </div>
            </NotifRow>

            <NotifRow icon="🚨" iconBg="#fef2f2" title="사고 보고 접수" badge="사고 보고" badgeColor={BADGE.red} sub="새 보고서 등록 시 즉시 발송" keyName="admin_accident" />

            <NotifRow icon="🕐" iconBg="#fff7ed" title="지각 / 결근 발생" badge="근무자 관리" badgeColor={BADGE.orange} sub="정상 출근 체크 위반 시" keyName="admin_lateness" />

            <NotifRow icon="🅿️" iconBg="#f0fdf4" title="주차장 만차 임박" badge="대시보드" badgeColor={BADGE.green} sub="점유율 기준 초과 시 알림" keyName="admin_fullness">
              <div className="sp-extra-label">📊 알림 발생 기준</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="number"
                  className="sp-pct-input"
                  min={50} max={99}
                  value={s.admin_fullness_pct}
                  onChange={e => setS(p => ({ ...p, admin_fullness_pct: Number(e.target.value) }))}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>% 이상 점유 시 알림</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <input
                  type="range" min={50} max={99}
                  value={s.admin_fullness_pct}
                  onChange={e => setS(p => ({ ...p, admin_fullness_pct: Number(e.target.value) }))}
                />
                <div className="sp-range-marks">
                  <span>50%</span><span>70%</span><span>90%</span><span>99%</span>
                </div>
              </div>
            </NotifRow>
          </>
        )}

        {/* 저장 버튼 */}
        <button className="sp-save-btn" onClick={save} disabled={saving} style={{ opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
          <span>{saving ? "⏳" : "💾"}</span> {saving ? "저장 중..." : "알림 설정 저장"}
        </button>

        {/* ── 앱 정보 ── */}
        <div className="sp-section-label">📋 앱 정보</div>

        <div className="sp-info-card">
          {[
            { label: "🏷️ 서비스",    value: "ME.PARK 2.0 관리자",        cls: "" },
            { label: "📅 빌드일",     value: "2026-02-22",                 cls: "mono" },
            { label: "🌐 배포 환경",  value: "Vercel · Production",        cls: "mono" },
            { label: "🗄️ 데이터베이스", value: "Supabase PostgreSQL",      cls: "mono" },
            { label: "💳 결제",       value: "토스페이먼츠 v2",            cls: "mono" },
            { label: "💬 알림톡",     value: "솔라피 (Solapi)",            cls: "mono" },
            { label: "🏢 운영사",     value: "주식회사 미스터팍",          cls: "" },
          ].map((r, i) => (
            <div key={i} className="sp-info-row">
              <div className="sp-info-label">{r.label}</div>
              <div className={`sp-info-value ${r.cls}`}>{r.value}</div>
            </div>
          ))}
          {/* 버전 */}
          <div className="sp-info-row" style={{ order: -1 }}>
            <div className="sp-info-label">📦 버전</div>
            <div className="sp-info-value">
              <span className="sp-version-badge">
                <span className="sp-version-dot" />
                v2.1.0
              </span>
            </div>
          </div>
          {/* 문의 이메일 */}
          <div className="sp-info-row" style={{ cursor: "pointer" }} onClick={copyEmail}>
            <div className="sp-info-label">📞 문의</div>
            <div className="sp-info-value mono" style={{ color: "#1428A0" }}>
              mepark1022@gmail.com ↗
            </div>
          </div>
        </div>

      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`sp-toast ${toast ? "show" : ""}`}>{toast}</div>
      )}
    </AppLayout>
  );
}
