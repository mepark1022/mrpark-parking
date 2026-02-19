// @ts-nocheck
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { LogoGNB } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

const defaultMenuItems = [
  { id: "dashboard", href: "/dashboard", label: "대시보드", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  )},
  { id: "entry", href: "/entry", label: "데이터 입력", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  )},
  { id: "parking-status", href: "/parking-status", label: "입차 현황", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="7" rx="2"/><path d="M5 11l2-5h10l2 5"/><circle cx="7.5" cy="15.5" r="1.5"/><circle cx="16.5" cy="15.5" r="1.5"/></svg>
  )},
  { id: "monthly", href: "/monthly", label: "월주차 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><circle cx="12" cy="15" r="1"/></svg>
  )},
  { id: "analytics", href: "/analytics", label: "매출 분석", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  )},
  { id: "workers", href: "/workers", label: "근무자 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
  )},
  { id: "stores", href: "/stores", label: "매장 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  )},
  { id: "team", href: "/team", label: "팀원 초대", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
  )},
  { id: "accident", href: "/accident", label: "사고보고", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ), badge: true },
  { id: "settings", href: "/settings", label: "설정", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
  )},
];

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();
  const [menuItems, setMenuItems] = useState(defaultMenuItems);
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [userName, setUserName] = useState("사용자");
  const [userRole, setUserRole] = useState("관리자");
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    loadMenuOrder();
  }, []);

  async function loadMenuOrder() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("menu_order, name, role").eq("id", user.id).single();
    if (profile) {
      if (profile.name) setUserName(profile.name);
      if (profile.role) setUserRole(profile.role === "admin" ? "관리자" : profile.role === "crew" ? "CREW" : profile.role);
      if (profile.menu_order && Array.isArray(profile.menu_order)) {
        // 저장된 순서로 메뉴 재배열
        const ordered = [];
        for (const id of profile.menu_order) {
          const item = defaultMenuItems.find((m) => m.id === id);
          if (item) ordered.push(item);
        }
        // 새로 추가된 메뉴가 있으면 뒤에 추가
        for (const item of defaultMenuItems) {
          if (!ordered.find((o) => o.id === item.id)) ordered.push(item);
        }
        setMenuItems(ordered);
      }
    }
  }

  async function saveMenuOrder(items: typeof defaultMenuItems) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const order = items.map((m) => m.id);
    await supabase.from("profiles").update({ menu_order: order }).eq("id", user.id);
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const newItems = [...menuItems];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    setMenuItems(newItems);
    setDragIdx(null);
    setOverIdx(null);
    // 디바운스 저장 (300ms)
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMenuOrder(newItems), 300);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setOverIdx(null);
  }

  function resetOrder() {
    setMenuItems(defaultMenuItems);
    saveMenuOrder(defaultMenuItems);
  }

  return (
    <aside
      className="w-60 h-screen flex flex-col fixed top-0 left-0 z-50"
      style={{ background: "linear-gradient(180deg, #020617 0%, #0a1352 30%, #0f1d6b 70%, #162050 100%)" }}
    >
      {/* Decorative glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -60, left: -60, width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,183,49,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="p-6 pb-5">
        <LogoGNB theme="dark" />
      </div>

      {/* Menu Label + Edit Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 6px" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>메뉴</span>
        <button
          onClick={() => setEditMode(!editMode)}
          style={{
            fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", borderRadius: 4, padding: "3px 10px",
            background: editMode ? "#fff" : "#F5B731",
            color: editMode ? "#1428A0" : "#0a1352",
            transition: "all 0.15s",
          }}
        >
          {editMode ? "완료" : "순서편집"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5" style={{ overflowY: "auto" }}>
        {menuItems.map((item, idx) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;

          return (
            <div
              key={item.id}
              draggable={editMode}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              style={{
                opacity: isDragging ? 0.4 : 1,
                borderTop: isOver ? "2px solid #F5B731" : "2px solid transparent",
                transition: "border 0.1s, opacity 0.1s",
                cursor: editMode ? "grab" : undefined,
              }}
            >
              <Link
                href={editMode ? "#" : item.href}
                onClick={(e) => editMode && e.preventDefault()}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 relative"
                style={{
                  background: isActive && !editMode ? "rgba(255,255,255,0.15)" : undefined,
                  color: "#fff",
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 15,
                }}
              >
                {/* 편집 모드: 드래그 핸들 */}
                {editMode && (
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginRight: -4, cursor: "grab" }}>☰</span>
                )}
                {isActive && !editMode && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    style={{ width: 3, height: 20, borderRadius: "0 3px 3px 0", background: "#F5B731" }}
                  />
                )}
                <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && !editMode && (
                  <span
                    className="ml-auto flex items-center justify-center"
                    style={{
                      width: 18, height: 18, borderRadius: 9,
                      background: "#dc2626", color: "#fff",
                      fontSize: 10, fontWeight: 700,
                    }}
                  >2</span>
                )}
              </Link>
            </div>
          );
        })}

        {/* 편집 모드: 초기화 버튼 */}
        {editMode && (
          <button
            onClick={resetOrder}
            style={{
              width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 10,
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            기본 순서로 초기화
          </button>
        )}
      </nav>

      {/* 기능안내 버튼 */}
      <div className="px-3 py-3">
        <Link
          href="/guide"
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-150"
          style={{
            background: "linear-gradient(135deg, rgba(245,183,49,0.15) 0%, rgba(245,183,49,0.05) 100%)",
            border: "1px solid rgba(245,183,49,0.25)",
          }}
        >
          <span style={{ background: "#F5B731", width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#0a1352", flexShrink: 0 }}>?</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F5B731" }}>ME.PARK 2.0 기능안내</span>
        </Link>
      </div>

      {/* User */}
      <div className="p-4 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#F5B731", fontSize: 15, fontWeight: 800, color: "#0a1352",
          }}
        >{userName.charAt(0)}</div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">{userName}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{userRole}</div>
        </div>
      </div>
    </aside>
  );
}
