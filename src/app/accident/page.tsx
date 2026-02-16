// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase/client";

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
    const { data } = await supabase.from("stores").select("id, name").eq("is_active", true).order("name");
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
        {/* Mode Toggle */}
        <div
          className="flex gap-1 mb-6 w-fit"
          style={{ background: "#f8fafc", borderRadius: 10, padding: 3, border: "1px solid #e2e8f0" }}
        >
          {[["list", "보고 목록"], ["report", "새 보고"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setMode(v); setMessage(""); }}
              className="cursor-pointer"
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                fontSize: 14, fontWeight: mode === v ? 700 : 500,
                background: mode === v ? "#ffffff" : "transparent",
                color: mode === v ? "#1428A0" : "#475569",
                boxShadow: mode === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >{l}</button>
          ))}
        </div>

        {mode === "list" && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { title: "이번 달 사고", value: "0건", color: "#dc2626" },
                { title: "처리중", value: "0건", color: "#ea580c" },
                { title: "완료", value: "0건", color: "#16a34a" },
              ].map((k, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 16, padding: "22px 24px",
                  border: "1px solid #e2e8f0",
                }}>
                  <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500, marginBottom: 8 }}>{k.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            <div style={{
              background: "#fff", borderRadius: 16, padding: 64, border: "1px solid #e2e8f0",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>사고보고 내역이 없습니다</div>
              <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>새 보고를 작성하면 여기에 표시됩니다</div>
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
            border: "1px solid #e2e8f0", maxWidth: 640,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 24 }}>새 사고보고 작성</div>

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