// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";

export default function SettingsPage() {
  const [notifTab, setNotifTab] = useState<"crew"|"kakao"|"admin">("crew");
  const [toast, setToast] = useState("");

  const [s, setS] = useState({
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
  });

  const toggle = (key: string) => setS(p => ({ ...p, [key]: !p[key] }));
  const toggleDay = (d: number) => setS(p => ({
    ...p,
    admin_monthly_days: p.admin_monthly_days.includes(d)
      ? p.admin_monthly_days.filter(x => x !== d)
      : [...p.admin_monthly_days, d].sort((a, b) => b - a),
  }));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const save = () => showToast("✅ 알림 설정이 저장되었습니다");
  const copyEmail = () => {
    navigator.clipboard?.writeText("mepark1022@gmail.com").catch(() => {});
    showToast("📋 이메일이 복사되었습니다");
  };

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      style={{
        width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
        background: on ? "var(--navy)" : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: on ? 25 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s",
      }} />
    </button>
  );

  const NotifRow = ({ icon, iconBg, title, sub, badge, badgeColor, keyName, children }: any) => {
    const isOn = s[keyName];
    return (
      <div className="notif-row-card">
        <div className="notif-row-header">
          <div className="notif-icon-wrap" style={{ background: iconBg }}>{icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="notif-title">{title}</div>
            <div className="notif-sub">
              <span className="notif-badge" style={badgeColor}>{badge}</span>
              {sub}
            </div>
          </div>
          <Toggle on={isOn} onToggle={() => toggle(keyName)} />
        </div>
        {isOn && children && (
          <div className="notif-row-extra">{children}</div>
        )}
      </div>
    );
  };

  const BADGE = {
    blue:   { background: "rgba(20,40,160,0.08)", color: "#1428A0" },
    gold:   { background: "#fffbeb", color: "#92400e" },
    green:  { background: "#dcfce7", color: "#16A34A" },
    red:    { background: "#fee2e2", color: "#DC2626" },
    orange: { background: "#fff7ed", color: "#EA580C" },
  };

  const TABS = [
    { id: "crew",  emoji: "📱", label: "크루앱 푸시" },
    { id: "kakao", emoji: "💬", label: "카카오 알림톡" },
    { id: "admin", emoji: "🔔", label: "관리자 알림" },
  ];

  return (
    <AppLayout>
      <style>{`
        /* ── 설정 페이지 ── */
        .settings-wrap { max-width: 760px; margin: 0 auto; padding-bottom: 100px; }

        /* 헤더 카드 */
        .settings-hero {
          background: linear-gradient(135deg, #020617 0%, #0a1352 50%, var(--navy) 100%);
          border-radius: 18px; padding: 22px 24px;
          display: flex; align-items: center; gap: 16px;
          margin-bottom: 24px;
          box-shadow: 0 4px 16px rgba(20,40,160,0.18);
        }
        .settings-hero-icon {
          width: 50px; height: 50px; border-radius: 14px;
          background: var(--gold); display: flex; align-items: center;
          justify-content: center; font-size: 24px; flex-shrink: 0;
        }

        /* 섹션 구분 */
        .settings-section-label {
          font-size: 11px; font-weight: 800; letter-spacing: 1.2px;
          color: var(--text-muted); text-transform: uppercase;
          padding: 0 4px; margin: 28px 0 12px;
          display: flex; align-items: center; gap: 10px;
        }
        .settings-section-label::after {
          content: ''; flex: 1; height: 1px; background: var(--border);
        }

        /* 채널 탭 */
        .channel-tabs {
          display: grid; grid-template-columns: repeat(3, 1fr);
          border-radius: 14px; overflow: hidden;
          border: 1px solid var(--border); margin-bottom: 14px;
          box-shadow: var(--shadow-sm);
        }
        .channel-tab {
          padding: 14px 8px; border: none; background: #fff;
          font-family: inherit; font-size: 12px; font-weight: 700;
          cursor: pointer; color: var(--text-muted); transition: all 0.18s;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          border-right: 1px solid var(--border);
        }
        .channel-tab:last-child { border-right: none; }
        .channel-tab.active { background: var(--navy); color: #fff; }
        .channel-tab .tab-emoji { font-size: 20px; line-height: 1; }

        /* 채널 설명 박스 */
        .channel-desc {
          padding: 12px 16px; background: var(--bg-card);
          border-radius: 10px; border: 1px dashed var(--border);
          font-size: 12.5px; color: var(--text-secondary);
          line-height: 1.7; margin-bottom: 12px;
        }

        /* 알림 항목 카드 */
        .notif-row-card {
          background: #fff; border-radius: 14px;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
          overflow: hidden; margin-bottom: 10px;
        }
        .notif-row-header {
          display: flex; align-items: center;
          padding: 15px 18px; gap: 13px;
        }
        .notif-icon-wrap {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 19px; flex-shrink: 0;
        }
        .notif-title { font-size: 14px; font-weight: 800; color: var(--text-primary); margin-bottom: 3px; }
        .notif-sub { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
        .notif-badge {
          font-size: 10px; font-weight: 800;
          padding: 2px 8px; border-radius: 20px;
        }
        .notif-row-extra {
          padding: 12px 18px 16px;
          border-top: 1px solid var(--border-light);
          background: var(--bg-card);
        }
        .extra-label { font-size: 11px; font-weight: 800; color: var(--text-secondary); margin-bottom: 10px; }

        /* D-day 칩 */
        .day-chip {
          padding: 7px 16px; border-radius: 20px;
          border: 2px solid var(--border); background: #fff;
          color: var(--text-secondary); font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; user-select: none;
          display: inline-block;
        }
        .day-chip.on { border-color: var(--navy); background: var(--navy); color: #fff; }

        /* 시간/퍼센트 입력 */
        .settings-time-input {
          padding: 9px 14px; border-radius: 10px;
          border: 2px solid var(--border);
          font-size: 15px; font-weight: 700; color: var(--text-primary);
          background: #fff; transition: border-color 0.2s; font-family: inherit;
        }
        .settings-time-input:focus { outline: none; border-color: var(--navy); }
        .settings-pct-input {
          width: 76px; padding: 9px 10px; border-radius: 10px;
          border: 2px solid var(--border); text-align: center;
          font-size: 18px; font-weight: 800; color: var(--navy);
          background: #fff; transition: border-color 0.2s; font-family: inherit;
        }
        .settings-pct-input:focus { outline: none; border-color: var(--navy); }
        input[type=range] { width: 100%; height: 4px; border-radius: 2px; accent-color: var(--navy); cursor: pointer; }
        .range-marks { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 6px; font-weight: 600; }

        /* 비용 박스 */
        .cost-box {
          padding: 12px 16px; border-radius: 12px;
          background: #fffbeb; border: 1px solid #fde68a; margin-top: 10px;
        }

        /* 저장 버튼 */
        .settings-save-btn {
          width: 100%; padding: 15px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #0d1670, var(--navy));
          color: #fff; font-family: inherit; font-size: 15px; font-weight: 800;
          cursor: pointer; transition: all 0.2s; margin-top: 20px;
          box-shadow: 0 4px 12px rgba(20,40,160,0.25);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .settings-save-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(20,40,160,0.35); }
        .settings-save-btn:active { transform: translateY(0); }

        /* 앱 정보 카드 */
        .info-card { background: #fff; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); overflow: hidden; }
        .info-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid var(--border-light);
          font-size: 14px;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 8px; }
        .info-value { font-weight: 700; color: var(--text-primary); font-size: 13px; }
        .info-value.mono { font-size: 12px; color: var(--text-muted); font-weight: 600; letter-spacing: 0.3px; }
        .version-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 20px;
          background: linear-gradient(90deg, #0d1670, var(--navy));
          color: #fff; font-size: 13px; font-weight: 800;
        }
        .version-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--gold);
          animation: vdot 2s ease-in-out infinite;
        }
        @keyframes vdot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }

        /* 토스트 */
        .settings-toast {
          position: fixed; bottom: 24px; left: 50%;
          transform: translateX(-50%) translateY(20px);
          padding: 12px 24px; border-radius: 24px;
          background: var(--navy); color: #fff;
          font-size: 14px; font-weight: 700;
          box-shadow: 0 4px 20px rgba(20,40,160,0.4);
          z-index: 9999; white-space: nowrap; pointer-events: none;
          opacity: 0; transition: all 0.3s;
        }
        .settings-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

        /* ── 모바일 v3 ── */
        @media (max-width: 767px) {
          .settings-wrap { padding: 0 0 100px; }

          /* 헤더 */
          .settings-hero {
            border-radius: 0 0 20px 20px;
            margin: -16px -16px 20px;
            padding: 20px 20px 20px;
          }
          .settings-hero-icon { width: 44px; height: 44px; font-size: 20px; }

          /* 채널 탭: 아이콘 강조 */
          .channel-tab { padding: 12px 6px; font-size: 11px; }
          .channel-tab .tab-emoji { font-size: 22px; }

          /* 섹션 레이블 */
          .settings-section-label { margin: 24px 0 10px; }

          /* 알림 카드 */
          .notif-row-header { padding: 14px 16px; gap: 11px; }
          .notif-icon-wrap { width: 38px; height: 38px; font-size: 17px; }
          .notif-title { font-size: 13.5px; }
          .notif-row-extra { padding: 12px 16px 14px; }

          /* 앱 정보 카드 */
          .info-row { padding: 13px 16px; }
          .info-label { font-size: 13px; }
          .info-value { font-size: 12.5px; }
          .info-value.mono { font-size: 11.5px; }

          /* D-day 칩 */
          .day-chip { padding: 6px 14px; font-size: 12px; }

          /* 저장 버튼 - 모바일 하단 고정 */
          .settings-save-btn {
            position: fixed; bottom: 64px; left: 12px; right: 12px;
            width: auto; margin: 0;
            border-radius: 14px; z-index: 40;
            box-shadow: 0 6px 20px rgba(20,40,160,0.35);
          }

          /* 토스트: 모바일에선 더 위로 */
          .settings-toast { bottom: 130px; }
        }
      `}</style>

      <div className="settings-wrap">

        {/* ── 헤더 ── */}
        <div className="settings-hero">
          <div className="settings-hero-icon">⚙️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>설정</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>알림 채널 및 앱 정보를 관리합니다</div>
          </div>
        </div>

        {/* ── 알림 설정 ── */}
        <div className="settings-section-label">🔔 알림 설정</div>

        {/* 채널 탭 */}
        <div className="channel-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`channel-tab ${notifTab === t.id ? "active" : ""}`}
              onClick={() => setNotifTab(t.id as any)}
            >
              <span className="tab-emoji">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 크루앱 푸시 */}
        {notifTab === "crew" && (
          <>
            <div className="channel-desc">
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
            <div className="channel-desc">
              💬 차량 소유자에게 카카오 알림톡으로 발송됩니다.<br />
              <strong>정책: 입차 + 정산완료 2회만 발송</strong> (출차 알림 제외)
            </div>
            <NotifRow icon="📩" iconBg="#fffbeb" title="입차 안내" badge="건당 8~15원" badgeColor={BADGE.gold} sub="차량 소유자에게 입차 확인 발송" keyName="kakao_entry" />
            <NotifRow icon="✅" iconBg="#f0fdf4" title="정산 완료" badge="건당 8~15원" badgeColor={BADGE.gold} sub="정산 처리 완료 시 발송" keyName="kakao_settled" />
            <div className="cost-box">
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
            <div className="channel-desc">
              🔔 관리자 웹에 표시되는 <strong>인앱 알림</strong>입니다. 각 탭의 주요 이벤트 발생 시 알림을 받습니다.
            </div>
            <NotifRow icon="📅" iconBg="#eef2ff" title="월주차 만료 예정" badge="월주차 관리" badgeColor={BADGE.blue} sub="만료 N일 전 자동 알림" keyName="admin_monthly">
              <div className="extra-label">📌 알림 기준일</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[7, 3, 1].map(d => (
                  <div
                    key={d}
                    className={`day-chip ${s.admin_monthly_days.includes(d) ? "on" : ""}`}
                    onClick={() => toggleDay(d)}
                  >
                    D-{d}
                  </div>
                ))}
              </div>
            </NotifRow>

            <NotifRow icon="⚠️" iconBg="#fff7ed" title="미정산 경고" badge="데이터 입력" badgeColor={BADGE.orange} sub="전일 미입력 매장 발생 시" keyName="admin_unsettled">
              <div className="extra-label">⏰ 알림 발송 시간</div>
              <input
                type="time"
                className="settings-time-input"
                value={s.admin_unsettled_time}
                onChange={e => setS(p => ({ ...p, admin_unsettled_time: e.target.value }))}
              />
            </NotifRow>

            <NotifRow icon="🚨" iconBg="#fef2f2" title="사고 보고 접수" badge="사고 보고" badgeColor={BADGE.red} sub="새 보고서 등록 시 즉시 발송" keyName="admin_accident" />

            <NotifRow icon="🕐" iconBg="#fff7ed" title="지각 / 결근 발생" badge="근무자 관리" badgeColor={BADGE.orange} sub="정상 출근 체크 위반 시" keyName="admin_lateness" />

            <NotifRow icon="🅿️" iconBg="#f0fdf4" title="주차장 만차 임박" badge="대시보드" badgeColor={BADGE.green} sub="점유율 기준 초과 시 알림" keyName="admin_fullness">
              <div className="extra-label">📊 알림 발생 기준</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="number"
                  className="settings-pct-input"
                  min={50} max={99}
                  value={s.admin_fullness_pct}
                  onChange={e => setS(p => ({ ...p, admin_fullness_pct: Number(e.target.value) }))}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>% 이상 점유 시 알림</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <input
                  type="range" min={50} max={99}
                  value={s.admin_fullness_pct}
                  onChange={e => setS(p => ({ ...p, admin_fullness_pct: Number(e.target.value) }))}
                />
                <div className="range-marks">
                  <span>50%</span><span>70%</span><span>90%</span><span>99%</span>
                </div>
              </div>
            </NotifRow>
          </>
        )}

        {/* 저장 버튼 */}
        <button className="settings-save-btn" onClick={save}>
          <span>💾</span> 알림 설정 저장
        </button>

        {/* ── 앱 정보 ── */}
        <div className="settings-section-label" style={{ marginTop: 48 }}>📋 앱 정보</div>

        <div className="info-card">
          {/* 버전 */}
          <div className="info-row">
            <div className="info-label">📦 버전</div>
            <div className="info-value">
              <span className="version-badge">
                <span className="version-dot" />
                v2.1.0
              </span>
            </div>
          </div>
          {[
            { label: "🏷️ 서비스",      value: "ME.PARK 2.0 관리자",    cls: "" },
            { label: "📅 빌드일",       value: "2026-02-22",             cls: "mono" },
            { label: "🌐 배포 환경",    value: "Vercel · Production",    cls: "mono" },
            { label: "🗄️ 데이터베이스", value: "Supabase PostgreSQL",    cls: "mono" },
            { label: "💳 결제",         value: "토스페이먼츠 v2",        cls: "mono" },
            { label: "💬 알림톡",       value: "솔라피 (Solapi)",        cls: "mono" },
            { label: "🏢 운영사",       value: "주식회사 미스터팍",      cls: "" },
          ].map((r, i) => (
            <div key={i} className="info-row">
              <div className="info-label">{r.label}</div>
              <div className={`info-value ${r.cls}`}>{r.value}</div>
            </div>
          ))}
          {/* 문의 이메일 */}
          <div className="info-row" style={{ cursor: "pointer" }} onClick={copyEmail}>
            <div className="info-label">📞 문의</div>
            <div className="info-value mono" style={{ color: "var(--navy)" }}>
              mepark1022@gmail.com ↗
            </div>
          </div>
        </div>

      </div>

      {/* 토스트 */}
      <div className={`settings-toast ${toast ? "show" : ""}`}>{toast}</div>
    </AppLayout>
  );
}
