// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Profile = { id: string; email: string; name: string; display_name: string | null; role: string; status: string; created_at: string };

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
                <strong>{profile.display_name || profile.name || profile.email}</strong>님의<br/>권한을 변경하시겠습니까?
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

type Store = { id: string; name: string };
type StoreMember = { id: string; user_id: string; store_id: string };

export default function TeamPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>([]);
  const [showConfirmCreate, setShowConfirmCreate] = useState(false);

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

    const [profilesRes, storesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", oid).order("created_at"),
      supabase.from("stores").select("id, name").eq("org_id", oid).eq("is_active", true).order("name"),
      supabase.from("store_members").select("*").eq("org_id", oid),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (storesRes.data) setStores(storesRes.data);
    if (membersRes.data) setStoreMembers(membersRes.data);

    setLoading(false);
  }

  // 해당 유저의 배정매장 이름 목록
  function getMemberStores(userId: string): string[] {
    const memberStoreIds = storeMembers.filter(m => m.user_id === userId).map(m => m.store_id);
    return stores.filter(s => memberStoreIds.includes(s.id)).map(s => s.name);
  }

  // --- 초대 ---
  // --- 계정 직접 생성 ---
  async function handleDirectCreate() {
    if (!inviteEmail || !inviteName || !invitePhone || !invitePassword) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setMessage({ text: "올바른 이메일 형식을 입력해주세요. (예: example@email.com)", type: "error" });
      return;
    }
    if (!/^[가-힣]{2,}$/.test(inviteName.trim())) {
      setMessage({ text: "이름은 한글 2자 이상 입력해주세요.", type: "error" });
      return;
    }
    if (!/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(invitePhone.replace(/-/g, ""))) {
      setMessage({ text: "올바른 연락처를 입력해주세요. (예: 010-0000-0000)", type: "error" });
      return;
    }
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
          phone: invitePhone,
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
        setInviteEmail(""); setInviteName(""); setInvitePhone(""); setInvitePassword(""); setInviteRole("admin"); setInviteStoreIds([]); setShowInvite(false);
        loadData();
      }
    } catch (e: any) { setMessage({ text: `계정 생성 실패: ${e?.message || "서버 오류"}`, type: "error" }); }
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
        setCreatedAccount({ name: resetTarget.display_name || resetTarget.name, email: resetTarget.email, password: resetPassword });
        setResetTarget(null);
        setResetPassword("");
      }
    } catch (e: any) { setMessage({ text: `비밀번호 재설정 실패: ${e?.message || "서버 오류"}`, type: "error" }); }
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
    setMessage({ text: `${assignProfile.display_name || assignProfile.name}님의 매장 배정이 업데이트되었습니다.`, type: "success" });
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
  

  async function toggleStatus(profile: Profile) {
    const newStatus = profile.status === "active" ? "disabled" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    setMessage({ text: `${profile.display_name || profile.name}님이 ${newStatus === "active" ? "활성화" : "비활성화"}되었습니다.`, type: newStatus === "active" ? "success" : "" });
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
        setMessage({ text: `${profile.display_name || profile.name || profile.email}님이 조직에서 제거되었습니다.`, type: "success" });
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>팀원 관리</h3>
          <button onClick={() => { setMessage({ text: "", type: "" }); setShowInvite(true); }} style={{ padding: "9px 16px", borderRadius: 10, background: "var(--navy)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>+ 팀원 추가</button>
        </div>

        {message.text && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-100 text-green-800" : message.type === "warning" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
            {message.text}
          </div>
        )}

        {loading ? <div className="text-center py-10 text-gray-500">로딩 중...</div> : (() => {
          // 역할별 분류
          const superAdmins = profiles.filter(p => p.role === "super_admin");
          const admins = profiles.filter(p => p.role === "admin");
          const crews = profiles.filter(p => p.role === "crew");
          const adminGroup = [...superAdmins, ...admins];

          // 매장별 CREW 그룹핑
          const storeCrewMap: Record<string, { store: Store; members: Profile[] }> = {};
          stores.forEach(s => { storeCrewMap[s.id] = { store: s, members: [] }; });
          const unassignedCrews: Profile[] = [];

          crews.forEach(crew => {
            const memberStoreIds = storeMembers.filter(m => m.user_id === crew.id).map(m => m.store_id);
            if (memberStoreIds.length === 0) {
              unassignedCrews.push(crew);
            } else {
              memberStoreIds.forEach(sid => {
                if (storeCrewMap[sid]) storeCrewMap[sid].members.push(crew);
              });
            }
          });

          // 멤버 카드 렌더 헬퍼
          const renderMemberCard = (p: Profile, compact?: boolean) => {
            const sb = statusBadge(p.status);
            const memberStores = getMemberStores(p.id);
            const hasActions = canManageRole(p) || canRemoveMember(p);
            
            return (
              <div key={p.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", transition: "background 0.1s" }} className="hover:bg-[var(--bg-card)] last:border-b-0">
                {/* Row 1: 아바타 + 이름/이메일 + 역할 드롭다운 */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* 아바타 */}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: ROLE_CONFIG[p.role]?.bg || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {ROLE_CONFIG[p.role]?.icon || "👤"}
                  </div>
                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.display_name || p.name || "-"}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color, flexShrink: 0 }}>{sb.label}</span>
                      {p.status === "disabled" && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, flexShrink: 0 }}>차단</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
                  </div>
                  {/* 역할 드롭다운 (항상 우측) */}
                  <div style={{ flexShrink: 0 }}>
                    <RoleDropdown profile={p} currentUserRole={currentUserRole} currentUserId={currentUserId} onRoleChange={changeRole} />
                  </div>
                </div>

                {/* Row 2: 매장 뱃지 + 액션 버튼 */}
                {(!compact || hasActions) && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingLeft: 46, gap: 8 }}>
                    {/* 매장 뱃지 */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1, minWidth: 0 }}>
                      {!compact && memberStores.length > 0 && memberStores.map((name, i) => (
                        <span key={i} style={{ padding: "1px 7px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: "#EEF2FF", color: "#4338ca" }}>{name}</span>
                      ))}
                      {!compact && memberStores.length === 0 && p.role === "admin" && (
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>전체 매장 접근</span>
                      )}
                    </div>
                    {/* 액션 버튼 - PC */}
                    {hasActions && (
                      <div className="hidden lg:flex gap-1.5 items-center" style={{ flexShrink: 0 }}>
                        {canManageRole(p) && (
                          <>
                            <button onClick={() => openAssignModal(p)} title="매장배정" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>📍</button>
                            <button onClick={() => { setResetTarget(p); setResetPassword(""); }} title="비번재설정" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>🔑</button>
                            <button onClick={() => toggleStatus(p)} title={p.status === "active" ? "비활성화" : "활성화"} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.status === "active" ? "🚫" : "✅"}</button>
                          </>
                        )}
                        {canRemoveMember(p) && (
                          <button onClick={() => setRemoveTarget(p)} title="제거" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑️</button>
                        )}
                      </div>
                    )}
                    {/* 액션 버튼 - 모바일/태블릿 */}
                    {hasActions && (
                      <div className="lg:hidden flex gap-2 items-center" style={{ flexShrink: 0 }}>
                        {canManageRole(p) && (
                          <>
                            <button onClick={() => openAssignModal(p)} style={{ fontSize: 11, fontWeight: 700, color: "#1428A0", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>배정</button>
                            <button onClick={() => { setResetTarget(p); setResetPassword(""); }} style={{ fontSize: 11, fontWeight: 600, color: "#ea580c", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>비번</button>
                          </>
                        )}
                        {canRemoveMember(p) && (
                          <button onClick={() => setRemoveTarget(p)} style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>제거</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return (
            <>
              {/* ===== 관리자 섹션 ===== */}
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 20 }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 4, height: 20, borderRadius: 2, background: "#1428A0" }} />
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>관리자</h4>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#EEF2FF", color: "#1428A0" }}>{adminGroup.length}명</span>
                </div>
                {adminGroup.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">등록된 관리자가 없습니다</div>
                ) : (
                  adminGroup.map(p => renderMemberCard(p))
                )}
              </div>

              {/* ===== 매장별 CREW 섹션 ===== */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>매장별 CREW</h4>
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>총 {crews.length}명</span>
                </div>

                {crews.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", padding: "32px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                    <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>등록된 CREW가 없습니다</p>
                    <p style={{ fontSize: 12, color: "#cbd5e1", margin: "4px 0 0" }}>팀원 추가에서 CREW를 등록하세요</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 16 }} className="grid-cols-1 lg:grid-cols-2">
                    {Object.values(storeCrewMap).filter(g => g.members.length > 0).map(({ store, members }) => (
                      <div key={store.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 4, height: 18, borderRadius: 2, background: "#F5B731" }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>🏢 {store.name}</span>
                          <span style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>{members.length}명</span>
                        </div>
                        {members.map(p => renderMemberCard(p, true))}
                      </div>
                    ))}

                    {/* 미배정 CREW */}
                    {unassignedCrews.length > 0 && (
                      <div style={{ background: "#fff", borderRadius: 16, border: "1px dashed #e2e8f0", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", background: "#fefce8", display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 4, height: 18, borderRadius: 2, background: "#ea580c" }} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>⚠️ 미배정</span>
                          <span style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "#fff7ed", color: "#ea580c" }}>{unassignedCrews.length}명</span>
                        </div>
                        {unassignedCrews.map(p => renderMemberCard(p, false))}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </>
          );
        })()}

        {/* ===== 초대 모달 ===== */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 w-full sm:max-w-md shadow-2xl max-h-[85vh] overflow-y-auto" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              <h3 className="text-xl font-bold text-gray-900 mb-5">팀원 추가</h3>

              {/* 안내 배너 */}
              <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: "#1428A0", margin: 0, fontWeight: 600 }}>🔑 관리자가 직접 계정을 생성하고, ID/비밀번호를 전달합니다.</p>
              </div>

              <div className="space-y-4">
                {/* 이름 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">이름 * <span style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8" }}>(한글만 입력 가능)</span></label>
                  <input type="text" value={inviteName} onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[가-힣ㄱ-ㅎㅏ-ㅣ\s]*$/.test(val)) {
                      setInviteName(val);
                    } else {
                      setMessage({ text: "이름은 한글만 입력할 수 있습니다.", type: "error" });
                    }
                  }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="홍길동" />
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">이메일 주소 *</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="example@email.com" />
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">연락처 *</label>
                  <input type="tel" value={invitePhone} onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9-]/g, "");
                    setInvitePhone(val);
                  }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="010-0000-0000" maxLength={13} />
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">비밀번호 *</label>
                  <input type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="6자 이상 (본인에게 전달)" />
                  <p className="text-xs text-orange-500 mt-1.5 font-medium">⚠️ 생성 후 본인에게 비밀번호를 전달해주세요</p>
                </div>

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
              {/* 모달 내 에러 메시지 */}
              {message.text && message.type === "error" && (
                <div style={{ margin: "12px 0 0", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
                  {message.text}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteName(""); setInvitePhone(""); setInvitePassword(""); setInviteRole("admin"); setInviteStoreIds([]); setMessage({ text: "", type: "" }); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={() => {
                  if (!inviteName || !/^[가-힣]{2,}$/.test(inviteName.trim())) {
                    setMessage({ text: "이름은 한글 2자 이상 입력해주세요.", type: "error" }); return;
                  }
                  if (!inviteEmail) { setMessage({ text: "이메일을 입력해주세요.", type: "error" }); return; }
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { setMessage({ text: "올바른 이메일 형식을 입력해주세요. (예: example@email.com)", type: "error" }); return; }
                  if (!invitePhone || !/^01[0-9]{8,9}$/.test(invitePhone.replace(/-/g, ""))) { setMessage({ text: "올바른 연락처를 입력해주세요. (예: 010-0000-0000)", type: "error" }); return; }
                  if (!invitePassword || invitePassword.length < 6) { setMessage({ text: "비밀번호는 6자 이상이어야 합니다.", type: "error" }); return; }
                  if (inviteRole === "crew" && inviteStoreIds.length === 0) { setMessage({ text: "CREW는 배정 매장을 선택해주세요.", type: "error" }); return; }
                  setShowConfirmCreate(true);
                }} disabled={!inviteEmail || !inviteName || !invitePhone || !invitePassword || invitePassword.length < 6 || sending || (inviteRole === "crew" && inviteStoreIds.length === 0)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{sending ? "생성 중..." : "계정 생성"}</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== 계정 생성 확인 팝업 ===== */}
        {showConfirmCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 380, textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1A1D2B", marginBottom: 8 }}>아이디와 비밀번호를<br/>메모하셨나요?</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6, lineHeight: 1.6 }}>
                생성 후에는 비밀번호를 확인할 수 없습니다.
              </div>
              <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 16px", marginBottom: 12, textAlign: "left" }}>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>생성 정보</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1D2B" }}>{inviteName}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{inviteEmail}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{invitePhone}</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>비밀번호: {invitePassword}</div>
              </div>
              <button onClick={() => {
                const text = `[미팍Ticket 로그인 정보]\n이름: ${inviteName}\n이메일: ${inviteEmail}\n연락처: ${invitePhone}\n비밀번호: ${invitePassword}\n\n로그인: https://mrpark-parking.vercel.app/crew/login`;
                navigator.clipboard.writeText(text).then(() => {
                  setMessage({ text: "로그인 정보가 복사되었습니다!", type: "success" });
                }).catch(() => {
                  // 폴백: textarea 복사
                  const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
                  setMessage({ text: "로그인 정보가 복사되었습니다!", type: "success" });
                });
              }} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "1.5px solid #1428A0", background: "#fff", color: "#1428A0", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16 }}>📋 로그인 정보 복사하기</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowConfirmCreate(false)}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#f1f5f9", color: "#64748b", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>돌아가기</button>
                <button onClick={() => { setShowConfirmCreate(false); handleDirectCreate(); }}
                  style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>네, 생성합니다</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== 매장 배정 모달 ===== */}
        {showAssign && assignProfile && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 w-full sm:max-w-md shadow-2xl max-h-[85vh] overflow-y-auto" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              <h3 className="text-xl font-bold text-gray-900 mb-2">매장 배정</h3>
              <p className="text-sm text-gray-500 mb-5">
                <strong>{assignProfile.display_name || assignProfile.name}</strong> ({assignProfile.email})
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
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 w-full sm:max-w-sm shadow-2xl" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🗑️</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">팀원 제거</h3>
              <p className="text-sm text-gray-500 mb-4" style={{ lineHeight: 1.6 }}>
                <strong>{removeTarget.display_name || removeTarget.name || removeTarget.email}</strong>님을 조직에서 제거합니다.<br/>
                <span style={{ color: "#ef4444", fontSize: 12, marginTop: 6, display: "block" }}>
                  ⚠️ 모든 매장 배정이 삭제되고 초대 기록도 지워집니다.<br/>
                  재등록이 필요한 경우 팀원 추가에서 계정을 다시 생성해주세요.
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
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 w-full sm:max-w-sm shadow-2xl" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
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
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 sm:p-7 w-full sm:max-w-sm shadow-2xl" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>🔑</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">비밀번호 재설정</h3>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, lineHeight: 1.6 }}>
                <strong>{resetTarget.display_name || resetTarget.name}</strong> ({resetTarget.email})
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
