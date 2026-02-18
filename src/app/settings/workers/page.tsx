// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";

const tabs = [
  { id: "attendance", label: "출퇴근" },
  { id: "roster", label: "명부" },
  { id: "schedule", label: "근태" },
  { id: "leave", label: "연차" },
  { id: "review", label: "근무리뷰" },
  { id: "report", label: "시말서" },
];

export default function WorkersPage() {
  const [tab, setTab] = useState("roster");
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", region_id: "" });
  const [regions, setRegions] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadWorkers();
    loadRegions();
  }, []);

  const loadWorkers = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("workers").select("*, regions(name)").order("name");
    if (data) setWorkers(data);
  };

  const loadRegions = async () => {
    const supabase = createClient();
    const { data } = await supabase.from("regions").select("*").order("name");
    if (data) setRegions(data);
  };

  const handleSave = async () => {
    if (!formData.name) { setMessage("이름을 입력하세요"); return; }
    const supabase = createClient();
    if (editItem) {
      await supabase.from("workers").update({
        name: formData.name, phone: formData.phone || null,
        region_id: formData.region_id || null,
      }).eq("id", editItem.id);
    } else {
      await supabase.from("workers").insert({ org_id: oid,
        name: formData.name, phone: formData.phone || null,
        region_id: formData.region_id || null, status: "active",
      });
    }
    setShowForm(false);
    setEditItem(null);
    setFormData({ name: "", phone: "", region_id: "" });
    setMessage("");
    loadWorkers();
  };

  const toggleStatus = async (worker) => {
    const supabase = createClient();
    await supabase.from("workers").update({
      status: worker.status === "active" ? "inactive" : "active"
    }).eq("id", worker.id);
    loadWorkers();
  };

  const deleteWorker = async (worker) => {
    if (!confirm(`"${worker.name}" 근무자를 삭제하시겠습니까?\n\n관련된 출퇴근/연차/리뷰 데이터도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) return;
    const supabase = createClient();
    await supabase.from("worker_attendance").delete().eq("worker_id", worker.id);
    await supabase.from("worker_leave_records").delete().eq("worker_id", worker.id);
    await supabase.from("worker_leaves").delete().eq("worker_id", worker.id);
    await supabase.from("worker_reviews").delete().eq("worker_id", worker.id);
    await supabase.from("worker_reports").delete().eq("worker_id", worker.id);
    await supabase.from("worker_assignments").delete().eq("worker_id", worker.id);
    await supabase.from("store_default_workers").delete().eq("worker_id", worker.id);
    await supabase.from("workers").delete().eq("id", worker.id);
    loadWorkers();
  };

  const activeWorkers = workers.filter(w => w.status === "active");
  const inactiveWorkers = workers.filter(w => w.status !== "active");

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Tabs */}
        <div
          className="flex gap-1 mb-6 flex-wrap"
          style={{ background: "#f8fafc", borderRadius: 12, padding: 4, border: "1px solid #e2e8f0" }}
        >
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="cursor-pointer"
              style={{
                padding: "10px 20px", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
                background: tab === t.id ? "#fff" : "transparent",
                color: tab === t.id ? "#1428A0" : "#475569",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* 출퇴근 탭 */}
        {tab === "attendance" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>오늘의 출퇴근 현황</div>
              <div className="flex gap-2">
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontSize: 13, fontWeight: 700 }}>출근 {activeWorkers.length}명</span>
                <span style={{ padding: "4px 12px", borderRadius: 8, background: "#fee2e2", color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>미출근 0명</span>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["이름", "지역", "연락처", "상태"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeWorkers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.regions?.name || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 6, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 600 }}>활성</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeWorkers.length === 0 && (
              <div className="text-center py-10" style={{ color: "#94a3b8", fontSize: 14 }}>등록된 근무자가 없습니다</div>
            )}
          </div>
        )}

        {/* 명부 탭 */}
        {tab === "roster" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0" }}>
            <div className="flex justify-between items-center mb-5">
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>근무자 명부 ({workers.length}명)</div>
              <button
                onClick={() => { setEditItem(null); setFormData({ name: "", phone: "", region_id: "" }); setShowForm(true); }}
                className="cursor-pointer"
                style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700,
                }}
              >+ 근무자 추가</button>
            </div>

            {/* Form Modal */}
            {showForm && (
              <div style={{
                background: "#f8fafc", borderRadius: 14, padding: 24, marginBottom: 20,
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
                  {editItem ? "근무자 수정" : "근무자 추가"}
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>이름 *</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="이름"
                      className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>연락처</label>
                    <input
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="010-0000-0000"
                      className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>지역</label>
                    <select
                      value={formData.region_id}
                      onChange={e => setFormData({ ...formData, region_id: e.target.value })}
                      className="w-full"
                      style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                    >
                      <option value="">선택</option>
                      {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
                {message && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{message}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSave} className="cursor-pointer" style={{
                    padding: "10px 24px", borderRadius: 8, border: "none",
                    background: "#1428A0", color: "#fff", fontSize: 14, fontWeight: 700,
                  }}>{editItem ? "수정" : "추가"}</button>
                  <button onClick={() => { setShowForm(false); setMessage(""); }} className="cursor-pointer" style={{
                    padding: "10px 24px", borderRadius: 8, border: "1px solid #e2e8f0",
                    background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600,
                  }}>취소</button>
                </div>
              </div>
            )}

            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["이름", "지역", "연락처", "상태", "관리"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workers.map((w, i) => (
                  <tr key={w.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{w.name}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.regions?.name || "-"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#475569" }}>{w.phone || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: w.status === "active" ? "#dcfce7" : "#fee2e2",
                        color: w.status === "active" ? "#15803d" : "#b91c1c",
                      }}>{w.status === "active" ? "활성" : "비활성"}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          setEditItem(w);
                          setFormData({ name: w.name, phone: w.phone || "", region_id: w.region_id || "" });
                          setShowForm(true);
                        }} className="cursor-pointer" style={{
                          padding: "6px 14px", borderRadius: 8, border: "1px solid #e2e8f0",
                          background: "#fff", fontSize: 12, fontWeight: 600, color: "#475569",
                        }}>수정</button>
                        <button onClick={() => toggleStatus(w)} className="cursor-pointer" style={{
                          padding: "6px 14px", borderRadius: 8, border: "none",
                          background: w.status === "active" ? "#fee2e2" : "#dcfce7",
                          fontSize: 12, fontWeight: 600,
                          color: w.status === "active" ? "#b91c1c" : "#15803d",
                        }}>{w.status === "active" ? "비활성" : "활성화"}</button>
                        <button onClick={() => deleteWorker(w)} className="cursor-pointer" style={{
                          padding: "6px 14px", borderRadius: 8, border: "1px solid #fee2e2",
                          background: "#fff", fontSize: 12, fontWeight: 600, color: "#dc2626",
                        }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 나머지 탭 */}
        {!["attendance", "roster"].includes(tab) && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{tabs.find(t => t.id === tab)?.label} 관리</div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>개발 예정입니다</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}