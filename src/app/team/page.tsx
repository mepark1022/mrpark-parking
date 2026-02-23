// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Profile = { id: string; email: string; name: string; role: string; status: string; created_at: string };

const ROLE_CONFIG: Record<string, { bg: string; color: string; label: string; desc: string }> = {
  super_admin: { bg: "#fef3c7", color: "#b45309", label: "최고관리자", desc: "모든 기능 접근 + 팀원 관리" },
  admin:       { bg: "#EEF2FF",  color: "#1428A0", label: "관리자",    desc: "매장 관리 및 데이터 조회" },
  crew:        { bg: "#dcfce7",  color: "#15803d", label: "CREW",      desc: "배정 매장 데이터 입력만" },
};
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
  const [message, setMessage] = useState({ text: "", type: "" });
  const [sending, setSending] = useState(false);

  // 초대 모달
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteStoreIds, setInviteStoreIds] = useState<string[]>([]);

  // 매장 배정 모달
  const [showAssign, setShowAssign] = useState(false);
  const [assignProfile, setAssignProfile] = useState<Profile | null>(null);
  const [assignStoreIds, setAssignStoreIds] = useState<string[]>([]);

  // 역할 변경 모달
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Profile | null>(null);
  const [pendingRole, setPendingRole] = useState("");

  // 초대 매핑
  const [inviteMap, setInviteMap] = useState<Record<string, { invited: string; accepted: string }>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

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

  function toggleInviteStore(storeId: string) {
    setInviteStoreIds(prev => prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]);
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

  // --- 매장 배정 ---
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

    // 추가할 매장
    const toAdd = assignStoreIds.filter(id => !currentIds.includes(id));
    // 제거할 매장
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

  function openRoleModal(profile: Profile) {
    setRoleTarget(profile);
    setPendingRole(profile.role);
    setShowRoleModal(true);
  }

  async function confirmRoleChange() {
    if (!roleTarget || pendingRole === roleTarget.role) { setShowRoleModal(false); return; }
    await supabase.from("profiles").update({ role: pendingRole }).eq("id", roleTarget.id);
    setShowRoleModal(false);
    setRoleTarget(null);
    loadData();
  }

  // --- 역할/상태 ---
  async function changeRole(profileId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    loadData();
  }

  async function toggleStatus(profile: Profile) {
    const newStatus = profile.status === "active" ? "disabled" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    loadData();
  }

  // --- UI Helpers ---
  const roleBadge = (role: string) => ROLE_CONFIG[role] || { bg: "#f1f5f9", color: "#475569", label: role, desc: "" };
  const statusBadge = (status: string) => {
    if (status === "active" || status === "accepted") return { bg: "#dcfce7", color: "#15803d", label: status === "active" ? "활성" : "수락" };
    if (status === "pending") return { bg: "#fff7ed", color: "#ea580c", label: "대기" };
    return { bg: "#f1f5f9", color: "#475569", label: status === "disabled" ? "비활성" : "취소" };
  };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }) : "-";
  const pendingInvitations = invitations.filter(inv => inv.status !== "accepted");

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>팀원 관리</h3>
          <button onClick={() => setShowInvite(true)} style={{ padding: "10px 20px", borderRadius: 10, background: "var(--navy)", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>+ 팀원 초대</button>
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
                      const rb = roleBadge(p.role);
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
                            {p.id === currentUserId ? (
                              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                            ) : (
                              <button
                                onClick={() => openRoleModal(p)}
                                style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                              >
                                {rb.label} <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            <div className="flex gap-2">
                              {p.id !== currentUserId && (
                                <>
                                  <button onClick={() => openAssignModal(p)} className="text-xs font-bold text-blue-600 hover:text-blue-800">매장배정</button>
                                  <button onClick={() => toggleStatus(p)} className="text-xs font-bold text-gray-500 hover:text-gray-700">
                                    {p.status === "active" ? "비활성" : "활성화"}
                                  </button>
                                </>
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
                  const rb = roleBadge(p.role);
                  const sb = statusBadge(p.status);
                  const memberStores = getMemberStores(p.id);
                  return (
                    <div key={p.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-gray-900">{p.name || "-"}</span>
                        <div className="flex gap-1.5">
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{p.email}</p>
                      {memberStores.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {memberStores.map((name, i) => (
                            <span key={i} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 600, background: "#EEF2FF", color: "#4338ca" }}>{name}</span>
                          ))}
                        </div>
                      )}
                      {p.id !== currentUserId && (
                        <div className="flex gap-3 mt-1.5">
                          <button onClick={() => openRoleModal(p)} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: rb.bg, color: rb.color, border: "none", cursor: "pointer" }}>{rb.label} ▼</button>
                          <button onClick={() => openAssignModal(p)} className="text-xs font-bold text-blue-600">매장배정</button>
                          <button onClick={() => toggleStatus(p)} className="text-xs font-bold text-gray-400">{p.status === "active" ? "비활성" : "활성화"}</button>
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
              <h3 className="text-xl font-bold text-gray-900 mb-5">팀원 초대</h3>
              <div className="space-y-4">
                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">이메일 주소 *</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="example@email.com" />
                </div>

                {/* 역할 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">역할 *</label>
                  <div className="flex gap-2">
                    <button onClick={() => setInviteRole("super_admin")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", background: inviteRole === "super_admin" ? "#fef3c7" : "#f8fafc", color: inviteRole === "super_admin" ? "#b45309" : "#999", outline: inviteRole === "super_admin" ? "2px solid #b45309" : "1px solid #e2e8f0" }}>최고관리자</button>
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
                <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteRole("admin"); setInviteStoreIds([]); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleInvite} disabled={!inviteEmail || sending || (inviteRole === "crew" && inviteStoreIds.length === 0)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">{sending ? "발송 중..." : "초대 발송"}</button>
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
        {/* ===== 역할 변경 모달 ===== */}
        {showRoleModal && roleTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold text-gray-900 mb-1">권한 변경</h3>
              <p className="text-sm text-gray-500 mb-5">
                <strong>{roleTarget.name || roleTarget.email}</strong>님의 권한을 선택하세요
              </p>
              <div className="space-y-2 mb-6">
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setPendingRole(key)}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                      background: pendingRole === key ? cfg.bg : "#f8fafc",
                      outline: pendingRole === key ? `2px solid ${cfg.color}` : "1px solid #e2e8f0",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: pendingRole === key ? cfg.color : "#374151" }}>{cfg.label}</span>
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{cfg.desc}</p>
                      </div>
                      {pendingRole === key && (
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: cfg.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {pendingRole !== roleTarget.role && (
                <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "#854d0e", margin: 0 }}>
                    ⚠️ {ROLE_CONFIG[roleTarget.role]?.label || roleTarget.role} → <strong>{ROLE_CONFIG[pendingRole]?.label || pendingRole}</strong> 으로 변경됩니다.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowRoleModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button
                  onClick={confirmRoleChange}
                  disabled={pendingRole === roleTarget.role}
                  style={{ padding: "10px 20px", borderRadius: 10, background: pendingRole !== roleTarget.role ? "#1428A0" : "#e2e8f0", color: pendingRole !== roleTarget.role ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: 700, border: "none", cursor: pendingRole !== roleTarget.role ? "pointer" : "not-allowed" }}
                >
                  변경 저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
