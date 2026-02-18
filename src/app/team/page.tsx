// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

type Profile = { id: string; email: string; name: string; role: string; status: string };
type Invitation = { id: string; email: string; role: string; status: string; created_at: string; token: string };

export default function TeamPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
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

    const [profilesRes, invitationsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("org_id", oid).order("created_at"),
      supabase.from("invitations").select("*").eq("org_id", oid).order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (invitationsRes.data) setInvitations(invitationsRes.data);
    setLoading(false);
  }

  async function handleInvite() {
    if (!inviteEmail) return;
    setSending(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, invitedBy: currentUserId }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({ text: data.error || "초대 실패", type: "error" });
      } else if (data.emailSent) {
        setMessage({ text: `${inviteEmail}로 초대 이메일을 발송했습니다!`, type: "success" });
        setInviteEmail("");
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

  async function changeRole(profileId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    loadData();
  }

  async function toggleStatus(profile: Profile) {
    const newStatus = profile.status === "active" ? "disabled" : "active";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", profile.id);
    loadData();
  }

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
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-3.5 text-sm text-gray-900 font-bold">{p.name || "-"}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-700">{p.email}</td>
                      <td className="px-5 py-3.5 text-sm">
                        {p.id === currentUserId ? (
                          <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold">{p.role === "admin" ? "관리자" : "팀원"}</span>
                        ) : (
                          <select value={p.role} onChange={(e) => changeRole(p.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-bold text-gray-800">
                            <option value="admin">관리자</option>
                            <option value="member">팀원</option>
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          p.status === "active" ? "bg-green-100 text-green-800" :
                          p.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {p.status === "active" ? "활성" : p.status === "pending" ? "대기" : "비활성"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">
                        {p.id !== currentUserId && (
                          <button onClick={() => toggleStatus(p)} className="text-xs font-bold text-gray-500 hover:text-gray-700">
                            {p.status === "active" ? "비활성" : "활성화"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 초대 내역 */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <h4 className="text-[15px] font-bold text-gray-800">초대 내역 ({invitations.length}건)</h4>
              </div>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">초대 내역이 없습니다</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">이메일</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">권한</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">상태</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">초대일</th>
                      <th className="text-left px-5 py-3 text-sm font-bold text-gray-700">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-3.5 text-sm text-gray-900 font-medium">{inv.email}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-700">{inv.role === "admin" ? "관리자" : "팀원"}</td>
                        <td className="px-5 py-3.5 text-sm">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            inv.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                            inv.status === "accepted" ? "bg-green-100 text-green-800" :
                            "bg-gray-100 text-gray-500"
                          }`}>
                            {inv.status === "pending" ? "대기" : inv.status === "accepted" ? "수락" : "취소"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{new Date(inv.created_at).toLocaleDateString("ko-KR")}</td>
                        <td className="px-5 py-3.5 text-sm">
                          {inv.status === "pending" && (
                            <button onClick={() => cancelInvitation(inv.id)} className="text-xs font-bold text-red-500 hover:text-red-700">취소</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* 초대 모달 */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-900 mb-5">팀원 초대</h3>
              <div className="space-y-4">
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
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">권한</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[15px] text-gray-900 font-medium"
                  >
                    <option value="member">팀원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800">입력한 이메일로 초대 링크가 발송됩니다. 초대받은 사람은 링크를 통해 가입할 수 있습니다.</p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-7">
                <button onClick={() => { setShowInvite(false); setInviteEmail(""); }} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button onClick={handleInvite} disabled={!inviteEmail || sending} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-dark disabled:opacity-50 shadow-sm">
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