import { useState, useEffect } from "react";

const COLORS = {
  navy: "#1428A0",
  gold: "#F5B731",
  green: "#16A34A",
  red: "#dc2626",
  gray: "#94a3b8",
  kakao: "#FEE500",
  kakaoBrown: "#3B1E08",
  dark: "#1A1D2B",
  white: "#FFFFFF",
  bg: "#F4F5F7",
  border: "#E2E8F0",
};

// S3: 카카오톡 알림톡 화면
function KakaoAlimtalkScreen({ onTap }) {
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowNotif(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "#B2C7D9", position: "relative", overflow: "hidden" }}>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 20px", fontSize: 12, color: "#333", fontWeight: 600 }}>
        <span>9:41</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10 }}>5G</span>
          <div style={{ width: 20, height: 10, border: "1.5px solid #333", borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", left: 1, top: 1, bottom: 1, width: "70%", background: "#333", borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* Lock screen content */}
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <div style={{ fontSize: 64, fontWeight: 200, color: "#222", letterSpacing: -2 }}>9:41</div>
        <div style={{ fontSize: 15, color: "#555", marginTop: 4 }}>3월 2일 월요일</div>
      </div>

      {/* Kakao notification */}
      {showNotif && (
        <div
          onClick={onTap}
          style={{
            position: "absolute",
            top: 80,
            left: 12,
            right: 12,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(20px)",
            borderRadius: 16,
            padding: "12px 14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            cursor: "pointer",
            animation: "slideDown 0.4s ease-out",
          }}
        >
          <style>{`
            @keyframes slideDown {
              from { transform: translateY(-100px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: COLORS.kakao,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0
            }}>💬</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>카카오톡</span>
                <span style={{ fontSize: 11, color: "#999" }}>지금</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#222", marginBottom: 2 }}>미스터팍 주차안내</div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.4 }}>
                [미팍티켓] 강서점 입차 완료 🚗<br />
                차량번호: 12가 3456<br />
                주차요금 확인 및 사전정산 →
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 미팍티켓 메인 (parking 상태)
function TicketMainScreen({ onPay }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: COLORS.navy,
        padding: "12px 20px",
        paddingTop: 44,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: COLORS.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: COLORS.navy
          }}>V</div>
          <span style={{ color: COLORS.white, fontSize: 16, fontWeight: 700 }}>미팍티켓</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginLeft: "auto" }}>강서점</span>
        </div>
      </div>

      {/* Status Card */}
      <div style={{ margin: "0 16px", marginTop: -1 }}>
        <div style={{
          background: COLORS.navy,
          borderRadius: "0 0 16px 16px",
          padding: "20px",
          textAlign: "center",
        }}>
          <div style={{
            display: "inline-block",
            background: "rgba(255,255,255,0.15)",
            borderRadius: 20,
            padding: "4px 16px",
            fontSize: 13,
            color: COLORS.white,
            fontWeight: 600,
            marginBottom: 16,
          }}>
            🚗 주차 중
          </div>

          <div style={{ fontSize: 42, fontWeight: 800, color: COLORS.white, letterSpacing: 4, marginBottom: 4 }}>
            12가 3456
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 20 }}>
            발렛 주차 · B2 구역
          </div>

          {/* Timer */}
          <div style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>입차 시간</div>
              <div style={{ fontSize: 14, color: COLORS.white, fontWeight: 600 }}>오전 9:41</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>경과 시간</div>
              <div style={{ fontSize: 18, color: COLORS.gold, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>주차 구역</div>
              <div style={{ fontSize: 14, color: COLORS.white, fontWeight: 600 }}>B2-15</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Info */}
      <div style={{ margin: "16px", flex: 1 }}>
        <div style={{
          background: COLORS.white,
          borderRadius: 14,
          padding: "18px",
          border: `1px solid ${COLORS.border}`,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>요금 정보</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>방문지</span>
            <span style={{ fontSize: 14, color: "#222", fontWeight: 600 }}>1층 내과</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>무료 시간</span>
            <span style={{ fontSize: 14, color: "#222", fontWeight: 600 }}>30분</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>기본 요금</span>
            <span style={{ fontSize: 14, color: "#222", fontWeight: 600 }}>3,000원 / 60분</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>발렛 요금</span>
            <span style={{ fontSize: 14, color: "#222", fontWeight: 600 }}>5,000원</span>
          </div>
          <div style={{
            borderTop: `1px solid ${COLORS.border}`,
            paddingTop: 12,
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 16, color: "#222", fontWeight: 700 }}>예상 요금</span>
            <span style={{ fontSize: 20, color: COLORS.navy, fontWeight: 800 }}>8,000원</span>
          </div>
        </div>

        {/* Pay Button */}
        <button
          onClick={onPay}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: COLORS.gold,
            color: COLORS.dark,
            fontSize: 17,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(245,183,49,0.4)",
          }}
        >
          사전정산 하기
        </button>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#999" }}>
          사전정산 후 30분 내 출차 시 추가요금 없음
        </div>
      </div>
    </div>
  );
}

// 결제 화면 (토스페이먼츠 위젯 목업)
function PaymentScreen({ onComplete }) {
  const [selected, setSelected] = useState("kakao");

  const methods = [
    { id: "kakao", label: "카카오페이", icon: "💛", bg: "#FEE500", color: "#3B1E08" },
    { id: "samsung", label: "삼성페이", icon: "💙", bg: "#1428A0", color: "#fff" },
    { id: "card", label: "카드결제", icon: "💳", bg: "#F4F5F7", color: "#222" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: COLORS.white,
        padding: "12px 20px",
        paddingTop: 44,
        borderBottom: `1px solid ${COLORS.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 20, cursor: "pointer" }}>←</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#222" }}>결제하기</span>
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        {/* Amount */}
        <div style={{
          background: COLORS.white,
          borderRadius: 14,
          padding: 20,
          textAlign: "center",
          border: `1px solid ${COLORS.border}`,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>결제 금액</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.navy }}>8,000<span style={{ fontSize: 18 }}>원</span></div>
          <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>강서점 · 12가 3456 · 발렛주차</div>
        </div>

        {/* Payment Methods */}
        <div style={{
          background: COLORS.white,
          borderRadius: 14,
          padding: 16,
          border: `1px solid ${COLORS.border}`,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>결제 수단</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {methods.map(m => (
              <div
                key={m.id}
                onClick={() => setSelected(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 10,
                  border: selected === m.id ? `2px solid ${COLORS.navy}` : `1px solid ${COLORS.border}`,
                  background: selected === m.id ? "rgba(20,40,160,0.04)" : COLORS.white,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: m.bg, color: m.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  {m.icon}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#222", flex: 1 }}>{m.label}</span>
                <div style={{
                  width: 20, height: 20, borderRadius: 10,
                  border: selected === m.id ? `6px solid ${COLORS.navy}` : `2px solid #ccc`,
                  transition: "all 0.2s",
                }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <div style={{ padding: "12px 16px 28px", background: COLORS.white, borderTop: `1px solid ${COLORS.border}` }}>
        <button
          onClick={onComplete}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: COLORS.navy,
            color: COLORS.white,
            fontSize: 17,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          8,000원 결제하기
        </button>
      </div>
    </div>
  );
}

// 결제 완료 + 출차요청
function PaymentCompleteScreen({ onExitRequest }) {
  const [showCheck, setShowCheck] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowCheck(true), 300);
    setTimeout(() => setShowContent(true), 800);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: COLORS.green,
        padding: "12px 20px",
        paddingTop: 44,
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: COLORS.white
          }}>V</div>
          <span style={{ color: COLORS.white, fontSize: 16, fontWeight: 700 }}>미팍티켓</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
        {/* Check Animation */}
        <div style={{
          marginTop: 40,
          width: 80, height: 80,
          borderRadius: 40,
          background: COLORS.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: showCheck ? "scale(1)" : "scale(0)",
          transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          boxShadow: "0 8px 24px rgba(22,163,74,0.3)",
        }}>
          <span style={{ fontSize: 40, color: COLORS.white }}>✓</span>
        </div>

        <div style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s ease-out",
          textAlign: "center",
          width: "100%",
        }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#222", marginTop: 20, marginBottom: 4 }}>
            사전정산 완료
          </div>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 28 }}>
            30분 내 출차 시 추가요금이 없습니다
          </div>

          {/* Receipt Summary */}
          <div style={{
            background: COLORS.white,
            borderRadius: 14,
            padding: 20,
            border: `1px solid ${COLORS.border}`,
            textAlign: "left",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: "#888" }}>매장</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#222" }}>강서점</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: "#888" }}>차량번호</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#222" }}>12가 3456</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: "#888" }}>결제수단</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#222" }}>카카오페이</span>
            </div>
            <div style={{
              borderTop: `1px solid ${COLORS.border}`,
              paddingTop: 12,
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#222" }}>결제 금액</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.green }}>8,000원</span>
            </div>
          </div>

          {/* 30분 타이머 */}
          <div style={{
            background: "rgba(245,183,49,0.1)",
            border: `1px solid rgba(245,183,49,0.3)`,
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 18 }}>⏱</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.gold }}>출차 유예시간 29:58 남음</span>
          </div>

          {/* Exit Request Button */}
          <button
            onClick={onExitRequest}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 12,
              border: "none",
              background: COLORS.gold,
              color: COLORS.dark,
              fontSize: 17,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(245,183,49,0.4)",
              marginBottom: 8,
            }}
          >
            🚗 출차 요청하기
          </button>
          <div style={{ fontSize: 12, color: "#999" }}>크루에게 차량 준비를 요청합니다</div>
        </div>
      </div>
    </div>
  );
}

// 출차요청 완료
function ExitRequestedScreen() {
  const [showAnim, setShowAnim] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowAnim(true), 300);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: COLORS.gold,
        padding: "12px 20px",
        paddingTop: 44,
        textAlign: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(0,0,0,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: COLORS.dark
          }}>V</div>
          <span style={{ color: COLORS.dark, fontSize: 16, fontWeight: 700 }}>미팍티켓</span>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        opacity: showAnim ? 1 : 0,
        transform: showAnim ? "translateY(0)" : "translateY(30px)",
        transition: "all 0.6s ease-out",
      }}>
        <div style={{
          width: 80, height: 80,
          borderRadius: 40,
          background: COLORS.gold,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: "0 8px 24px rgba(245,183,49,0.3)",
        }}>
          <span style={{ fontSize: 40 }}>🚗</span>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: "#222", marginBottom: 8, textAlign: "center" }}>
          출차 요청 완료
        </div>
        <div style={{ fontSize: 15, color: "#666", textAlign: "center", lineHeight: 1.6, marginBottom: 32 }}>
          크루가 차량을 준비하고 있습니다<br />
          잠시만 기다려주세요
        </div>

        {/* Progress */}
        <div style={{
          width: "100%",
          background: COLORS.white,
          borderRadius: 14,
          padding: 20,
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
            {["출차요청", "차량준비", "준비완료"].map((step, i) => (
              <div key={step} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                }}>
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: 16,
                    background: i === 0 ? COLORS.gold : i === 1 ? "rgba(245,183,49,0.2)" : "#eee",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 800,
                    color: i === 0 ? COLORS.dark : i === 1 ? COLORS.gold : "#ccc",
                    marginBottom: 6,
                  }}>
                    {i === 0 ? "✓" : i + 1}
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: i === 0 ? 700 : 500,
                    color: i === 0 ? COLORS.dark : "#999",
                  }}>{step}</span>
                </div>
                {i < 2 && (
                  <div style={{
                    height: 2,
                    flex: 0.5,
                    background: i === 0 ? COLORS.gold : "#eee",
                    marginBottom: 20,
                  }} />
                )}
              </div>
            ))}
          </div>

          <div style={{
            background: "rgba(245,183,49,0.08)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: COLORS.gold,
              animation: "blink 1.5s infinite",
            }} />
            <style>{`
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            `}</style>
            <span style={{ fontSize: 13, color: "#666" }}>크루가 차량을 이동하고 있습니다...</span>
          </div>
        </div>

        <div style={{
          marginTop: 24,
          fontSize: 14,
          fontWeight: 700,
          color: "#222",
        }}>
          12가 3456 · 강서점
        </div>
        <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
          예상 대기시간 약 3~5분
        </div>
      </div>
    </div>
  );
}

