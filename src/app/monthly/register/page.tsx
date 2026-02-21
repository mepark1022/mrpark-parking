// @ts-nocheck
"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/utils/org";
import { useRouter, useSearchParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import type { Store } from "@/lib/types/database";

const inputStyle = {
  width: "100%", padding: "11px 14px",
  border: "1px solid var(--border)", borderRadius: 10,
  fontSize: 14, color: "var(--text-primary)",
  background: "#fff", outline: "none",
  transition: "border-color 0.2s", fontFamily: "inherit"
};

const labelStyle = {
  display: "block", fontSize: 13, fontWeight: 700,
  color: "var(--text-secondary)", marginBottom: 7
};

function RequiredDot() {
  return <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>;
}

function FormSection({ title, color = "var(--navy)", children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginBottom: 18, paddingBottom: 12,
        borderBottom: `2px solid ${color}`
      }}>
        <div style={{ width: 4, height: 18, background: color, borderRadius: 2 }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function RegisterForm() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    store_id: "",
    vehicle_number: "",
    vehicle_type: "",
    customer_name: "",
    customer_phone: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    monthly_fee: 100000,
    payment_status: "unpaid" as "paid" | "unpaid" | "overdue",
    contract_status: "active" as "active" | "expired" | "cancelled",
    note: "",
  });

  useEffect(() => { loadStores(); }, []);
  useEffect(() => { if (editId) loadExisting(); }, [editId]);

  async function loadStores() {
    const oid = await getOrgId();
    if (!oid) return;
    setOrgId(oid);
    const { data } = await supabase.from("stores").select("*").eq("org_id", oid).eq("is_active", true).order("name");
    if (data) {
      setStores(data);
      if (!editId && data.length > 0) setForm((f) => ({ ...f, store_id: data[0].id }));
    }
    setLoading(false);
  }

  async function loadExisting() {
    const { data } = await supabase.from("monthly_parking").select("*").eq("id", editId).single();
    if (data) {
      setForm({
        store_id: data.store_id,
        vehicle_number: data.vehicle_number,
        vehicle_type: data.vehicle_type || "",
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        start_date: data.start_date,
        end_date: data.end_date,
        monthly_fee: data.monthly_fee,
        payment_status: data.payment_status,
        contract_status: data.contract_status,
        note: data.note || "",
      });
    }
  }

  function setEndDateFromMonths(months: number) {
    if (!form.start_date) return;
    const start = new Date(form.start_date);
    start.setMonth(start.getMonth() + months);
    start.setDate(start.getDate() - 1);
    setForm({ ...form, end_date: start.toISOString().split("T")[0] });
  }

  async function handleSave() {
    if (!form.store_id || !form.vehicle_number || !form.customer_name || !form.customer_phone || !form.start_date || !form.end_date) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    const data = {
      store_id: form.store_id,
      vehicle_number: form.vehicle_number.toUpperCase(),
      vehicle_type: form.vehicle_type || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      start_date: form.start_date,
      end_date: form.end_date,
      monthly_fee: form.monthly_fee,
      payment_status: form.payment_status,
      contract_status: form.contract_status,
      note: form.note || null,
    };
    try {
      if (editId) {
        await supabase.from("monthly_parking").update(data).eq("id", editId);
      } else {
        await supabase.from("monthly_parking").insert({ ...data, org_id: orgId });
      }
      router.push("/monthly");
    } catch (err) {
      console.error(err);
      alert("저장 실패. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  }

  // 계약 기간 계산
  const contractDays = form.start_date && form.end_date
    ? Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>로딩 중...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <style>{`
        .reg-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start; }
        .reg-form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .reg-form-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        @media (max-width: 767px) {
          .reg-grid { grid-template-columns: 1fr !important; }
          .reg-form-2col { grid-template-columns: 1fr !important; }
          .reg-form-3col { grid-template-columns: 1fr !important; }
          .reg-preview { display: none; }
        }
      `}</style>
      <div style={{ maxWidth: 780 }}>

        {/* 상단 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => router.push("/monthly")}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: "1px solid var(--border)", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 18, color: "var(--text-secondary)"
              }}
            >
              ←
            </button>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1d26", marginBottom: 2 }}>
                {editId ? "📝 월주차 수정" : "📋 월주차 등록"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {editId ? "계약 정보를 수정합니다" : "신규 월정기 주차 계약을 등록합니다"}
              </p>
            </div>
          </div>
        </div>

        <div className="reg-grid">

          {/* 메인 폼 */}
          <div className="v3-info-card">
            <div style={{ padding: "24px 28px" }}>

              {/* 매장 선택 */}
              <FormSection title="매장 선택">
                <div>
                  <label style={labelStyle}>매장<RequiredDot /></label>
                  <select
                    value={form.store_id}
                    onChange={(e) => setForm({ ...form, store_id: e.target.value })}
                    style={inputStyle}
                  >
                    {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </FormSection>

              {/* 차량 정보 */}
              <FormSection title="차량 정보" color="#1428A0">
                <div className="reg-form-2col">
                  <div>
                    <label style={labelStyle}>차량번호<RequiredDot /></label>
                    <input
                      value={form.vehicle_number}
                      onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })}
                      style={{ ...inputStyle, fontWeight: 700, letterSpacing: "0.05em" }}
                      placeholder="12가 3456"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>차종</label>
                    <input
                      value={form.vehicle_type}
                      onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                      style={inputStyle}
                      placeholder="소나타, SUV, 카니발 등"
                    />
                  </div>
                </div>
              </FormSection>

              {/* 고객 정보 */}
              <FormSection title="고객 정보" color="#10b981">
                <div className="reg-form-2col">
                  <div>
                    <label style={labelStyle}>고객명<RequiredDot /></label>
                    <input
                      value={form.customer_name}
                      onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      style={inputStyle}
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>연락처<RequiredDot /></label>
                    <input
                      value={form.customer_phone}
                      onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                      style={inputStyle}
                      placeholder="010-1234-5678"
                    />
                  </div>
                </div>
              </FormSection>

              {/* 계약 기간 */}
              <FormSection title="계약 기간" color="#7c3aed">
                <div className="reg-form-2col" style={{ marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>시작일<RequiredDot /></label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>종료일<RequiredDot /></label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* 빠른 기간 선택 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>빠른 선택</span>
                  {[
                    { label: "1개월", months: 1 },
                    { label: "3개월", months: 3 },
                    { label: "6개월", months: 6 },
                    { label: "1년", months: 12 },
                  ].map((opt) => (
                    <button
                      key={opt.months}
                      onClick={() => setEndDateFromMonths(opt.months)}
                      style={{
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--border)", background: "#fff",
                        color: "var(--text-secondary)", cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--navy)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "var(--navy)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {contractDays > 0 && (
                    <span style={{
                      marginLeft: "auto", fontSize: 12, fontWeight: 700,
                      color: "#7c3aed", background: "#ede9fe",
                      padding: "5px 12px", borderRadius: 8
                    }}>
                      총 {contractDays}일
                    </span>
                  )}
                </div>
              </FormSection>

              {/* 요금 & 상태 */}
              <FormSection title="요금 및 상태" color="var(--gold)">
                <div className="reg-form-3col">
                  <div>
                    <label style={labelStyle}>월 요금<RequiredDot /></label>
                    <div style={{ position: "relative" }}>
                      <span style={{
                        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                        fontSize: 13, color: "var(--text-muted)", fontWeight: 600
                      }}>₩</span>
                      <input
                        type="number"
                        min={0}
                        value={form.monthly_fee}
                        onChange={(e) => setForm({ ...form, monthly_fee: Number(e.target.value) || 0 })}
                        style={{ ...inputStyle, paddingLeft: 28 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>납부 상태</label>
                    <select
                      value={form.payment_status}
                      onChange={(e) => setForm({ ...form, payment_status: e.target.value as any })}
                      style={inputStyle}
                    >
                      <option value="unpaid">미납</option>
                      <option value="paid">납부</option>
                      <option value="overdue">연체</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>계약 상태</label>
                    <select
                      value={form.contract_status}
                      onChange={(e) => setForm({ ...form, contract_status: e.target.value as any })}
                      style={inputStyle}
                    >
                      <option value="active">계약중</option>
                      <option value="expired">만료</option>
                      <option value="cancelled">해지</option>
                    </select>
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label style={labelStyle}>메모</label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    rows={3}
                    style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
                    placeholder="특이사항, 할인 적용, 특별 조건 등..."
                  />
                </div>
              </FormSection>

            </div>

            {/* 하단 버튼 */}
            <div style={{
              padding: "18px 28px",
              borderTop: "1px solid var(--border-light)",
              display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10
            }}>
              <button
                onClick={() => router.push("/monthly")}
                style={{
                  padding: "11px 24px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: "1px solid var(--border)", background: "#fff",
                  color: "var(--text-secondary)", cursor: "pointer"
                }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "11px 32px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  border: "none", background: saving ? "var(--text-muted)" : "var(--navy)",
                  color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                  transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8
                }}
              >
                {saving ? "⏳ 저장 중..." : editId ? "✅ 수정 완료" : "💾 등록"}
              </button>
            </div>
          </div>

          {/* 우측 미리보기 카드 */}
          <div className="reg-preview" style={{ position: "sticky", top: 80 }}>
            <div className="v3-info-card" style={{ marginBottom: 16 }}>
              <div style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, var(--navy) 0%, #1e3a8a 100%)",
                borderRadius: "16px 16px 0 0"
              }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>계약 미리보기</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "monospace, sans-serif" }}>
                  {form.vehicle_number || "차량번호"}
                </div>
                {form.vehicle_type && (
                  <div style={{ fontSize: 12, color: "var(--gold)", marginTop: 4 }}>{form.vehicle_type}</div>
                )}
              </div>
              <div style={{ padding: "16px 18px" }}>
                {[
                  { label: "고객명", value: form.customer_name || "-" },
                  { label: "연락처", value: form.customer_phone || "-" },
                  { label: "매장", value: stores.find(s => s.id === form.store_id)?.name || "-" },
                  { label: "시작일", value: form.start_date || "-" },
                  { label: "종료일", value: form.end_date || "-" },
                ].map(item => (
                  <div key={item.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 0", borderBottom: "1px solid var(--border-light)"
                  }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.value}</span>
                  </div>
                ))}
                <div style={{
                  marginTop: 14, padding: "12px 16px",
                  background: "rgba(245,183,49,0.12)", borderRadius: 10,
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>월 요금</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)" }}>
                    ₩{form.monthly_fee.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 필수 항목 안내 */}
            <div style={{
              padding: "14px 16px",
              background: "var(--bg-card)",
              borderRadius: 12, border: "1px solid var(--border-light)"
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>📌 필수 항목</p>
              {[
                { label: "매장", ok: !!form.store_id },
                { label: "차량번호", ok: !!form.vehicle_number },
                { label: "고객명", ok: !!form.customer_name },
                { label: "연락처", ok: !!form.customer_phone },
                { label: "시작일", ok: !!form.start_date },
                { label: "종료일", ok: !!form.end_date },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 6
                }}>
                  <span style={{ fontSize: 13 }}>{item.ok ? "✅" : "⭕"}</span>
                  <span style={{ fontSize: 12, color: item.ok ? "#10b981" : "var(--text-muted)", fontWeight: 600 }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>로딩 중...</p>
        </div>
      </AppLayout>
    }>
      <RegisterForm />
    </Suspense>
  );
}
