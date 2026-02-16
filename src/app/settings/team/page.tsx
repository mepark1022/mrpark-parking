"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import AppLayout from "@/components/layout/AppLayout";

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);

    const [membersRes, invitationsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("invitations").select("*").order("created_at", { ascending: false }),
    ]);

    if (membersRes.data) setMembers(membersRes.data as ProfileRow[]);
    if (invitationsRes.data) setInvitations(invitationsRes.data as InvitationRow[]);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail) return;
    if (members.length + invitations.filter((i) => i.status === "pending").length >= 5) {
      setMessage("최대 5명까지만 등록할 수 있습니다.");
      return;
    }

    const exists = members.some((m) => m.email === inviteEmail);
    if (exists) { setMessage("이미 등록된 이메일입니다."); return; }

    const pendingExists = invitations.some((i) => i.email === inviteEmail && i.status === "pending");
    if (pendingExists) { setMessage("이미 초대된 이메일입니다."); return; }

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("invitations").insert({
      email: inviteEmail,
      role: inviteRole,
      invited_by: user?.id || null,
    });

    if (error) {
      setMessage("초대 실패. 다시 시도해주세요.");
    } else {
      setMessage("초대가 등록되었습니다.");
      setInviteEmail("");
      setShowInvite(false);
      loadData();
    }
    setSending(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function approveUser(id: string) {
    await supabase.from("profiles").update({ status: "active" }).eq("id", id);
    loadData();
  }

  async function disableUser(id: string) {
    if (id === currentUserId) { alert("자기 자신은 비활성화할 수 없습니다."); return; }
    if (!confirm("이 팀원을 비활성화하시겠습니까?")) return;
    await supabase.from("profiles").update({ status: "disabled" }).eq("id", id);
    loadData();
  }

  async function changeRole(id: string, newRole: "admin" | "member") {
    if (id === currentUserId) { alert("자기 자신의 권한은 변경할 수 없습니다."); return; }
    await supabase.from("profiles").update({ role: newRole }).eq("id", id);
    loadData();
  }

  async function cancelInvitation(id: string) {
    await supabase.from("invitations").delete().eq("id", id);
    loadData();
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "active": return <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">활성</span>;
      case "pending": return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">대기</span>;
      case "disabled": return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">비활성</span>;
      default: return null;
    }
  }

  function getRoleBadge(role: string) {
    return role === "admin"
      ? <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">관리자</span>
      : <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">팀원</span>;
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark">팀원 관리</h3>
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
          >
            + 팀원 초대
          </button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("실패") || message.includes("최대") || message.includes("이미") ? "bg-red-50 text-error" : "bg-green-50 text-success"}`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-mr-gray">로딩 중...</div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-light-gray">
                <h4 className="text-sm font-medium text-dark">등록된 팀원 ({members.length}/5)</h4>
              </div>
              <table className="w-full">
                <thead className="border-b border-light-gray">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">이름</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">이메일</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">권한</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">상태</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-light-gray last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-dark font-medium">
                        {m.name || "-"}
                        {m.id === currentUserId && <span className="ml-1 text-xs text-mr-gray">(나)</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-mr-gray">{m.email}</td>
                      <td className="px-4 py-3 text-sm">
                        {m.id === currentUserId ? getRoleBadge(m.role) : (
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.id, e.target.value as "admin" | "member")}
                            className="px-2 py-1 border border-light-gray rounded text-xs"
                          >
                            <option value="admin">관리자</option>
                            <option value="member">팀원</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(m.status)}</td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        {m.status === "pending" && (
                          <button onClick={() => approveUser(m.id)} className="text-success hover:underline">승인</button>
                        )}
                        {m.id !== currentUserId && m.status !== "disabled" && (
                          <button onClick={() => disableUser(m.id)} className="text-error hover:underline">비활성</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invitations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-light-gray">
                  <h4 className="text-sm font-medium text-dark">초대 내역</h4>
                </div>
                <table className="w-full">
                  <thead className="border-b border-light-gray">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">이메일</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">권한</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">상태</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">초대일</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-mr-gray">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-light-gray last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-dark">{inv.email}</td>
                        <td className="px-4 py-3 text-sm">{getRoleBadge(inv.role)}</td>
                        <td className="px-4 py-3 text-sm">{getStatusBadge(inv.status)}</td>
                        <td className="px-4 py-3 text-sm text-mr-gray">{inv.created_at.split("T")[0]}</td>
                        <td className="px-4 py-3 text-sm">
                          {inv.status === "pending" && (
                            <button onClick={() => cancelInvitation(inv.id)} className="text-error hover:underline">취소</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {showInvite && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="text-lg font-semibold text-dark mb-4">팀원 초대</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">이메일 *</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="team@mrpark.co.kr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark mb-1">권한</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="w-full px-3 py-2 border border-light-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="member">팀원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                <p className="text-xs text-mr-gray">초대된 사용자가 회원가입 후, 관리자가 승인하면 사용 가능합니다.</p>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-mr-gray hover:bg-gray-100 rounded-lg">취소</button>
                <button
                  onClick={handleInvite}
                  disabled={!inviteEmail || sending}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark disabled:opacity-50"
                >
                  {sending ? "처리 중..." : "초대"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}