// 메인 앱 - 화면 전환
export default function MeparkTicketDemo() {
  const [screen, setScreen] = useState("kakao");

  const screens = {
    kakao: <KakaoAlimtalkScreen onTap={() => setScreen("ticket")} />,
    ticket: <TicketMainScreen onPay={() => setScreen("payment")} />,
    payment: <PaymentScreen onComplete={() => setScreen("complete")} />,
    complete: <PaymentCompleteScreen onExitRequest={() => setScreen("exit")} />,
    exit: <ExitRequestedScreen />,
  };

  const labels = {
    kakao: "S3: 알림톡 도착",
    ticket: "S3→S4: 티켓 확인",
    payment: "S4: 결제",
    complete: "S4: 결제완료 + 출차요청",
    exit: "S4: 출차요청 완료",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#111",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 16px",
      fontFamily: "'Apple SD Gothic Neo', 'Pretendard', sans-serif",
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          display: "inline-block",
          background: "rgba(245,183,49,0.15)",
          border: "1px solid rgba(245,183,49,0.3)",
          borderRadius: 8,
          padding: "4px 14px",
          fontSize: 11,
          color: COLORS.gold,
          letterSpacing: 2,
          marginBottom: 8,
        }}>MEPARK TICKET UI</div>
        <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
          미팍티켓 화면녹화용 프로토타입
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0 }}>
          화면을 탭하면 다음 단계로 진행됩니다
        </p>
      </div>

      {/* Phone Frame */}
      <div style={{
        width: 320,
        height: 640,
        borderRadius: 36,
        background: "#000",
        padding: 8,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        position: "relative",
      }}>
        {/* Notch */}
        <div style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 24,
          borderRadius: "0 0 14px 14px",
          background: "#000",
          zIndex: 10,
        }} />
        <div style={{
          width: "100%",
          height: "100%",
          borderRadius: 28,
          overflow: "hidden",
          position: "relative",
        }}>
          {screens[screen]}
        </div>
      </div>

      {/* Current Step */}
      <div style={{
        marginTop: 16,
        background: "rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "8px 20px",
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.gold,
      }}>
        {labels[screen]}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 16,
        flexWrap: "wrap",
        justifyContent: "center",
      }}>
        {Object.entries(labels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setScreen(key)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: screen === key ? COLORS.navy : "rgba(255,255,255,0.1)",
              color: screen === key ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label.split(": ")[1] || label}
          </button>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={() => setScreen("kakao")}
        style={{
          marginTop: 12,
          padding: "8px 20px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
          color: "rgba(255,255,255,0.5)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        ↺ 처음부터 다시
      </button>
    </div>
  );
}
