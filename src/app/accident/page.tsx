// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, getUserContext } from "@/lib/utils/org";

export default function AccidentPage() {
  const [mode, setMode] = useState("list");
  const [stores, setStores] = useState([]);
  const [form, setForm] = useState({
    store: "", reporter: "", datetime: "", vehicle: "", phone: "", detail: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const supabase = createClient();
    const ctx = await getUserContext();
    if (!ctx.orgId) return;
    let query = supabase.from("stores").select("id, name").eq("org_id", ctx.orgId).eq("is_active", true).order("name");
    if (!ctx.allStores && ctx.storeIds.length > 0) query = query.in("id", ctx.storeIds);
    else if (!ctx.allStores) { setStores([]); return; }
    const { data } = await query;
    if (data) setStores(data);
  };

  const handleSubmit = () => {
    if (!form.store || !form.reporter || !form.vehicle) {
      setMessage("매장, 보고자, 차량번호는 필수입니다");
      return;
    }
    setMessage("사고보고가 전송되었습니다! (DB 연동 예정)");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* Mode Toggle - v3 */}
        <div className="v3-period-tabs mb-6" style={{ display: "inline-flex", gap: 4, padding: 4 }}>
          {[["list", "보고 목록"], ["report", "새 보고"]].map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v); setMessage(""); }}
              className={`v3-period-tab cursor-pointer${mode === v ? " active" : ""}`}>{l}</button>
          ))}
        </div>

        {mode === "list" && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { title: "이번 달 사고", value: "0건", color: "var(--mp-error)" },
                { title: "처리중", value: "0건", color: "var(--mp-warning)" },
                { title: "완료", value: "0건", color: "var(--mp-success)" },
              ].map((k, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 16, padding: "22px 24px",
                  border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)",
                }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>{k.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: 64, border: "1px solid var(--border-light)",
              boxShadow: "var(--shadow-sm)", textAlign: "center",
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>사고보고 내역이 없습니다</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20 }}>새 보고를 작성하면 여기에 표시됩니다</div>
              <button
                onClick={() => setMode("report")}
                className="cursor-pointer"
                style={{
                  padding: "12px 32px", borderRadius: 12, border: "none",
                  background: "#dc2626", color: "#fff", fontSize: 15, fontWeight: 700,
                  boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                }}
              >새 사고보고 작성</button>
            </div>
          </>
        )}

        {mode === "report" && (
          <div style={{
            background: "#fff", borderRadius: 16, padding: 32,
            border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", maxWidth: 640,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 24 }}>새 사고보고 작성</div>

            {/* 매장 */}
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>매장명 *</label>
              <select
                value={form.store}
                onChange={e => setForm({ ...form, store: e.target.value })}
                className="w-full"
                style={{
                  padding: "12px 16px", borderRadius: 10,
                  border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b",
                }}
              >
                <option value="">매장 선택</option>
                {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            {/* 보고자 */}
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>보고자 *</label>
              <input
                value={form.reporter}
                onChange={e => setForm({ ...form, reporter: e.target.value })}
                placeholder="보고자 이름"
                className="w-full"
                style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b" }}
              />
            </div>

            {/* 사고일시 */}
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>사고 일시</label>
              <input
                type="datetime-local"
                value={form.datetime}
                onChange={e => setForm({ ...form, datetime: e.target.value })}
                className="w-full"
                style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b" }}
              />
            </div>

            {/* 차량번호 */}
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>사고 차량번호 *</label>
              <input
                value={form.vehicle}
                onChange={e => setForm({ ...form, vehicle: e.target.value })}
                placeholder="예: 12가 3456"
                className="w-full"
                style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b" }}
              />
            </div>

            {/* 차주 연락처 */}
            <div className="mb-4">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>차주 연락처</label>
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="010-0000-0000"
                className="w-full"
                style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, color: "#1e293b" }}
              />
            </div>

            {/* 상세내용 */}
            <div className="mb-6">
              <label className="block mb-1.5" style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>사고 상세내용</label>
              <textarea
                rows={4}
                value={form.detail}
                onChange={e => setForm({ ...form, detail: e.target.value })}
                placeholder="사고 상황을 상세히 입력해주세요..."
                className="w-full"
                style={{
                  padding: "12px 16px", borderRadius: 10, border: "1px solid #e2e8f0",
                  fontSize: 14, color: "#1e293b", resize: "vertical",
                }}
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              className="w-full cursor-pointer"
              style={{
                padding: "14px", borderRadius: 12, border: "none",
                background: "#dc2626", color: "#fff", fontSize: 16, fontWeight: 800,
                boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
              }}
            >🚨 본사로 사고보고 전송</button>

            {message && (
              <p className="text-center mt-3" style={{
                fontSize: 14, fontWeight: 700,
                color: message.includes("전송") ? "#16a34a" : "#dc2626",
              }}>{message}</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}