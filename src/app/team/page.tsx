// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Profile = { id: string; email: string; name: string; role: string; status: string; created_at: string };

const ROLE_CONFIG: Record<string, { bg: string; color: string; border: string; label: string; desc: string; icon: string }> = {
  super_admin: { bg: "#fef3c7", color: "#b45309", border: "#fcd34d", label: "최고관리자", desc: "모든 기능 접근 + 팀원 관리", icon: "👑" },
  admin:       { bg: "#EEF2FF", color: "#1428A0", border: "#c7d2fe", label: "관리자",    desc: "매장 관리 및 데이터 조회", icon: "🔑" },
  crew:        { bg: "#dcfce7", color: "#15803d", border: "#bbf7d0", label: "CREW",      desc: "배정 매장 데이터 입력만",  icon: "👤" },
};

// 인라인 역할 드롭다운 컴포넌트
function RoleDropdown({ profile, currentUserRole, currentUserId, onRoleChange }: {
  profile: Profile;
  currentUserRole: string;
  currentUserId: string;
  onRoleChange: (profileId: string, newRole: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const canChange = () => {
    if (profile.id === currentUserId) return false;
    if (currentUserRole === "super_admin") return true;
    if (currentUserRole === "admin" && profile.role === "crew") return true;
    return false;
  };

  const availableRoles = () => {
    if (currentUserRole === "super_admin") return ["crew", "admin", "super_admin"];
    if (currentUserRole === "admin") return ["crew", "admin"];
    return [];
  };

  const cfg = ROLE_CONFIG[profile.role] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", label: profile.role, desc: "", icon: "👤" };

  if (!canChange()) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
        {cfg.icon} {cfg.label}
      </span>
    );
  }

  async function handleSelect(newRole: string) {
    if (newRole === profile.role) { setOpen(false); return; }
    setConfirming(newRole);
  }

  async function handleConfirm() {
    if (!confirming) return;
    setSaving(true);
    await onRoleChange(profile.id, confirming);
    setSaving(false);
    setOpen(false);
    setConfirming(null);
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => { setOpen(!open); setConfirming(null); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
          borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
          background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.border}`,
          transition: "all 0.15s"
        }}
      >
        {cfg.icon} {cfg.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 2, opacity: 0.6 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
          background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          border: "1px solid #e2e8f0", minWidth: 200, padding: 6, overflow: "hidden"
        }}>
          {!confirming ? (
            <>
              <div style={{ padding: "6px 10px 4px", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>권한 변경</div>
              {availableRoles().map((role) => {
                const rc = ROLE_CONFIG[role];
                const isCurrent = role === profile.role;
                return (
                  <button
                    key={role}
                    onClick={() => handleSelect(role)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                      background: isCurrent ? rc.bg : "transparent",
                      transition: "background 0.12s"
                    }}
                    onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: rc.bg, fontSize: 14, flexShrink: 0 }}>{rc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isCurrent ? rc.color : "#374151" }}>{rc.label}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{rc.desc}</div>
                    </div>
                    {isCurrent && <span style={{ width: 18, height: 18, borderRadius: "50%", background: rc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 900, flexShrink: 0 }}>✓</span>}
                  </button>
                );
              })}
              {currentUserRole === "admin" && (
                <div style={{ margin: "4px 6px 2px", padding: "8px 10px", borderRadius: 8, background: "#f1f5f9", fontSize: 11, color: "#64748b" }}>
                  🔒 최고관리자 권한은 Super Admin만 변경 가능
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>권한 변경 확인</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: ROLE_CONFIG[profile.role]?.bg, color: ROLE_CONFIG[profile.role]?.color }}>
                  {ROLE_CONFIG[profile.role]?.label}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>→</span>
                <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: ROLE_CONFIG[confirming]?.bg, color: ROLE_CONFIG[confirming]?.color }}>
                  {ROLE_CONFIG[confirming]?.label}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
                <strong>{profile.name || profile.email}</strong>님의<br/>권한을 변경하시겠습니까?
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setConfirming(null)}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
                >취소</button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", background: "#1428A0", fontSize: 12, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
                >{saving ? "저장..." : "확인"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
type Invitation = { id: string; email: string; role: string; status: string; created_at: string; updated_at: string; token: string; store_id: string; stores?: { name: string } };
type Store = { id: string; name: string };
type StoreMember = { id: string; user_id: string; store_id: string };

export default function TeamPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeMembers, setStoreMembers] = useState<StoreMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [sending, setSending] = useState(false);

  // 초대 모달
  const [showInvite, setShowInvite] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "direct">("email"); // 이메일 초대 vs 직접 생성
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>([]);

  // 매장 배정 모달
  const [showAssign, setShowAssign] = useState(false);
  const [assignProfile, setAssignProfile] = useState<Profile | null>(null);

  // 생성 완료 팝업 (아이디/비번 표시)
  const [createdAccount, setCreatedAccount] = useState<{ name: string; email: string; password: string } | null>(null);

  // 비밀번호 재설정 모달
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [assignStoreIds, setAssignStoreIds] = useState<string[]>([]);

  // 멤버 제거 확인
  const [removeTarget, setRemoveTarget] = useState<Profile | null>(null);

  // 초대 매핑
  const [inviteMap, setInviteMap] = useState<Record<string, { invited: string; accepted: string }>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (myProfile) setCurrentUserRole(myProfile.role);
    }

    const [profilesRes, invitationsRes, storesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", oid).order("created_at"),
      supabase.from("invitations").select("*, stores(name)").eq("org_id", oid).order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").eq("org_id", oid).eq("is_active", true).order("name"),
      supabase.from("store_members").select("*").eq("org_id", oid),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (storesRes.data) setStores(storesRes.data);
    if (membersRes.data) setStoreMembers(membersRes.data);

    if (invitationsRes.data) {
      setInvitations(invitationsRes.data);
      const map: Record<string, { invited: string; accepted: string }> = {};
      invitationsRes.data.forEach((inv) => {
        if (inv.status === "accepted") {
          if (!map[inv.email] || new Date(inv.updated_at || inv.created_at) > new Date(map[inv.email].accepted)) {
            map[inv.email] = { invited: inv.created_at, accepted: inv.updated_at || inv.created_at };
          }
        }
      });
      setInviteMap(map);
    }
    setLoading(false);
  }

  // 해당 유저의 배정매장 이름 목록
  function getMemberStores(userId: string): string[] {
    const memberStoreIds = storeMembers.filter(m => m.user_id === userId).map(m => m.store_id);
    return stores.filter(s => memberStoreIds.includes(s.id)).map(s => s.name);
  }

  // --- 초대 ---
  async function handleInvite() {
    if (!inviteEmail) return;
    if (inviteRole === "crew" && inviteStoreIds.length === 0) {
      setMessage({ text: "CREW는 배정 매장을 선택해주세요.", type: "error" });
      return;
    }
    setSending(true);
    setMessage({ text: "", type: "" });
    try {
      // 첫 번째 매장으로 초대 생성 (store_id는 첫 매장)
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          storeId: inviteStoreIds[0] || null,
          storeIds: inviteStoreIds,
          invitedBy: currentUserId,
          orgId: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessage({ text: data.error || "초대 실패", type: "error" });
      } else if (data.emailSent) {
        setMessage({ text: `${inviteEmail}로 초대 이메일을 발송했습니다!`, type: "success" });
        setInviteEmail(""); setInviteRole("admin"); setInviteStoreIds([]); setShowInvite(false);
        loadData();
      } else {
        setMessage({ text: `초대 생성됨. 이메일 발송 실패: ${data.emailError || ""}`, type: "warning" });
        loadData();
      }
    } catch (e) { setMessage({ text: "서버 오류", type: "error" }); }
    setSending(false);
  }

  // --- 계정 직접 생성 ---
  async function handleDirectCreate() {
    if (!inviteEmail || !inviteName || !invitePassword) return;
    if (invitePassword.length < 6) {
      setMessage({ text: "비밀번호는 6자 이상이어야 합니다.", type: "error" });
      return;
    }
    if (inviteRole === "crew" && inviteStoreIds.length === 0) {
      setMessage({ text: "CREW는 배정 매장을 선택해주세요.", type: "error" });
      return;
    }
    setSending(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch("/api/team/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          password: invitePassword,
          name: inviteName,
          role: inviteRole,
          orgId: orgId,
          storeIds: inviteStoreIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessage({ text: data.error || "계정 생성 실패", type: "error" });
      } else {
        setCreatedAccount({ name: inviteName, email: inviteEmail, password: invitePassword });
        setInviteEmail(""); setInviteName(""); setInvitePassword(""); setInviteRole("admin"); setInviteStoreIds([]); setShowInvite(false);
        loadData();
      }
    } catch (e) { setMessage({ text: "서버 오류", type: "error" }); }
    setSending(false);
  }

  function toggleInviteStore(storeId: string) {
    setInviteStoreIds(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
  }

  // --- 비밀번호 재설정 ---
  async function handleResetPassword() {
    if (!resetTarget || !resetPassword) return;
    if (resetPassword.length < 6) {
      setMessage({ text: "비밀번호는 6자 이상이어야 합니다.", type: "error" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/team/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget.id, newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMessage({ text: data.error || "비밀번호 재설정 실패", type: "error" });
      } else {
        setCreatedAccount({ name: resetTarget.name, email: resetTarget.email, password: resetPassword });
        setResetTarget(null);
        setResetPassword("");
      }
    } catch (e) { setMessage({ text: "서버 오류", type: "error" }); }
    setSending(false);
  }

  async function cancelInvitation(id: string) {
    await supabase.from("invitations").update({ status: "rejected" }).eq("id", id);
    loadData();
  }

  async function deleteInvitation(id: string) {
    if (!confirm("이 초대 기록을 삭제하시겠습니까?")) return;
    await supabase.from("invitations").delete().eq("id", id);
    loadData();
  }

  async function resendInvitation(inv: Invitation) {
    setSending(true);
    try {
      await supabase.from("invitations").update({ status: "rejected" }).eq("id", inv.id);
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inv.email, role: inv.role, storeId: inv.store_id || null, invitedBy: currentUserId, orgId }),
      });
      const data = await res.json();
      setMessage({ text: data.emailSent ? `${inv.email} 재발송 완료` : "재발송 실패", type: data.emailSent ? "success" : "error" });
      loadData();
    } catch (e) { setMessage({ text: "재발송 오류", type: "error" }); }
    setSending(false);
  }

  function openAssignModal(profile: Profile) {
    const currentStoreIds = storeMembers.filter(m => m.user_id === profile.id).map(m => m.store_id);
    setAssignProfile(profile);
    setAssignStoreIds(currentStoreIds);
    setShowAssign(true);
  }

  function toggleAssignStore(storeId: string) {
    setAssignStoreIds(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
  }

  async function saveAssignment() {
    if (!assignProfile || !orgId) return;
    setSending(true);
    const userId = assignProfile.id;
    const currentIds = storeMembers.filter(m => m.user_id === userId).map(m => m.store_id);
    const toAdd = assignStoreIds.filter(id => !currentIds.includes(id));
    const toRemove = currentIds.filter(id => !assignStoreIds.includes(id));
    for (const storeId of toAdd) {
      await supabase.from("store_members").insert({ user_id: userId, store_id: storeId, org_id: orgId });
    }
    for (const storeId of toRemove) {
      await supabase.from("store_members").delete().eq("user_id", userId).eq("store_id", storeId);
    }
    setMessage({ text: `${assignProfile.name}님의 매장 배정이 업데이트되었습니다.`, type: "success" });
    setShowAssign(false);
    setAssignProfile(null);
    setSending(false);
    loadData();
  }

  async function changeRole(profileId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    const roleName = ROLE_CONFIG[newRole]?.label || newRole;
    setMessage({ text: `권한이 ${roleName}으로 변경되었습니다.`, type: "success" });
    loadData();
  }

  function canManageRole(targetProfile: Profile): boolean {
    if (targetProfile.id === currentUserId) return false;
    if (currentUserRole === "super_admin") return true;
    if (currentUserRole === "admin" && targetProfile.role === "crew") return true;
    return false;
  }

  // 제거 권한: admin도 super_admin 외 모든 멤버 제거 가능 (본인 제외)
  function canRemoveMember(targetProfile: Profile): boolean {
    if (targetProfile.id === currentUserId) return false;
    if (targetProfile.role === "super_admin") return false; // super_admin은 제거 불가
    if (currentUserRole === "super_admin" || currentUserRole === "admin") return true;
    return false;
  }

  // --- UI Helpers ---
  const roleBadge = (role: string) => ROLE_CONFIG[role] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", label: role, desc: "", icon: "👤" };
  const statusBadge = (status: string) => {
    if (status === "active" || status === "accepted") return { bg: "#dcfce7", color: "#15803d", label: status === "active" ? "활성" : "수락" };
    if (status === "pending") return { bg: "#fff7ed", color: "#ea580c", label: "대기" };
    return { bg: "#f1f5f9", color: "#475569", label: status === "disabled" ? "비활성" : "취소" };
  };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }) : "-";
  const pendingInvitations = invitations.filter(inv => inv.status !== "accepted");

  async function toggleStatus(profile: Profile) {
    const newStatus = profile.status === "active" ? "disabled" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    setMessage({ text: `${profile.name}님이 ${newStatus === "active" ? "활성화" : "비활성화"}되었습니다.`, type: newStatus === "active" ? "success" : "" });
    loadData();
  }

  // 멤버 완전 제거 (API 라우트 경유 - service role 필요)
  async function removeMember(profile: Profile) {
    setSending(true);
    try {
      const res = await fetch("/api/team/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          userEmail: profile.email,
          orgId,
          requesterId: currentUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "제거 실패", type: "error" });
      } else {
        setMessage({ text: `${profile.name || profile.email}님이 조직에서 제거되었습니다. 재초대 시 새 초대 이메일을 발송하세요.`, type: "success" });
        setRemoveTarget(null);
        loadData();
      }
    } catch (e) {
      setMessage({ text: "제거 중 오류가 발생했습니다.", type: "error" });
    }
    setSending(false);
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>팀원 관리</h3>
          <button onClick={() => setShowInvite(true)} style={{ padding: "10px 20px", borderRadius: 10, background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>+ 팀원 추가</button>
        </div>

        {message.text && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-100 text-green-800" : message.type === "warning" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {loading ? <div className="text-center py-10 text-gray-500">로딩 중...</div> : (
          <>
            {/* ===== 등록된 팀원 ===== */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>등록된 팀원 ({profiles.length}명)</h4>
              </div>
              {/* PC */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                    <tr>
                      {["이름","이메일","배정매장","초대일","수락일","권한","상태","관리"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => {
                      const sb = statusBadge(p.status);
                      const inv = inviteMap[p.email];
                      const memberStores = getMemberStores(p.id);
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid var(--border-light)" }} className="hover:bg-[var(--bg-card)]">
                          <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{p.name || "-"}</td>
                          <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{p.email}</td>
                          <td className="px-5 py-3.5 text-sm">
                            {memberStores.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {memberStores.map((name, i) => (
                                  <span key={i} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "#EEF2FF", color: "#4338ca" }}>{name}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">{p.role === "admin" ? "전체" : "-"}</span>
                            )}
                          </td>
                          <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-muted)" }}>{inv ? fmtDate(inv.invited) : "-"}</td>
                          <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-muted)" }}>{inv ? fmtDate(inv.accepted) : "-"}</td>
                          <td className="px-5 py-3.5 text-sm">
                            <RoleDropdown
                              profile={p}
                              currentUserRole={currentUserRole}
                              currentUserId={currentUserId}
                              onRoleChange={changeRole}
                            />
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            <div className="flex gap-2 items-center">
                              {canManageRole(p) && (
                                <>
                                  <button onClick={() => openAssignModal(p)} style={{ fontSize: 12, fontWeight: 600, color: "#1428A0", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>매장배정</button>
                                  <span style={{ color: "#e2e8f0" }}>|</span>
                                  <button onClick={() => { setResetTarget(p); setResetPassword(""); }} style={{ fontSize: 12, fontWeight: 600, color: "#ea580c", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>비번재설정</button>
                                  <span style={{ color: "#e2e8f0" }}>|</span>
                                  <button
                                    onClick={() => toggleStatus(p)}
                                    style={{ fontSize: 12, fontWeight: 600, color: p.status === "active" ? "#94a3b8" : "#16a34a", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                                  >
                                    {p.status === "active" ? "비활성" : "활성화"}
                                  </button>
                                  <span style={{ color: "#e2e8f0" }}>|</span>
                                </>
                              )}
                              {canRemoveMember(p) && (
                                <button
                                  onClick={() => setRemoveTarget(p)}
                                  style={{ fontSize: 12, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                                >제거</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* 모바일 */}
              <div className="md:hidden">
                {profiles.map((p) => {
                  return (
                    <div key={p.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <span className="font-bold text-sm text-gray-900">{p.name || "-"}</span>
                          <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: statusBadge(p.status).bg, color: statusBadge(p.status).color }}>{statusBadge(p.status).label}</span>
                        </div>
                        <RoleDropdown
                          profile={p}
                          currentUserRole={currentUserRole}
                          currentUserId={currentUserId}
                          onRoleChange={changeRole}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{p.email}</p>
                      {getMemberStores(p.id).length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          {getMemberStores(p.id).map((name, i) => (
                            <span key={i} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: "#EEF2FF", color: "#4338ca" }}>{name}</span>
                          ))}
                        </div>
                      )}
                      {canManageRole(p) && (
                        <div className="flex gap-3 mt-1">
                          <button onClick={() => openAssignModal(p)} style={{ fontSize: 11, fontWeight: 700, color: "#1428A0", background: "none", border: "none", cursor: "pointer", padding: 0 }}>매장배정</button>
                          <button onClick={() => { setResetTarget(p); setResetPassword(""); }} style={{ fontSize: 11, fontWeight: 600, color: "#ea580c", background: "none", border: "none", cursor: "pointer", padding: 0 }}>비번재설정</button>
                          <button onClick={() => toggleStatus(p)} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            {p.status === "active" ? "비활성" : "활성화"}
                          </button>
                          {canRemoveMember(p) && (
                            <button onClick={() => setRemoveTarget(p)} style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>제거</button>
                          )}
                        </div>
                      )}
                      {!canManageRole(p) && canRemoveMember(p) && (
                        <div className="flex gap-3 mt-1">
                          <button onClick={() => setRemoveTarget(p)} style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0 }}>제거</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== 초대 내역 ===== */}
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>초대 내역 ({pendingInvitations.length}건)</h4>
              </div>
              {pendingInvitations.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">초대 내역이 없습니다</div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-light)" }}>
                        <tr>
                          {["이메일","역할","배정매장","상태","초대일","관리"].map(h => (
                            <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pendingInvitations.map((inv) => {
                          const rb = roleBadge(inv.role);
                          const sb = statusBadge(inv.status);
                          return (
                            <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-light)" }} className="hover:bg-[var(--bg-card)]">
                              <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{inv.email}</td>
                              <td style={{ padding: "13px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span></td>
                              <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--text-secondary)" }}>{inv.stores?.name || "-"}</td>
                              <td style={{ padding: "13px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span></td>
                              <td style={{ padding: "13px 16px", fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(inv.created_at)}</td>
                              <td className="px-5 py-3.5 text-sm">
                                <div className="flex gap-2">
                                  {inv.status === "pending" && (
                                    <>
                                      <button onClick={() => resendInvitation(inv)} disabled={sending} className="text-xs font-bold text-blue-600 hover:text-blue-800">재발송</button>
                                      <button onClick={() => cancelInvitation(inv.id)} className="text-xs font-bold text-red-500 hover:text-red-700">취소</button>
                                    </>
                                  )}
                                  <button onClick={() => deleteInvitation(inv.id)} className="text-xs font-bold text-gray-400 hover:text-red-500">삭제</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden">
                    {pendingInvitations.map((inv) => {
                      const rb = roleBadge(inv.role);
                      const sb = statusBadge(inv.status);
                      return (
                        <div key={inv.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-900" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{inv.email}</span>
                            <div className="flex gap-1.5">
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{inv.stores?.name ? `📍${inv.stores.name} · ` : ""}{fmtDate(inv.created_at)}</span>
                            <div className="flex gap-2">
                              {inv.status === "pending" && (
                                <>
                                  <button onClick={() => resendInvitation(inv)} disabled={sending} className="text-xs font-bold text-blue-600">재발송</button>
                                  <button onClick={() => cancelInvitation(inv.id)} className="text-xs font-bold text-red-500">취소</button>
                                </>
                              )}
                              <button onClick={() => deleteInvitation(inv.id)} className="text-xs font-bold text-gray-400">삭제</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ===== 초대 모달 ===== */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-5">팀원 추가</h3>

              {/* 모드 토글 */}
              <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "#f1f5f9", borderRadius: 10, padding: 4 }}>
                <button onClick={() => setInviteMode("direct")} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteMode === "direct" ? "#1428A0" : "transparent", color: inviteMode === "direct" ? "#fff" : "#64748b", transition: "all 0.15s" }}>🔑 계정 직접 생성</button>
                <button onClick={() => setInviteMode("email")} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteMode === "email" ? "#1428A0" : "transparent", color: inviteMode === "email" ? "#fff" : "#64748b", transition: "all 0.15s" }}>📧 이메일 초대</button>
              </div>

              <div className="space-y-4">
                {/* 이름 (직접 생성만) */}
                {inviteMode === "direct" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">이름 *</label>
                    <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="홍길동" />
                  </div>
                )}

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">이메일 주소 *</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="example@email.com" />
                </div>

                {/* 비밀번호 (직접 생성만) */}
                {inviteMode === "direct" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">비밀번호 *</label>
                    <input type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="6자 이상 (본인에게 전달)" />
                    <p className="text-xs text-orange-500 mt-1.5 font-medium">⚠️ 생성 후 본인에게 비밀번호를 전달해주세요</p>
                  </div>
                )}

                {/* 역할 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">역할 *</label>
                  <div className="flex gap-2">
                    {currentUserRole === "super_admin" && (
                      <button onClick={() => setInviteRole("super_admin")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteRole === "super_admin" ? "#fef3c7" : "#f8fafc", color: inviteRole === "super_admin" ? "#b45309" : "#999", outline: inviteRole === "super_admin" ? "2px solid #b45309" : "1px solid #e2e8f0" }}>최고관리자</button>
                    )}
                    <button onClick={() => setInviteRole("admin")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteRole === "admin" ? "#EEF2FF" : "#f8fafc", color: inviteRole === "admin" ? "#1428A0" : "#999", outline: inviteRole === "admin" ? "2px solid #1428A0" : "1px solid #e2e8f0" }}>관리자</button>
                    <button onClick={() => setInviteRole("crew")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteRole === "crew" ? "#dcfce7" : "#f8fafc", color: inviteRole === "crew" ? "#15803d" : "#999", outline: inviteRole === "crew" ? "2px solid #16a34a" : "1px solid #e2e8f0" }}>CREW</button>
                  </div>
                </div>

                {/* 매장 선택 (복수) */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    배정 매장 {inviteRole === "crew" ? "*" : "(선택사항)"}
                  </label>
                  <p className="text-xs text-gray-400 mb-2">여러 매장을 선택할 수 있습니다</p>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {stores.map((s) => {
                      const selected = inviteStoreIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleInviteStore(s.id)}
                          style={{
                            padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", textAlign: "left",
                            background: selected ? "#1428A015" : "#f8fafc",
                            color: selected ? "#1428A0" : "#666",
                            outline: selected ? "2px solid #1428A0" : "1px solid #e2e8f0",
                          }}
                        >
                          {selected ? "✓ " : ""}{s.name}
                        </button>
                      );
                    })}
                  </div>
                  {inviteStoreIds.length > 0 && (
                    <p className="text-xs text-primary font-bold mt-2">{inviteStoreIds.length}개 매장 선택됨</p>
                  )}
                </div>

                {/* 안내 */}
                <div style={{ background: inviteRole === "crew" ? "#dcfce7" : "#EEF2FF", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, color: inviteRole === "crew" ? "#15803d" : "#1428A0", margin: 0, lineHeight: 1.6 }}>
                    {inviteRole === "crew"
                      ? "📍 CREW는 배정된 매장에서만 데이터 입력·조회가 가능합니다."
                      : inviteStoreIds.length > 0
                        ? "🔑 관리자는 선택한 매장의 데이터를 관리합니다. 매장 미선택 시 전체 접근 가능합니다."
                        : "🔑 관리자는 모든 매장의 데이터를 조회·입력·분석할 수 있습니다."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteName(""); setInvitePassword(""); setInviteRole("admin"); setInviteStoreIds([]); setInviteMode("direct"); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                {inviteMode === "email" ? (
                  <button onClick={handleInvite} disabled={!inviteEmail || sending || (inviteRole === "crew" && inviteStoreIds.length === 0)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{sending ? "발송 중..." : "초대 발송"}</button>
                ) : (
                  <button onClick={handleDirectCreate} disabled={!inviteEmail || !inviteName || !invitePassword || invitePassword.length < 6 || sending || (inviteRole === "crew" && inviteStoreIds.length === 0)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{sending ? "생성 중..." : "계정 생성"}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== 매장 배정 모달 ===== */}
        {showAssign && assignProfile && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-2">매장 배정</h3>
              <p className="text-sm text-gray-500 mb-5">
                <strong>{assignProfile.name}</strong> ({assignProfile.email})
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">배정할 매장 선택</label>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {stores.map((s) => {
                      const selected = assignStoreIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleAssignStore(s.id)}
                          style={{
                            padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", textAlign: "left",
                            background: selected ? "#1428A015" : "#f8fafc",
                            color: selected ? "#1428A0" : "#666",
                            outline: selected ? "2px solid #1428A0" : "1px solid #e2e8f0",
                          }}
                        >
                          {selected ? "✓ " : ""}{s.name}
                        </button>
                      );
                    })}
                  </div>
                  {assignStoreIds.length > 0 && (
                    <p className="text-xs text-primary font-bold mt-2">{assignStoreIds.length}개 매장 선택됨</p>
                  )}
                </div>

                <div style={{ background: "#EEF2FF", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, color: "#1428A0", margin: 0, lineHeight: 1.6 }}>
                    {assignProfile.role === "admin"
                      ? "🔑 Admin은 매장 미배정 시 전체 매장 접근 가능. 배정 시 해당 매장만 접근합니다."
                      : "📍 CREW는 배정된 매장에서만 데이터 입력·조회가 가능합니다."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => { setShowAssign(false); setAssignProfile(null); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={saveAssignment} disabled={sending} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{sending ? "저장 중..." : "배정 저장"}</button>
              </div>
            </div>
          </div>
        )}
        {/* ===== 멤버 제거 확인 모달 ===== */}
        {removeTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">팀원 제거</h3>
              <p className="text-sm text-gray-500 mb-4" style={{ lineHeight: 1.6 }}>
                <strong>{removeTarget.name || removeTarget.email}</strong>님을 조직에서 제거합니다.<br/>
                <span style={{ color: "#ef4444", fontSize: 12, marginTop: 6, display: "block" }}>
                  ⚠️ 모든 매장 배정이 삭제되고 초대 기록도 지워집니다.<br/>
                  재초대 시 새 초대 이메일을 발송해야 합니다.
                </span>
              </p>
              <div style={{ background: "#fafafa", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#374151" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ color: "#6b7280" }}>이메일</span>
                  <span style={{ fontWeight: 600 }}>{removeTarget.email}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280" }}>현재 권한</span>
                  <span style={{ fontWeight: 600 }}>{ROLE_CONFIG[removeTarget.role]?.label || removeTarget.role}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRemoveTarget(null)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
                >취소</button>
                <button
                  onClick={() => removeMember(removeTarget)}
                  disabled={sending}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", fontSize: 14, fontWeight: 700, color: "#fff", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}
                >{sending ? "제거 중..." : "제거 확인"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== 계정 생성/비번 재설정 완료 팝업 ===== */}
        {createdAccount && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>✅</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">계정 정보</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                아래 정보를 <strong>{createdAccount.name}</strong>님에게 전달해주세요.
              </p>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>이름</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1D2B" }}>{createdAccount.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>이메일(아이디)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1D2B" }}>{createdAccount.email}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>비밀번호</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#ea580c" }}>{createdAccount.password}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const text = `[미팍Ticket 로그인 정보]\n이름: ${createdAccount.name}\n이메일: ${createdAccount.email}\n비밀번호: ${createdAccount.password}\n\n로그인: https://mrpark-parking.vercel.app/crew/login`;
                  navigator.clipboard.writeText(text).then(() => {
                    setMessage({ text: "로그인 정보가 클립보드에 복사되었습니다.", type: "success" });
                  }).catch(() => {});
                }}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14, fontWeight: 700, color: "#1428A0", cursor: "pointer", marginBottom: 10 }}
              >📋 로그인 정보 복사</button>
              <button
                onClick={() => setCreatedAccount(null)}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#1428A0", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}
              >확인</button>
            </div>
          </div>
        )}

        {/* ===== 비밀번호 재설정 모달 ===== */}
        {resetTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🔑</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">비밀번호 재설정</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                <strong>{resetTarget.name}</strong> ({resetTarget.email})
              </p>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1A1D2B", marginBottom: 6 }}>새 비밀번호 *</label>
              <input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="6자 이상 입력"
                style={{ width: "100%", padding: "12px 16px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#1A1D2B", outline: "none", boxSizing: "border-box", marginBottom: 20 }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setResetTarget(null); setResetPassword(""); }}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", fontSize: 14, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}
                >취소</button>
                <button
                  onClick={handleResetPassword}
                  disabled={sending || !resetPassword || resetPassword.length < 6}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ea580c", fontSize: 14, fontWeight: 700, color: "#fff", cursor: sending ? "not-allowed" : "pointer", opacity: sending || !resetPassword || resetPassword.length < 6 ? 0.5 : 1 }}
                >{sending ? "변경 중..." : "비밀번호 변경"}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
