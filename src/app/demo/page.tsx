// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";

/* ── 컬러/스타일 상수 ── */
const C = {
  navy: "#1428A0", navyD: "#0e1d7a", navyL: "#1e38c0",
  gold: "#F5B731", goldL: "#fac94a",
  dark: "#1A1D2B", body: "#222", gray: "#666",
  light: "#E8E8E8", border: "#D0D2DA", white: "#fff",
  bg: "#F7F8FC",
  success: "#16A34A", warn: "#EA580C", err: "#DC2626",
  info: "#0F9ED5",
};

/* ── 차량번호 형식 검증 (간단) ── */
const isValidPlate = (v: string) => /^[0-9]{2,3}[가-힣][0-9]{4}$/.test(v.replace(/\s/g, ""));
const isValidPhone = (v: string) => /^01[0-9]{8,9}$/.test(v.replace(/-/g, ""));

type DemoState = "idle" | "loading" | "sent" | "ready" | "done" | "error";

export default function DemoPage() {
  const [plate, setPlate] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<DemoState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* 차량준비 알림톡 발송 */
  const sendReadyAlimtalk = async () => {
    try {
      await fetch("/api/demo/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/-/g, ""),
          plateNumber: plate.replace(/\s/g, ""),
          ticketId,
        }),
      });
    } catch (e) {
      console.warn("[Demo] 차량준비 알림톡 발송 실패:", e);
    }
  };

  /* 10초 카운트다운 → 차량준비 알림톡 */
  useEffect(() => {
    if (state === "sent") {
      setCountdown(10);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            sendReadyAlimtalk();
            setState("ready");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  /* 차량준비 상태 → 3초 후 완료 */
  useEffect(() => {
    if (state === "ready") {
      const t = setTimeout(() => setState("done"), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const handleSubmit = async () => {
    const cleanPlate = plate.replace(/\s/g, "");
    const cleanPhone = phone.replace(/-/g, "");
    if (!isValidPlate(cleanPlate)) { setErrorMsg("올바른 차량번호를 입력하세요 (예: 12가3456)"); return; }
    if (!isValidPhone(cleanPhone)) { setErrorMsg("올바른 연락처를 입력하세요 (예: 01012345678)"); return; }
    setErrorMsg("");
    setState("loading");

    try {
      const res = await fetch("/api/demo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: cleanPlate, phone: cleanPhone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "체험 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
        setState("error");
        return;
      }
      if (data.ticketId) setTicketId(data.ticketId);
      setState("sent");
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
      setState("error");
    }
  };

  const resetDemo = () => {
    setState("idle");
    setPlate("");
    setPhone("");
    setErrorMsg("");
    setTicketId(null);
  };

  return (
    <div style={{ fontFamily: "'Noto Sans KR', sans-serif", color: C.body, background: C.white, minHeight: "100vh" }}>
      {/* ── GNB ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 1000,
        background: "rgba(255,255,255,.96)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.light}`, padding: "0 40px", height: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: C.white,
            border: `2.5px solid ${C.dark}`, position: "relative", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 10, background: C.gold }} />
            <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: 17, color: C.dark, position: "relative", zIndex: 1, marginTop: -5 }}>P</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.dark, lineHeight: 1.1 }}>미팍티켓</span>
            <span style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 10, color: C.gold, letterSpacing: 1.5 }}>ME.PARK 2.0</span>
          </div>
        </a>
        <a href="/" style={{
          fontSize: 13, fontWeight: 700, color: C.navy, padding: "8px 16px",
          borderRadius: 8, border: `1.5px solid ${C.navy}`, textDecoration: "none",
        }}>← 홈으로</a>
      </nav>

      {/* ── HERO 헤더 ── */}
      <section style={{ background: C.white, padding: "80px 40px 60px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 700, color: C.white, letterSpacing: 2, textTransform: "uppercase",
            background: C.navy, borderRadius: 20, padding: "6px 16px", marginBottom: 18,
          }}>🎮 VIRTUAL EXPERIENCE</span>
          <h1 style={{ fontSize: 42, fontWeight: 800, color: C.dark, lineHeight: 1.3, marginBottom: 16 }}>
            미팍티켓 <span style={{ color: C.gold }}>가상체험</span>
          </h1>
          <p style={{ fontSize: 16, color: C.gray, lineHeight: 1.8, maxWidth: 520, margin: "0 auto" }}>
            주차요원의 운영 프로세스와 고객이 받는 경험을<br />직접 확인하세요
          </p>
        </div>
      </section>

      {/* ── 프로세스 비교 (좌우 횡배치) ── */}
      <section style={{ background: C.bg, padding: "60px 40px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* CREW 프로세스 */}
          <div style={{ background: C.navy, borderRadius: 20, padding: "36px 32px", color: C.white }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 2, marginBottom: 8 }}>CREW 주차요원 프로세스</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 28 }}>운영 자동화</div>
            {[
              { num: "①", title: "번호판 OCR 스캔", desc: "ML Kit 0.5초 오프라인 인식" },
              { num: "②", title: "입차 정보 확인·등록", desc: "QR 전자주차권 자동 생성" },
              { num: "③", title: "고객 알림톡 자동 발송", desc: "전화번호 즉시 삭제" },
            ].map((item) => (
              <div key={item.num} style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Outfit", fontSize: 14, fontWeight: 800, flexShrink: 0,
                }}>{item.num}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 고객 경험 */}
          <div style={{ background: C.white, borderRadius: 20, padding: "36px 32px", border: `1.5px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, letterSpacing: 2, marginBottom: 8 }}>고객 경험 프로세스</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.dark, marginBottom: 28 }}>스마트 주차</div>
            {[
              { num: "①", title: "카카오 알림톡 수신", desc: "카카오톡으로 실시간 알림" },
              { num: "②", title: "주차권·실시간 요금 확인", desc: "토스페이먼츠 모바일 결제" },
              { num: "③", title: "차량 준비 완료 안내", desc: "주차부스로 이동" },
            ].map((item) => (
              <div key={item.num} style={{ display: "flex", gap: 14, marginBottom: 20, alignItems: "flex-start" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: `rgba(20,40,160,.06)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Outfit", fontSize: 14, fontWeight: 800, color: C.navy, flexShrink: 0,
                }}>{item.num}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.dark, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: C.gray }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 알림톡 전송 방식 (2열 카드) ── */}
      <section style={{ background: C.white, padding: "60px 40px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, letterSpacing: 2, marginBottom: 8 }}>알림톡 전송 방식</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: C.dark }}>두 가지 방식으로 전자주차권을 발급합니다</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ borderRadius: 16, padding: "28px 24px", border: `2px solid ${C.navy}`, background: C.white }}>
              <div style={{
                display: "inline-flex", padding: "4px 12px", borderRadius: 12,
                background: `rgba(20,40,160,.06)`, fontSize: 11, fontWeight: 700, color: C.navy,
                marginBottom: 14,
              }}>방식 A</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 8 }}>주차요원 발송</div>
              <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.7 }}>
                · 번호판 OCR 스캔<br />
                · 연락처 입력<br />
                · 알림톡 자동 발송<br />
                · 전화번호 즉시 삭제
              </div>
            </div>
            <div style={{ borderRadius: 16, padding: "28px 24px", border: `2px solid ${C.gold}`, background: C.white }}>
              <div style={{
                display: "inline-flex", padding: "4px 12px", borderRadius: 12,
                background: "rgba(245,183,49,.12)", fontSize: 11, fontWeight: 700, color: "#9a6f00",
                marginBottom: 14,
              }}>방식 B</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 8 }}>고객 QR 스캔</div>
              <div style={{ fontSize: 13, color: C.gray, lineHeight: 1.7 }}>
                · 입구 고정 QR 스캔<br />
                · 차량번호 직접 입력<br />
                · 전자주차권 즉시 발급
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 안내 배너 (골드) ── */}
      <section style={{ padding: "0 40px" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto", background: "rgba(245,183,49,.1)",
          border: `1.5px solid ${C.gold}`, borderRadius: 14, padding: "16px 24px",
          textAlign: "center", fontSize: 14, fontWeight: 700, color: "#9a6f00",
        }}>
          💡 가상체험에서는 <strong style={{ color: C.dark }}>주차요원 직접입력 시나리오(방식 A)</strong>로 시연합니다
        </div>
      </section>

      {/* ── 가상체험 CTA (다크 배경, 2컬럼) ── */}
      <section style={{ background: C.dark, padding: "80px 40px", marginTop: 60 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
          {/* 좌측: CREW앱 OCR 폰 목업 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 280, background: "#111318", borderRadius: 40, padding: 12, position: "relative",
              boxShadow: "0 30px 60px rgba(0,0,0,.3)",
            }}>
              <div style={{
                position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)",
                width: 80, height: 5, background: "rgba(255,255,255,.15)", borderRadius: 3,
              }} />
              <div style={{ borderRadius: 30, overflow: "hidden", background: "#111318", height: 480 }}>
                {/* OCR 탑바 */}
                <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, background: C.white,
                      border: `2px solid ${C.dark}`, position: "relative", overflow: "hidden",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 7, background: C.gold }} />
                      <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: 12, color: C.dark, position: "relative", zIndex: 1, marginTop: -3 }}>P</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: C.white }}>미팍<span style={{ fontFamily: "Outfit", fontWeight: 700, color: C.gold }}>Ticket</span></span>
                  </div>
                </div>
                {/* 가이드 텍스트 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, margin: "16px 0 14px", fontSize: 13, fontWeight: 700, color: C.white }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold, animation: "pulse 2s infinite" }} />
                  번호판을 박스 안에 맞춰주세요
                </div>
                {/* 뷰파인더 */}
                <div style={{
                  margin: "0 20px", height: 150, background: "#1a1d2b", borderRadius: 8,
                  position: "relative", overflow: "hidden",
                }}>
                  {/* 골드 코너 */}
                  <div style={{ position: "absolute", top: 10, left: 10, width: 22, height: 22, borderTop: `3px solid ${C.gold}`, borderLeft: `3px solid ${C.gold}` }} />
                  <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderTop: `3px solid ${C.gold}`, borderRight: `3px solid ${C.gold}` }} />
                  <div style={{ position: "absolute", bottom: 10, left: 10, width: 22, height: 22, borderBottom: `3px solid ${C.gold}`, borderLeft: `3px solid ${C.gold}` }} />
                  <div style={{ position: "absolute", bottom: 10, right: 10, width: 22, height: 22, borderBottom: `3px solid ${C.gold}`, borderRight: `3px solid ${C.gold}` }} />
                  {/* 스캔라인 애니메이션 */}
                  <div style={{
                    position: "absolute", left: 10, right: 10, height: 2,
                    background: C.gold, opacity: .7, animation: "scanline 2.5s ease-in-out infinite",
                  }} />
                </div>
                {/* 하단 버튼 */}
                <div style={{ padding: "24px 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: C.gold, borderRadius: 12, padding: 14, textAlign: "center",
                    fontSize: 14, fontWeight: 800, color: C.dark,
                  }}>📷 번호판 스캔</div>
                  <div style={{
                    background: "transparent", border: "1.5px solid rgba(255,255,255,.2)",
                    borderRadius: 12, padding: 12, textAlign: "center",
                    fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.7)",
                  }}>직접 입력</div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: "rgba(255,255,255,.5)", textAlign: "center" }}>
              <span style={{ color: C.gold, fontWeight: 700 }}>CREW앱</span> 실제 화면
            </div>
          </div>

          {/* 우측: 가상체험 입력 폼 */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: 2, marginBottom: 8 }}>VIRTUAL EXPERIENCE</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: C.white, lineHeight: 1.3, marginBottom: 12 }}>
              지금 바로<br /><span style={{ color: C.gold }}>체험</span>해 보세요
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,.5)", lineHeight: 1.7, marginBottom: 32 }}>
              차량번호와 연락처를 입력하시면<br />실제 카카오 알림톡을 수신하실 수 있습니다
            </p>

            {state === "idle" || state === "error" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.6)", display: "block", marginBottom: 6 }}>차량번호</label>
                  <input
                    type="text"
                    placeholder="예: 12가3456"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: 12,
                      border: `1.5px solid rgba(255,255,255,.15)`, background: "rgba(255,255,255,.06)",
                      color: C.white, fontSize: 16, fontFamily: "Outfit", fontWeight: 700, letterSpacing: 1,
                      outline: "none",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.6)", display: "block", marginBottom: 6 }}>연락처</label>
                  <input
                    type="tel"
                    placeholder="예: 01012345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: 12,
                      border: `1.5px solid rgba(255,255,255,.15)`, background: "rgba(255,255,255,.06)",
                      color: C.white, fontSize: 16, fontFamily: "Outfit", fontWeight: 700, letterSpacing: 1,
                      outline: "none",
                    }}
                  />
                </div>
                {errorMsg && (
                  <div style={{ fontSize: 13, color: C.err, fontWeight: 600, padding: "8px 0" }}>⚠️ {errorMsg}</div>
                )}
                <button
                  onClick={handleSubmit}
                  style={{
                    marginTop: 8, width: "100%", padding: "16px", borderRadius: 14,
                    background: C.gold, color: C.dark, fontSize: 17, fontWeight: 800,
                    border: "none", cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  🚗 체험 시작하기
                </button>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", textAlign: "center", lineHeight: 1.6 }}>
                  전화번호는 알림톡 발송 즉시 삭제됩니다 · 동일 번호 1일 3회 제한
                </div>
              </div>
            ) : state === "loading" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "pulse 1.5s infinite" }}>🚗</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 8 }}>데모 티켓 생성 중...</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>잠시만 기다려주세요</div>
              </div>
            ) : state === "sent" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📨</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.gold, marginBottom: 8 }}>입차 알림톡 발송 완료!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", marginBottom: 24, lineHeight: 1.7 }}>
                  카카오톡을 확인하세요.<br />
                  <span style={{ fontFamily: "Outfit", fontSize: 48, fontWeight: 900, color: C.gold }}>{countdown}</span>
                  <br />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>초 후 차량 준비 완료 알림톡이 발송됩니다</span>
                </div>
              </div>
            ) : state === "ready" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🟢</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.success, marginBottom: 8 }}>차량 준비 완료 알림톡 발송!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", lineHeight: 1.7 }}>
                  카카오톡에서 두 번째 알림을 확인하세요
                </div>
              </div>
            ) : state === "done" ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>체험 완료!</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.6)", lineHeight: 1.7, marginBottom: 24 }}>
                  미팍티켓의 전체 프로세스를 체험하셨습니다.<br />
                  도입을 원하시면 아래로 연락해 주세요.
                </div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <a href="tel:18991871" style={{
                    padding: "12px 28px", borderRadius: 12, background: C.gold,
                    color: C.dark, fontSize: 15, fontWeight: 800, textDecoration: "none",
                  }}>📞 1899-1871</a>
                  <button
                    onClick={resetDemo}
                    style={{
                      padding: "12px 28px", borderRadius: 12, background: "transparent",
                      color: C.white, fontSize: 15, fontWeight: 700,
                      border: "1.5px solid rgba(255,255,255,.3)", cursor: "pointer",
                      fontFamily: "'Noto Sans KR', sans-serif",
                    }}
                  >다시 체험하기</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── 하단 CTA ── */}
      <section style={{ background: C.navy, padding: "60px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.white, marginBottom: 12 }}>
          주차장 운영의 디지털 전환, <span style={{ color: C.gold }}>미팍티켓</span>
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.6)", marginBottom: 28 }}>
          QR 전자주차권 · 모바일 결제 · 실시간 매출 추적
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="tel:18991871" style={{
            padding: "14px 36px", borderRadius: 12, background: C.gold,
            color: C.dark, fontSize: 15, fontWeight: 800, textDecoration: "none",
          }}>📞 도입 문의</a>
          <a href="/" style={{
            padding: "14px 36px", borderRadius: 12, background: "transparent",
            color: C.white, fontSize: 15, fontWeight: 700,
            border: "1.5px solid rgba(255,255,255,.3)", textDecoration: "none",
          }}>홈페이지</a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.dark, padding: "40px 40px 24px", color: "rgba(255,255,255,.5)", fontSize: 12, lineHeight: 1.8, textAlign: "center" }}>
        <strong style={{ color: "rgba(255,255,255,.7)" }}>주식회사 미스터팍</strong> (Mr. Park Co., Ltd.)<br />
        대표: 이지섭 | 설립: 2018.09.10<br />
        인천광역시 연수구 갯벌로 12, 인천테크노파크 갯벌타워 1501A,B호<br />
        대표번호: 1899-1871<br /><br />
        © 2026 주식회사 미스터팍. All rights reserved.
      </footer>

      {/* ── 키프레임 애니메이션 ── */}
      <style>{`
        @keyframes scanline { 0%,100% { top: 15px; } 50% { top: calc(100% - 15px); } }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.3); } }
        input::placeholder { color: rgba(255,255,255,.3); }
        input:focus { border-color: ${C.gold} !important; }
        button:hover { opacity: .9; transform: translateY(-1px); }
        button:active { transform: translateY(0); }
        @media(max-width:768px) {
          section > div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
          h1 { font-size: 30px !important; }
          h2 { font-size: 24px !important; }
          nav { padding: 0 16px !important; }
          section { padding-left: 20px !important; padding-right: 20px !important; }
        }
      `}</style>
    </div>
  );
}
