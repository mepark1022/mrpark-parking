// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Profile = { id: string; email: string; name: string; role: string; status: string };
type Invitation = { id: string; email: string; role: string; status: string; created_at: string; token: string; store_id: string; stores?: { name: string } };
type Store = { id: string; name: string };

export default function TeamPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteStoreId, setInviteStoreId] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [profilesRes, invitationsRes, storesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", oid).order("created_at"),
      supabase.from("invitations").select("*, stores(name)").eq("org_id", oid).order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").order("name"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (invitationsRes.data) setInvitations(invitationsRes.data);
    if (storesRes.data) setStores(storesRes.data);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail) return;
    if (inviteRole === "crew" && !inviteStoreId) {
      setMessage({ text: "CREW는 배정 매장을 선택해주세요.", type: "error" });
      return;
    }
    setSending(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          storeId: inviteStoreId || null,
          invitedBy: currentUserId,
          orgId: orgId,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({ text: data.error || "초대 실패", type: "error" });
      } else if (data.emailSent) {
        setMessage({ text: `${inviteEmail}로 초대 이메일을 발송했습니다!`, type: "success" });
        setInviteEmail("");
        setInviteRole("admin");
        setInviteStoreId("");
        setShowInvite(false);
        loadData();
      } else {
        setMessage({ text: `초대는 생성되었지만 이메일 발송에 실패했습니다. (${data.emailError || ""})`, type: "warning" });
        loadData();
      }
    } catch (e) {
      setMessage({ text: "서버 오류가 발생했습니다", type: "error" });
    }
    setSending(false);
  }

  async function cancelInvitation(id: string) {
    await supabase.from("invitations").update({ status: "rejected" }).eq("id", id);
    loadData();
  }

  async function resendInvitation(inv: Invitation) {
    setSending(true);
    try {
      // 기존 초대 취소 후 새로 발송
      await supabase.from("invitations").update({ status: "rejected" }).eq("id", inv.id);
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inv.email,
          role: inv.role,
          storeId: inv.store_id || null,
          invitedBy: currentUserId,
          orgId: orgId,
        }),
      });
      const data = await res.json();
      if (data.emailSent) {
        setMessage({ text: `${inv.email}로 초대를 재발송했습니다.`, type: "success" });
      } else {
        setMessage({ text: "재발송에 실패했습니다.", type: "error" });
      }
      loadData();
    } catch (e) {
      setMessage({ text: "재발송 오류", type: "error" });
    }
    setSending(false);
  }

  async function changeRole(profileId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    loadData();
  }

  async function toggleStatus(profile: Profile) {
    const newStatus = profile.status === "active" ? "disabled" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    loadData();
  }

  const roleBadge = (role: string) => {
    if (role === "crew") return { bg: "#dcfce7", color: "#15803d", label: "CREW" };
    if (role === "admin") return { bg: "#1428A015", color: "#1428A0", label: "Admin" };
    if (role === "owner") return { bg: "#FFF7ED", color: "#ea580c", label: "Owner" };
    return { bg: "#f1f5f9", color: "#475569", label: role };
  };

  const statusBadge = (status: string) => {
    if (status === "active" || status === "accepted") return { bg: "#dcfce7", color: "#15803d", label: status === "active" ? "활성" : "수락" };
    if (status === "pending") return { bg: "#fff7ed", color: "#ea580c", label: "대기" };
    if (status === "disabled" || status === "rejected") return { bg: "#f1f5f9", color: "#475569", label: status === "disabled" ? "비활성" : "취소" };
    return { bg: "#f1f5f9", color: "#475569", label: status };
  };

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">팀원 관리</h3>
          <button onClick={() => setShowInvite(true)} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark shadow-sm">+ 팀원 초대</button>
        </div>

        {message.text && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === "success" ? "bg-green-100 text-green-800" :
            message.type === "warning" ? "bg-yellow-100 text-yellow-800" :
            "bg-red-100 text-red-800"
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-gray-500">로딩 중...</div>
        ) : (
          <>
            {/* 등록된 팀원 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <h4 className="text-[15px] font-bold text-gray-800">등록된 팀원 ({profiles.length}명)</h4>
              </div>

              {/* PC 테이블 */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">이름</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">이메일</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">권한</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">상태</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => {
                      const rb = roleBadge(p.role);
                      const sb = statusBadge(p.status);
                      return (
                        <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          <td className="px-5 py-3.5 text-sm text-gray-900 font-bold">{p.name || "-"}</td>
                          <td className="px-5 py-3.5 text-sm text-gray-700">{p.email}</td>
                          <td className="px-5 py-3.5 text-sm">
                            {p.id === currentUserId ? (
                              <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                            ) : (
                              <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-bold text-gray-800">
                                <option value="admin">Admin</option>
                                <option value="crew">CREW</option>
                                <option value="member">팀원</option>
                              </select>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-sm">
                            {p.id !== currentUserId && (
                              <button onClick={() => toggleStatus(p)} className="text-xs font-bold text-gray-500 hover:text-gray-700">
                                {p.status === "active" ? "비활성" : "활성화"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 모바일 카드 */}
              <div className="md:hidden">
                {profiles.map((p) => {
                  const rb = roleBadge(p.role);
                  const sb = statusBadge(p.status);
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
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 초대 내역 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <h4 className="text-[15px] font-bold text-gray-800">초대 내역 ({invitations.length}건)</h4>
              </div>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">초대 내역이 없습니다</div>
              ) : (
                <>
                  {/* PC 테이블 */}
                  <div className="hidden md:block">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">이메일</th>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">역할</th>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">배정매장</th>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">상태</th>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">초대일</th>
                          <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations.map((inv) => {
                          const rb = roleBadge(inv.role);
                          const sb = statusBadge(inv.status);
                          return (
                            <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                              <td className="px-5 py-3.5 text-sm text-gray-900 font-medium">{inv.email}</td>
                              <td className="px-5 py-3.5 text-sm">
                                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-gray-600">{inv.stores?.name || "-"}</td>
                              <td className="px-5 py-3.5 text-sm">
                                <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                              </td>
                              <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(inv.created_at).toLocaleDateString("ko-KR")}</td>
                              <td className="px-5 py-3.5 text-sm">
                                <div className="flex gap-2">
                                  {inv.status === "pending" && (
                                    <>
                                      <button onClick={() => resendInvitation(inv)} disabled={sending} className="text-xs font-bold text-blue-600 hover:text-blue-800">재발송</button>
                                      <button onClick={() => cancelInvitation(inv.id)} className="text-xs font-bold text-red-500 hover:text-red-700">취소</button>
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

                  {/* 모바일 카드 */}
                  <div className="md:hidden">
                    {invitations.map((inv) => {
                      const rb = roleBadge(inv.role);
                      const sb = statusBadge(inv.status);
                      return (
                        <div key={inv.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-gray-900" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{inv.email}</span>
                            <div className="flex gap-1.5">
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: rb.bg, color: rb.color }}>{rb.label}</span>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: sb.bg, color: sb.color }}>{sb.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {inv.stores?.name ? `📍${inv.stores.name} · ` : ""}{new Date(inv.created_at).toLocaleDateString("ko-KR")}
                            </span>
                            {inv.status === "pending" && (
                              <div className="flex gap-2">
                                <button onClick={() => resendInvitation(inv)} disabled={sending} className="text-xs font-bold text-blue-600">재발송</button>
                                <button onClick={() => cancelInvitation(inv.id)} className="text-xs font-bold text-red-500">취소</button>
                              </div>
                            )}
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

        {/* 초대 모달 */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-5">팀원 초대</h3>
              <div className="space-y-4">
                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">이메일 주소 *</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    placeholder="example@email.com"
                  />
                </div>

                {/* 역할 선택 */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">역할 *</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setInviteRole("admin"); setInviteStoreId(""); }}
                      style={{
                        flex: 1, padding: "12px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        background: inviteRole === "admin" ? "#1428A015" : "#f8fafc",
                        color: inviteRole === "admin" ? "#1428A0" : "#999",
                        outline: inviteRole === "admin" ? "2px solid #1428A0" : "1px solid #e2e8f0",
                      }}
                    >
                      관리자 (Admin)
                    </button>
                    <button
                      onClick={() => setInviteRole("crew")}
                      style={{
                        flex: 1, padding: "12px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        background: inviteRole === "crew" ? "#dcfce7" : "#f8fafc",
                        color: inviteRole === "crew" ? "#15803d" : "#999",
                        outline: inviteRole === "crew" ? "2px solid #16a34a" : "1px solid #e2e8f0",
                      }}
                    >
                      CREW (현장)
                    </button>
                  </div>
                </div>

                {/* CREW 선택 시 매장 드롭다운 */}
                {inviteRole === "crew" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">배정 매장 *</label>
                    <select
                      value={inviteStoreId}
                      onChange={(e) => setInviteStoreId(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium"
                    >
                      <option value="">매장을 선택하세요</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 안내 */}
                <div style={{ background: inviteRole === "crew" ? "#dcfce7" : "#EEF2FF", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, color: inviteRole === "crew" ? "#15803d" : "#1428A0", margin: 0, lineHeight: 1.6 }}>
                    {inviteRole === "crew"
                      ? "📍 CREW는 배정된 매장에서 입차등록, 출퇴근, 월주차 조회를 할 수 있습니다."
                      : "🔑 관리자는 모든 매장의 데이터를 조회·입력·분석할 수 있습니다."}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteRole("admin"); setInviteStoreId(""); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || sending || (inviteRole === "crew" && !inviteStoreId)}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm"
                >
                  {sending ? "발송 중..." : "초대 발송"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
