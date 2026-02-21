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
  ), badge: true },
  { id: "monthly", href: "/monthly", label: "월주차 관리", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/><circle cx="12" cy="15" r="1"/></svg>
  )},
  { id: "analytics", href: "/analytics", label: "매출 분석", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
  )},
];

const managementMenuItems = [
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

const allMenuItems = [...defaultMenuItems, ...managementMenuItems];

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = createClient();
  const [menuItems, setMenuItems] = useState(allMenuItems);
  const [editMode, setEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [userName, setUserName] = useState("사용자");
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const saveTimer = useRef<any>(null);

  useEffect(() => { loadMenuOrder(); }, []);

  async function loadMenuOrder() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (user.email) setUserEmail(user.email);
    const { data: profile } = await supabase.from("profiles").select("menu_order, name, role").eq("id", user.id).single();
    if (profile) {
      if (profile.name) setUserName(profile.name);
      if (profile.role) setUserRole(profile.role);
      if (profile.menu_order && Array.isArray(profile.menu_order)) {
        const ordered = [];
        for (const id of profile.menu_order) {
          const item = allMenuItems.find((m) => m.id === id);
          if (item) ordered.push(item);
        }
        for (const item of allMenuItems) {
          if (!ordered.find((o) => o.id === item.id)) ordered.push(item);
        }
        setMenuItems(ordered);
      }
    }
  }

  async function saveMenuOrder(items: typeof allMenuItems) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ menu_order: items.map((m) => m.id) }).eq("id", user.id);
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setOverIdx(idx); }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return; }
    const newItems = [...menuItems];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    setMenuItems(newItems);
    setDragIdx(null); setOverIdx(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMenuOrder(newItems), 300);
  }
  function handleDragEnd() { setDragIdx(null); setOverIdx(null); }
  function resetOrder() { setMenuItems(allMenuItems); saveMenuOrder(allMenuItems); }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const roleLabel = userRole === "admin" ? "Admin" : userRole === "crew" ? "CREW" : userRole;

  // Split items: first 5 are main, rest are management
  const mainItems = menuItems.filter((m) => defaultMenuItems.some((d) => d.id === m.id));
  const mgmtItems = menuItems.filter((m) => managementMenuItems.some((d) => d.id === m.id));
  const allOrdered = editMode ? menuItems : [...mainItems, null, ...mgmtItems]; // null = divider

  return (
    <aside className="v3-sidebar">
      {/* Logo */}
      <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "center" }}>
        <LogoGNB theme="dark" />
      </div>

      {/* Edit Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 4px" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase" }}>메뉴</span>
        <button
          onClick={() => setEditMode(!editMode)}
          style={{
            fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", borderRadius: 4, padding: "3px 10px",
            background: editMode ? "#fff" : "#F5B731",
            color: editMode ? "#1428A0" : "#0a1352",
          }}
        >
          {editMode ? "완료" : "순서편집"}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px 14px", overflowY: "auto" }}>
        {editMode ? (
          // Edit mode: flat list with drag
          menuItems.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              style={{
                opacity: dragIdx === idx ? 0.4 : 1,
                borderTop: overIdx === idx && dragIdx !== idx ? "2px solid #F5B731" : "2px solid transparent",
              }}
            >
              <div className="v3-nav-item" style={{ cursor: "grab" }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginRight: -4 }}>☰</span>
                <span style={{ display: "flex", alignItems: "center", width: 22 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </div>
          ))
        ) : (
          // Normal mode: grouped with divider
          <>
            {mainItems.map((item) => (
              <Link key={item.id} href={item.href} className={`v3-nav-item ${isActive(item.href) ? "active" : ""}`}>
                <span style={{ display: "flex", alignItems: "center", width: 22 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && <span className="v3-nav-badge">12</span>}
              </Link>
            ))}

            <div className="v3-nav-divider" />
            <div className="v3-nav-section-title">관리</div>

            {mgmtItems.map((item) => (
              <Link key={item.id} href={item.href} className={`v3-nav-item ${isActive(item.href) ? "active" : ""}`}>
                <span style={{ display: "flex", alignItems: "center", width: 22 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 9, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>2</span>
                )}
              </Link>
            ))}
          </>
        )}

        {editMode && (
          <button onClick={resetOrder} style={{ width: "100%", marginTop: 8, padding: "8px 0", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            기본 순서로 초기화
          </button>
        )}
      </nav>

      {/* Guide Button */}
      <div style={{ padding: "0 14px 8px" }}>
        <Link href="/guide" className={`v3-nav-item v3-nav-highlight ${isActive("/guide") ? "active" : ""}`}>
          <span style={{ background: "#F5B731", width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#0a1352", flexShrink: 0 }}>?</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>ME.PARK 2.0 기능안내</span>
        </Link>
      </div>

      {/* User Footer */}
      <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,0.05)" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F5B731", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#1a237e", fontSize: 18, flexShrink: 0 }}>
            {userName.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{userName}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
            <span style={{ display: "inline-flex", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(245,183,49,0.2)", color: "#F5B731" }}>{roleLabel}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
