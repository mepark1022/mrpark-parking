// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";
import CrewBottomNav, { CrewNavSpacer } from "@/components/crew/CrewBottomNav";

const ACCIDENT_TYPES = [
  { id: "scratch", icon: "🚗", label: "차량 스크래치" },
  { id: "collision", icon: "💥", label: "주차 사고" },
  { id: "missing", icon: "🔍", label: "차량 분실" },
  { id: "property", icon: "🏗️", label: "시설물 파손" },
  { id: "other", icon: "⚠️", label: "기타", full: true },
];

const STEPS = ["유형선택", "차량정보", "보고내용"];

const CSS = `
  .acc-page { min-height:100dvh; background:#F8FAFC; }
  .acc-steps {
    display:flex; align-items:flex-start; justify-content:center;
    padding:14px 20px 12px; background:#fff; border-bottom:1px solid #E2E8F0; gap:0;
  }
  .acc-step-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .acc-step-dot {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700; transition:all .2s;
  }
  .acc-step-dot.active { background:#1428A0; color:#fff; }
  .acc-step-dot.done   { background:#16A34A; color:#fff; }
  .acc-step-dot.idle   { background:#E2E8F0; color:#94A3B8; }
  .acc-step-line { flex:1; max-width:48px; height:2px; background:#E2E8F0; margin-top:14px; }
  .acc-step-line.done { background:#16A34A; }
  .acc-step-label { font-size:10px; color:#94A3B8; }
  .acc-step-label.active { color:#1428A0; font-weight:700; }
  .acc-section {
    margin:14px 16px; background:#fff; border-radius:16px; border:1px solid #E2E8F0; overflow:hidden;
  }
  .acc-section-title {
    padding:12px 16px 10px; font-size:12px; font-weight:700; color:#1428A0;
    letter-spacing:.5px; border-bottom:1px solid #F1F5F9;
  }
  .acc-section-body { padding:16px; }
  .acc-type-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .acc-type-btn {
    padding:16px 10px; border-radius:12px; border:2px solid #E2E8F0; background:#F8FAFC;
    display:flex; flex-direction:column; align-items:center; gap:8px;
    cursor:pointer; transition:all .2s; -webkit-tap-highlight-color:transparent;
  }
  .acc-type-btn:active { transform:scale(.97); }
  .acc-type-btn.selected { border-color:#1428A0; background:#EEF2FF; }
  .acc-type-icon { font-size:28px; }
  .acc-type-label { font-size:13px; font-weight:700; color:#1A1D2B; text-align:center; }
  .acc-type-full { grid-column:1/-1; }
  .acc-form-group { margin-bottom:14px; }
  .acc-form-group:last-child { margin-bottom:0; }
  .acc-form-label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
  .acc-form-label em { color:#ef4444; font-style:normal; margin-left:2px; }
  .acc-input {
    width:100%; height:48px; border:1.5px solid #E2E8F0; border-radius:10px;
    padding:0 14px; font-size:15px; color:#1A1D2B; background:#fff;
    outline:none; transition:border-color .2s; font-family:inherit;
  }
  .acc-input:focus { border-color:#1428A0; }
  .acc-plate {
    width:100%; height:60px; border:2.5px solid #E2E8F0; border-radius:12px;
    padding:0 16px; font-size:24px; font-weight:800; color:#1A1D2B;
    text-align:center; letter-spacing:3px; outline:none; text-transform:uppercase;
    transition:border-color .2s; background:#fff; font-family:inherit;
  }
  .acc-plate:focus { border-color:#1428A0; }
  .acc-textarea {
    width:100%; min-height:100px; border:1.5px solid #E2E8F0; border-radius:10px;
    padding:12px 14px; font-size:15px; color:#1A1D2B; background:#fff;
    outline:none; transition:border-color .2s; font-family:inherit;
    resize:none; line-height:1.6;
  }
  .acc-textarea:focus { border-color:#1428A0; }
  .acc-photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px; }
  .acc-photo-thumb {
    aspect-ratio:1; border-radius:10px; overflow:hidden;
    position:relative; border:1.5px solid #E2E8F0;
  }
  .acc-photo-thumb img { width:100%; height:100%; object-fit:cover; }
  .acc-photo-del {
    position:absolute; top:4px; right:4px; width:22px; height:22px;
    background:rgba(0,0,0,.55); border-radius:50%; border:none;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; color:#fff; cursor:pointer; -webkit-tap-highlight-color:transparent;
  }
  .acc-photo-add {
    aspect-ratio:1; border-radius:10px; border:2px dashed #CBD5E1; background:#F8FAFC;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:4px; cursor:pointer; font-size:11px; color:#94A3B8; font-weight:600;
    -webkit-tap-highlight-color:transparent; transition:border-color .2s;
  }
  .acc-photo-add:active { border-color:#1428A0; background:#EEF2FF; }
  .acc-btn-primary {
    width:100%; height:52px; border-radius:14px; border:none;
    background:#1428A0; color:#fff; font-size:15px; font-weight:800;
    cursor:pointer; font-family:inherit; transition:opacity .2s;
  }
  .acc-btn-primary:disabled { opacity:.45; cursor:default; }
  .acc-btn-primary:active:not(:disabled) { opacity:.82; }
  .acc-btn-ghost {
    width:100%; height:48px; border-radius:14px; border:1.5px solid #E2E8F0;
    background:#fff; color:#64748B; font-size:15px; font-weight:700;
    cursor:pointer; font-family:inherit; margin-top:8px;
  }
  .acc-btn-ghost:active { background:#F1F5F9; }
  .acc-summary-row {
    display:flex; gap:8px; font-size:13px; margin-bottom:6px; align-items:center;
  }
  .acc-done {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:60px 32px; text-align:center; gap:16px;
  }
  @keyframes popIn {
    0%{transform:scale(.5);opacity:0;} 80%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;}
  }
  .acc-done-icon { font-size:64px; animation:popIn .4s ease; }
  .acc-done-title { font-size:20px; font-weight:800; color:#1A1D2B; }
  .acc-done-sub { font-size:14px; color:#64748B; line-height:1.7; }
  .acc-done-btn {
    margin-top:8px; padding:14px 40px; border-radius:14px; border:none;
    background:#1428A0; color:#fff; font-size:15px; font-weight:800;
    cursor:pointer; font-family:inherit;
  }
  .acc-store-badge {
    display:inline-flex; align-items:center; gap:6px; padding:6px 12px;
    border-radius:20px; background:#EEF2FF; color:#1428A0;
    font-size:13px; font-weight:700;
  }
  .acc-type-summary {
    background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0;
    padding:10px 14px; display:flex; align-items:center; gap:10px; margin-bottom:14px;
  }
`;

