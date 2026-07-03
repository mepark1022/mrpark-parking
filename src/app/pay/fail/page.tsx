/**
 * /pay/fail — 토스 결제 실패/취소 리다이렉트 (서버 컴포넌트)
 *
 * 인증 실패·사용자 취소 케이스. confirm을 절대 호출하지 않는다.
 * 토스가 붙여 보내는 code/message를 표시하고 티켓으로 복귀시킨다.
 */
export const dynamic = "force-dynamic";

export default async function PayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  const message = typeof sp.message === "string" ? sp.message : "결제가 취소되었거나 실패했습니다";
  const ticketId = typeof sp.ticketId === "string" ? sp.ticketId : "";

  const retryHref = ticketId ? `/ticket/${ticketId}` : "/";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f8", fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        {/* 회색 ! 배지 (이모지 금지) */}
        <div style={{
          width: 52, height: 52, borderRadius: "50%", background: "#E5E7EB",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#9AA0AD", fontSize: 30, fontWeight: 900,
          fontFamily: "'Outfit', sans-serif", margin: "0 auto 16px",
        }}>!</div>

        <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d26", marginBottom: 8 }}>
          결제를 완료하지 못했습니다
        </div>
        <div style={{ fontSize: 14, color: "#888", marginBottom: 6, lineHeight: 1.6 }}>{message}</div>
        {code ? (
          <div style={{ fontSize: 12, color: "#bbb", marginBottom: 28 }}>오류 코드: {code}</div>
        ) : (
          <div style={{ marginBottom: 28 }} />
        )}

        <a href={retryHref} style={{
          display: "block", width: "100%", padding: "18px", borderRadius: 14,
          background: "#1428A0", color: "#fff", fontSize: 16, fontWeight: 800,
          textDecoration: "none", boxSizing: "border-box",
        }}>다시 시도</a>
      </div>
    </div>
  );
}
