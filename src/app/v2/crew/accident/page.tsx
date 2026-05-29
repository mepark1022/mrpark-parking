// @ts-nocheck
"use client";
export const dynamic = "force-dynamic";

/**
 * CREW v2 — 사고보고 (GAP-P1-3 / P1-6 Part 3)
 *
 * 흐름: 유형선택 → 차량정보 → 보고내용(상세+사진) → 제출 → 완료
 *
 * v2 정책 (레거시 /crew/accident 대비 변경점):
 *  - Supabase 직접 insert 제거 → POST /api/v1/accidents (API-first, credentials:include)
 *  - ⚠️ 차주 연락처 입력 제거 (v2 phone DB 저장 금지 — API도 무시)
 *  - reporter = GET /api/v1/auth/me 의 직원명 자동 (입력 안 받음)
 *  - store_id = localStorage crew_store_id (CREW 매장 컨텍스트)
 *  - 사진: POST 응답의 photo_bucket / photo_path_prefix 로 Storage 직접 업로드 (Part 1 설계 ⓐ)
 *  - accident_type 은 레거시와 동일하게 "한글 라벨"로 전송 (admin UI/GET 라벨 표시 정합)
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 사고 유형 (레거시와 동일 라벨 — DB엔 라벨 저장)
const ACCIDENT_TYPES = [
  { id: "scratch", icon: "🚗", label: "차량 스크래치" },
  { id: "collision", icon: "💥", label: "주차 사고" },
  { id: "missing", icon: "🔍", label: "차량 분실" },
  { id: "property", icon: "🏗️", label: "시설물 파손" },
  { id: "other", icon: "⚠️", label: "기타", full: true },
];

const STEPS = ["유형선택", "차량정보", "보고내용"];

const CSS = `
  .cv2ac-page { min-height:100dvh; background:#F8FAFC; padding-bottom:100px; }
  .cv2ac-header {
    background:linear-gradient(135deg,#0a1352 0%,#1428A0 100%);
    padding:14px 16px; padding-top:calc(14px + env(safe-area-inset-top,0));
    color:#fff; display:flex; align-items:center; gap:12px;
  }
  .cv2ac-back {
    width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,0.15);
    display:flex; align-items:center; justify-content:center; cursor:pointer;
    -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-back:active { background:rgba(255,255,255,0.25); }
  .cv2ac-htitle { font-size:17px; font-weight:800; letter-spacing:-0.3px; }
  .cv2ac-steps {
    display:flex; align-items:flex-start; justify-content:center;
    padding:14px 20px 12px; background:#fff; border-bottom:1px solid #E2E8F0; gap:0;
  }
  .cv2ac-step-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .cv2ac-step-dot {
    width:28px; height:28px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:700; transition:all .2s; font-family:'Outfit',sans-serif;
  }
  .cv2ac-step-dot.active { background:#1428A0; color:#fff; }
  .cv2ac-step-dot.done   { background:#16A34A; color:#fff; }
  .cv2ac-step-dot.idle   { background:#E2E8F0; color:#94A3B8; }
  .cv2ac-step-line { flex:1; max-width:48px; height:2px; background:#E2E8F0; margin-top:14px; }
  .cv2ac-step-line.done { background:#16A34A; }
  .cv2ac-step-label { font-size:10px; color:#94A3B8; }
  .cv2ac-step-label.active { color:#1428A0; font-weight:700; }
  .cv2ac-section {
    margin:14px 16px; background:#fff; border-radius:16px; border:1px solid #E2E8F0; overflow:hidden;
  }
  .cv2ac-section-title {
    padding:12px 16px 10px; font-size:12px; font-weight:700; color:#1428A0;
    letter-spacing:.5px; border-bottom:1px solid #F1F5F9;
  }
  .cv2ac-section-body { padding:16px; }
  .cv2ac-type-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .cv2ac-type-btn {
    padding:16px 10px; border-radius:12px; border:2px solid #E2E8F0; background:#F8FAFC;
    display:flex; flex-direction:column; align-items:center; gap:8px;
    cursor:pointer; transition:all .2s; -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-type-btn:active { transform:scale(.97); }
  .cv2ac-type-btn.selected { border-color:#1428A0; background:#EEF2FF; }
  .cv2ac-type-icon { font-size:28px; }
  .cv2ac-type-label { font-size:13px; font-weight:700; color:#1A1D2B; text-align:center; }
  .cv2ac-type-full { grid-column:1/-1; }
  .cv2ac-form-group { margin-bottom:14px; }
  .cv2ac-form-group:last-child { margin-bottom:0; }
  .cv2ac-form-label { display:block; font-size:13px; font-weight:600; color:#374151; margin-bottom:6px; }
  .cv2ac-form-label em { color:#ef4444; font-style:normal; margin-left:2px; }
  .cv2ac-plate {
    width:100%; height:60px; border:2.5px solid #E2E8F0; border-radius:12px;
    padding:0 16px; font-size:24px; font-weight:800; color:#1A1D2B;
    text-align:center; letter-spacing:3px; outline:none; text-transform:uppercase;
    transition:border-color .2s; background:#fff; font-family:inherit;
  }
  .cv2ac-plate:focus { border-color:#1428A0; }
  .cv2ac-textarea {
    width:100%; min-height:100px; border:1.5px solid #E2E8F0; border-radius:10px;
    padding:12px 14px; font-size:15px; color:#1A1D2B; background:#fff;
    outline:none; transition:border-color .2s; font-family:inherit;
    resize:none; line-height:1.6;
  }
  .cv2ac-textarea:focus { border-color:#1428A0; }
  .cv2ac-photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:8px; }
  .cv2ac-photo-thumb {
    aspect-ratio:1; border-radius:10px; overflow:hidden;
    position:relative; border:1.5px solid #E2E8F0;
  }
  .cv2ac-photo-thumb img { width:100%; height:100%; object-fit:cover; }
  .cv2ac-photo-del {
    position:absolute; top:4px; right:4px; width:22px; height:22px;
    background:rgba(0,0,0,.55); border-radius:50%; border:none;
    display:flex; align-items:center; justify-content:center;
    font-size:13px; color:#fff; cursor:pointer; -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-photo-add {
    aspect-ratio:1; border-radius:10px; border:2px dashed #CBD5E1; background:#F8FAFC;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:4px; cursor:pointer; font-size:11px; color:#94A3B8; font-weight:600;
    -webkit-tap-highlight-color:transparent; transition:border-color .2s;
  }
  .cv2ac-photo-add:active { border-color:#1428A0; background:#EEF2FF; }
  .cv2ac-btn-primary {
    width:100%; height:52px; border-radius:14px; border:none;
    background:#1428A0; color:#fff; font-size:15px; font-weight:800;
    cursor:pointer; font-family:inherit; transition:opacity .2s;
    -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-btn-primary:disabled { opacity:.45; cursor:default; }
  .cv2ac-btn-primary:active:not(:disabled) { opacity:.82; }
  .cv2ac-btn-ghost {
    width:100%; height:48px; border-radius:14px; border:1.5px solid #E2E8F0;
    background:#fff; color:#64748B; font-size:15px; font-weight:700;
    cursor:pointer; font-family:inherit; margin-top:8px;
    -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-btn-ghost:active { background:#F1F5F9; }
  .cv2ac-summary-row { display:flex; gap:8px; font-size:13px; margin-bottom:6px; align-items:center; }
  .cv2ac-done {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:60px 32px; text-align:center; gap:16px;
  }
  @keyframes cv2acPop {
    0%{transform:scale(.5);opacity:0;} 80%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;}
  }
  .cv2ac-done-title { font-size:20px; font-weight:800; color:#1A1D2B; }
  .cv2ac-done-sub { font-size:14px; color:#64748B; line-height:1.7; }
  .cv2ac-done-btn {
    margin-top:8px; padding:14px 40px; border-radius:14px; border:none;
    background:#1428A0; color:#fff; font-size:15px; font-weight:800;
    cursor:pointer; font-family:inherit; -webkit-tap-highlight-color:transparent;
  }
  .cv2ac-store-badge {
    display:inline-flex; align-items:center; gap:6px; padding:6px 12px;
    border-radius:20px; background:#EEF2FF; color:#1428A0; font-size:13px; font-weight:700;
  }
  .cv2ac-type-summary {
    background:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0;
    padding:10px 14px; display:flex; align-items:center; gap:10px; margin-bottom:14px;
  }
  .cv2ac-err {
    margin:0 16px 14px; padding:12px 14px; border-radius:12px;
    background:#FEF2F2; border:1px solid #FECACA; color:#DC2626;
    font-size:13px; font-weight:600;
  }
  .cv2ac-upbar {
    margin-top:10px; height:6px; border-radius:3px; background:#E2E8F0; overflow:hidden;
  }
  .cv2ac-upbar > div { height:100%; background:#1428A0; transition:width .2s; }
`;

export default function CrewV2AccidentPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [ready, setReady] = useState(false);

  const [step, setStep] = useState(0);
  const [accidentType, setAccidentType] = useState(""); // type id
  const [vehicle, setVehicle] = useState("");
  const [detail, setDetail] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [upProgress, setUpProgress] = useState<{ done: number; total: number } | null>(null);

  // 매장 컨텍스트 + 직원명 로드 (API-first)
  useEffect(() => {
    const sid = localStorage.getItem("crew_store_id");
    const sname = localStorage.getItem("crew_store_name");
    if (!sid) {
      router.replace("/v2/crew/login");
      return;
    }
    setStoreId(sid);
    setStoreName(sname || "매장");
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const { data } = await res.json();
          setReporterName(data?.employee?.name || data?.emp_no || "");
        }
      } catch { /* 무시 — 이름 없이도 제출 가능 */ }
      setReady(true);
    })();
  }, [router]);

  const addPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - photos.length);
    setPhotos((p) => [...p, ...files]);
    setPreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setPhotos((p) => p.filter((_, j) => j !== i));
    setPreviews((p) => p.filter((_, j) => j !== i));
  };

  const handleSubmit = async () => {
    if (!accidentType || !vehicle.trim() || !storeId || submitting) return;
    setSubmitting(true);
    setErrMsg("");
    try {
      const typeLabel = ACCIDENT_TYPES.find((t) => t.id === accidentType)?.label || accidentType;

      // 1) 사고 등록 (API-first) — phone/사진은 미전송
      const res = await fetch("/api/v1/accidents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          vehicle: vehicle.trim().toUpperCase(),
          accident_type: typeLabel,
          reporter: reporterName || "크루",
          detail: detail.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data?.id) {
        const msg = json?.error?.message || "사고 등록에 실패했습니다";
        throw new Error(msg);
      }

      const reportId: string = json.data.id;
      const bucket: string = json.data.photo_bucket || "accident-photos";
      const prefix: string = json.data.photo_path_prefix || `${reportId}/`;

      // 2) 사진 Storage 직접 업로드 (Part 1 설계 ⓐ). 실패해도 보고는 접수됨.
      if (photos.length > 0) {
        setUpProgress({ done: 0, total: photos.length });
        for (let i = 0; i < photos.length; i++) {
          const f = photos[i];
          const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
          const path = `${prefix}${Date.now()}_${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(path, f, { contentType: f.type || "image/jpeg", upsert: false });
          if (upErr) console.error("[cv2ac] photo upload:", upErr.message);
          setUpProgress({ done: i + 1, total: photos.length });
        }
      }

      setStep(99);
    } catch (e: any) {
      setErrMsg(e.message || "제출 중 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
      setUpProgress(null);
    }
  };

  const selectedType = ACCIDENT_TYPES.find((t) => t.id === accidentType);

  // ── 완료 화면 ──
  if (step === 99) {
    return (
      <>
        <style>{CSS}</style>
        <div className="cv2ac-page">
          <div className="cv2ac-header">
            <div className="cv2ac-htitle">사고보고</div>
          </div>
          <div className="cv2ac-done">
            <div style={{
              width: 72, height: 72, background: "#DCFCE7", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "cv2acPop .4s ease",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16A34A"
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <div className="cv2ac-done-title">사고보고 접수 완료!</div>
            <div className="cv2ac-done-sub">
              관리자에게 보고되었습니다.<br />
              추가 조치가 필요하면 연락이 올 수 있습니다.
            </div>
            <button className="cv2ac-done-btn" onClick={() => router.push("/v2/crew")}>홈으로</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="cv2ac-page">
        {/* ── 헤더 ── */}
        <div className="cv2ac-header">
          <div className="cv2ac-back" onClick={() => (step === 0 ? router.push("/v2/crew") : setStep(step - 1))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
              strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div className="cv2ac-htitle">사고보고</div>
        </div>

        {/* ── 스텝 인디케이터 ── */}
        <div className="cv2ac-steps">
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start" }}>
              <div className="cv2ac-step-wrap">
                <div className={`cv2ac-step-dot ${i < step ? "done" : i === step ? "active" : "idle"}`}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span className={`cv2ac-step-label${i === step ? " active" : ""}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`cv2ac-step-line${i < step ? " done" : ""}`} />}
            </div>
          ))}
        </div>

        {errMsg && <div className="cv2ac-err">⚠️ {errMsg}</div>}

        {/* ── STEP 0: 유형 선택 ── */}
        {step === 0 && (
          <>
            {storeName && (
              <div style={{ padding: "12px 16px 0" }}>
                <div className="cv2ac-store-badge">🏢 {storeName}</div>
              </div>
            )}
            <div className="cv2ac-section">
              <div className="cv2ac-section-title">사고 유형 선택</div>
              <div className="cv2ac-section-body">
                <div className="cv2ac-type-grid">
                  {ACCIDENT_TYPES.map((t) => (
                    <div
                      key={t.id}
                      className={`cv2ac-type-btn${t.full ? " cv2ac-type-full" : ""}${accidentType === t.id ? " selected" : ""}`}
                      onClick={() => setAccidentType(t.id)}
                    >
                      <span className="cv2ac-type-icon">{t.icon}</span>
                      <span className="cv2ac-type-label">{t.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "0 16px 24px" }}>
              <button className="cv2ac-btn-primary" disabled={!accidentType} onClick={() => setStep(1)}>
                다음 단계 →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 1: 차량 정보 (차주 연락처 제거) ── */}
        {step === 1 && (
          <>
            <div className="cv2ac-section">
              <div className="cv2ac-section-title">차량 정보</div>
              <div className="cv2ac-section-body">
                {selectedType && (
                  <div className="cv2ac-type-summary">
                    <span style={{ fontSize: 22 }}>{selectedType.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1D2B" }}>{selectedType.label}</span>
                  </div>
                )}
                <div className="cv2ac-form-group">
                  <label className="cv2ac-form-label">차량번호<em>*</em></label>
                  <input
                    className="cv2ac-plate"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value.toUpperCase())}
                    placeholder="예) 12가 3456"
                    maxLength={10}
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: "0 16px 24px" }}>
              <button className="cv2ac-btn-primary" disabled={!vehicle.trim()} onClick={() => setStep(2)}>
                다음 단계 →
              </button>
              <button className="cv2ac-btn-ghost" onClick={() => setStep(0)}>← 이전으로</button>
            </div>
          </>
        )}

        {/* ── STEP 2: 보고 내용 ── */}
        {step === 2 && (
          <>
            <div className="cv2ac-section">
              <div className="cv2ac-section-title">사고 내용</div>
              <div className="cv2ac-section-body">
                <div className="cv2ac-form-group">
                  <label className="cv2ac-form-label">
                    상세 내용 <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 400 }}>(선택)</span>
                  </label>
                  <textarea
                    className="cv2ac-textarea"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="사고 경위, 손상 부위, 현재 상황 등을 자세히 적어주세요."
                  />
                </div>
                <div className="cv2ac-form-group">
                  <label className="cv2ac-form-label">
                    사진 <span style={{ color: "#94A3B8", fontSize: 12, fontWeight: 400 }}>(선택, 최대 5장)</span>
                  </label>
                  <div className="cv2ac-photo-grid">
                    {previews.map((src, i) => (
                      <div key={i} className="cv2ac-photo-thumb">
                        <img src={src} alt="" />
                        <button className="cv2ac-photo-del" onClick={() => removePhoto(i)}>✕</button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <div className="cv2ac-photo-add" onClick={() => fileRef.current?.click()}>
                        <span style={{ fontSize: 24 }}>📷</span>
                        <span>사진 추가</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment"
                    multiple style={{ display: "none" }} onChange={addPhotos} />
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{photos.length}/5장</div>
                </div>

                {/* 제출 요약 */}
                <div style={{ background: "#F8FAFC", borderRadius: 12, border: "1px solid #E2E8F0", padding: "12px 14px", marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 8 }}>📋 제출 요약</div>
                  {[
                    ["매장", storeName || "-"],
                    ["사고 유형", selectedType?.label || "-"],
                    ["차량번호", vehicle || "-"],
                    ["보고자", reporterName || "-"],
                  ].map(([k, v]) => (
                    <div key={k} className="cv2ac-summary-row">
                      <span style={{ color: "#94A3B8", fontWeight: 600, minWidth: 68, fontSize: 13 }}>{k}</span>
                      <span style={{ color: "#1A1D2B", fontWeight: 700, fontSize: 13 }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* 업로드 진행률 */}
                {upProgress && (
                  <div>
                    <div style={{ fontSize: 12, color: "#1428A0", fontWeight: 600, marginTop: 12 }}>
                      사진 업로드 중… {upProgress.done}/{upProgress.total}
                    </div>
                    <div className="cv2ac-upbar">
                      <div style={{ width: `${(upProgress.done / upProgress.total) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: "0 16px 24px" }}>
              <button
                className="cv2ac-btn-primary"
                style={{ height: 56, fontSize: 16, background: submitting ? "#64748B" : "#ef4444" }}
                disabled={submitting || !ready}
                onClick={handleSubmit}
              >
                {submitting ? "⏳ 제출 중..." : "🚨 사고보고 제출"}
              </button>
              <button className="cv2ac-btn-ghost" onClick={() => setStep(1)} disabled={submitting}>← 이전으로</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