export default function CrewAccidentPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [orgId, setOrgId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [reporterName, setReporterName] = useState("");

  const [step, setStep] = useState(0);
  const [accidentType, setAccidentType] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [phone, setPhone] = useState("");
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("org_id, name").eq("id", user.id).single();
      if (profile) { setOrgId(profile.org_id || ""); setReporterName(profile.name || ""); }
      setStoreId(localStorage.getItem("crew_store_id") || "");
      setStoreName(localStorage.getItem("crew_store_name") || "");
    })();
  }, []);

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length);
    setPhotos(p => [...p, ...files]);
    setPreviews(p => [...p, ...files.map(f => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos(p => p.filter((_, j) => j !== i));
    setPreviews(p => p.filter((_, j) => j !== i));
  };

  const handleSubmit = async () => {
    if (!accidentType || !vehicle.trim() || !orgId || !storeId) return;
    setSubmitting(true);
    try {
      const typeLabel = ACCIDENT_TYPES.find(t => t.id === accidentType)?.label || accidentType;
      const { data: report, error } = await supabase
        .from("accident_reports")
        .insert({
          org_id: orgId, store_id: storeId,
          vehicle: vehicle.trim().toUpperCase(),
          accident_type: typeLabel,
          reporter: reporterName,
          phone: phone.trim() || null,
          detail: detail.trim() || null,
          status: "접수",
          accident_at: new Date().toISOString(),
        })
        .select("id").single();
      if (error) throw error;
      if (photos.length > 0 && report?.id) {
        for (let i = 0; i < photos.length; i++) {
          const f = photos[i];
          const ext = f.name.split(".").pop() || "jpg";
          await supabase.storage.from("accident-photos")
            .upload(`${report.id}/${Date.now()}_${i}.${ext}`, f);
        }
      }
      setStep(99);
    } catch (e: any) {
      alert("제출 실패: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = ACCIDENT_TYPES.find(t => t.id === accidentType);

  if (step === 99) return (
    <>
      <style>{CSS}</style>
      <div className="acc-page">
        <CrewHeader title="사고보고" showBack />
        <div className="acc-done">
          <div className="acc-done-icon">✅</div>
          <div className="acc-done-title">사고보고 접수 완료!</div>
          <div className="acc-done-sub">
            관리자에게 보고되었습니다.<br />
            추가 조치가 필요하면 연락이 올 수 있습니다.
          </div>
          <button className="acc-done-btn" onClick={() => router.push("/crew")}>홈으로</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="acc-page">
        <CrewHeader title="사고보고" showBack />

        {/* 스텝 인디케이터 */}
        <div className="acc-steps">
          {STEPS.map((label, i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start" }}>
              <div className="acc-step-wrap">
                <div className={`acc-step-dot ${i < step ? "done" : i === step ? "active" : "idle"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`acc-step-label${i === step ? " active" : ""}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`acc-step-line${i < step ? " done" : ""}`} />}
            </div>
          ))}
        </div>

        {/* STEP 0: 유형 선택 */}
        {step === 0 && (
          <>
            {storeName && (
              <div style={{ padding:"12px 16px 0" }}>
                <div className="acc-store-badge">🏢 {storeName}</div>
              </div>
            )}
            <div className="acc-section">
              <div className="acc-section-title">📋 사고 유형 선택</div>
              <div className="acc-section-body">
                <div className="acc-type-grid">
                  {ACCIDENT_TYPES.map(t => (
                    <div
                      key={t.id}
                      className={`acc-type-btn${t.full ? " acc-type-full" : ""}${accidentType === t.id ? " selected" : ""}`}
                      onClick={() => setAccidentType(t.id)}
                    >
                      <span className="acc-type-icon">{t.icon}</span>
                      <span className="acc-type-label">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding:"0 16px 24px" }}>
              <button className="acc-btn-primary" disabled={!accidentType} onClick={() => setStep(1)}>
                다음 단계 →
              </button>
            </div>
          </>
        )}

        {/* STEP 1: 차량 정보 */}
        {step === 1 && (
          <>
            <div className="acc-section">
              <div className="acc-section-title">🚗 차량 정보</div>
              <div className="acc-section-body">
                {selectedType && (
                  <div className="acc-type-summary">
                    <span style={{ fontSize:22 }}>{selectedType.icon}</span>
                    <span style={{ fontSize:14, fontWeight:700, color:"#1A1D2B" }}>{selectedType.label}</span>
                  </div>
                )}
                <div className="acc-form-group">
                  <label className="acc-form-label">차량번호<em>*</em></label>
                  <input
                    className="acc-plate"
                    value={vehicle}
                    onChange={e => setVehicle(e.target.value.toUpperCase())}
                    placeholder="예) 12가 3456"
                    maxLength={10}
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label">
                    차주 연락처 <span style={{ color:"#94A3B8", fontSize:12, fontWeight:400 }}>(선택)</span>
                  </label>
                  <input
                    className="acc-input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    maxLength={13}
                  />
                </div>
              </div>
            </div>
            <div style={{ padding:"0 16px 24px" }}>
              <button className="acc-btn-primary" disabled={!vehicle.trim()} onClick={() => setStep(2)}>
                다음 단계 →
              </button>
              <button className="acc-btn-ghost" onClick={() => setStep(0)}>← 이전으로</button>
            </div>
          </>
        )}

        {/* STEP 2: 보고 내용 */}
        {step === 2 && (
          <>
            <div className="acc-section">
              <div className="acc-section-title">📝 사고 내용</div>
              <div className="acc-section-body">
                <div className="acc-form-group">
                  <label className="acc-form-label">
                    상세 내용 <span style={{ color:"#94A3B8", fontSize:12, fontWeight:400 }}>(선택)</span>
                  </label>
                  <textarea
                    className="acc-textarea"
                    value={detail}
                    onChange={e => setDetail(e.target.value)}
                    placeholder="사고 경위, 손상 부위, 현재 상황 등을 자세히 적어주세요."
                  />
                </div>
                <div className="acc-form-group">
                  <label className="acc-form-label">
                    사진 <span style={{ color:"#94A3B8", fontSize:12, fontWeight:400 }}>(선택, 최대 5장)</span>
                  </label>
                  <div className="acc-photo-grid">
                    {previews.map((src, i) => (
                      <div key={i} className="acc-photo-thumb">
                        <img src={src} alt="" />
                        <button className="acc-photo-del" onClick={() => removePhoto(i)}>✕</button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <div className="acc-photo-add" onClick={() => fileRef.current?.click()}>
                        <span style={{ fontSize:24 }}>📷</span>
                        <span>사진 추가</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    multiple style={{ display:"none" }} onChange={addPhotos} />
                  <div style={{ fontSize:11, color:"#94A3B8" }}>{photos.length}/5장</div>
                </div>

                {/* 제출 요약 */}
                <div style={{ background:"#F8FAFC", borderRadius:12, border:"1px solid #E2E8F0", padding:"12px 14px", marginTop:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:8 }}>📋 제출 요약</div>
                  {[
                    ["매장", storeName || "-"],
                    ["사고 유형", selectedType?.label || "-"],
                    ["차량번호", vehicle || "-"],
                    ["보고자", reporterName || "-"],
                  ].map(([k, v]) => (
                    <div key={k} className="acc-summary-row">
                      <span style={{ color:"#94A3B8", fontWeight:600, minWidth:68, fontSize:13 }}>{k}</span>
                      <span style={{ color:"#1A1D2B", fontWeight:700, fontSize:13 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding:"0 16px 24px" }}>
              <button
                className="acc-btn-primary"
                style={{ height:56, fontSize:16, background: submitting ? "#64748B" : "#ef4444" }}
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "⏳ 제출 중..." : "🚨 사고보고 제출"}
              </button>
              <button className="acc-btn-ghost" onClick={() => setStep(1)}>← 이전으로</button>
            </div>
          </>
        )}

        <CrewNavSpacer />
      </div>
      <CrewBottomNav />
    </>
  );
}
