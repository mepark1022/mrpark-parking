/**
 * 공통 토스트 알림 유틸
 * DOM 직접 주입 방식 - overflow:hidden/auto 내부에서도 정상 표시
 *
 * @param msg    표시할 메시지 (이모지 포함 가능)
 * @param type   "success" | "error" | "info"  (기본: "success")
 * @param duration  표시 시간 ms (기본: 2400)
 */
export function showToast(
  msg: string,
  type: "success" | "error" | "info" = "success",
  duration = 2400,
) {
  const BG: Record<string, string> = {
    success: "#1428A0",
    error:   "#DC2626",
    info:    "#475569",
  };

  const el = document.createElement("div");
  el.innerText = msg;
  Object.assign(el.style, {
    position:     "fixed",
    bottom:       "88px",
    left:         "50%",
    transform:    "translateX(-50%) translateY(0)",
    background:   BG[type],
    color:        "#fff",
    padding:      "12px 22px",
    borderRadius: "24px",
    fontSize:     "14px",
    fontWeight:   "700",
    boxShadow:    "0 4px 20px rgba(0,0,0,0.25)",
    zIndex:       "99999",
    whiteSpace:   "nowrap",
    opacity:      "1",
    transition:   "opacity 0.3s",
    pointerEvents: "none",
  });

  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, duration);
}
