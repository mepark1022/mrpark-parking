/**
 * /pay/success — 토스 결제 성공 리다이렉트 (서버 컴포넌트)
 *
 * 토스가 successUrl로 붙여 보내는 paymentKey/orderId/amount를 받아
 * 서버사이드로 hr.mepark.kr(mrpark-2.0)의 confirm을 호출한다.
 * 결제 승인·DB 반영은 전부 서버(mrpark-2.0). 여기는 결과 표시만.
 */
export const dynamic = "force-dynamic";

const fmtMoney = (n: number) => `${(n || 0).toLocaleString()}원`;

/* ─── 네이비 P 배지 (브랜드, 이모지 금지) ─── */
function PBadge({ size = 52, bg = "#1428A0" }: { size?: number; bg?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: Math.round(size * 0.52), fontWeight: 900,
      fontFamily: "'Outfit', sans-serif", margin: "0 auto",
    }}>P</div>
  );
}

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const paymentKey = typeof sp.paymentKey === "string" ? sp.paymentKey : "";
  const orderId = typeof sp.orderId === "string" ? sp.orderId : "";
  const amountRaw = typeof sp.amount === "string" ? sp.amount : "";
  const ticketIdParam = typeof sp.ticketId === "string" ? sp.ticketId : "";

  let confirmed = false;
  let ticketId = ticketIdParam;
  let failMessage = "결제 승인에 실패했습니다";

  if (paymentKey && orderId && amountRaw) {
    try {
      const res = await fetch("https://hr.mepark.kr/api/v1/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey, orderId, amount: Number(amountRaw) }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.ok) {
        confirmed = true;
        // confirm 응답에 ticket_id가 있으면 티켓으로 복귀 링크에 사용
        const tid =
          (data?.ticket_id as string) ??
          ((data?.data as Record<string, unknown>)?.ticket_id as string) ??
          "";
        if (tid) ticketId = tid;
      } else {
        failMessage =
          ((data?.error as Record<string, unknown>)?.message as string) ??
          (data?.message as string) ??
          failMessage;
      }
    } catch {
      failMessage = "결제 승인 중 오류가 발생했습니다";
    }
  } else {
    failMessage = "결제 정보가 올바르지 않습니다";
  }

  const backHref = ticketId ? `/ticket/${ticketId}` : "/";

  /* ─── 실패: /pay/fail 스타일 안내 ─── */
  if (!confirmed) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f8", fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%", background: "#E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9AA0AD", fontSize: 30, fontWeight: 900,
            fontFamily: "'Outfit', sans-serif", margin: "0 auto 16px",
          }}>!</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a1d26", marginBottom: 8 }}>결제를 완료하지 못했습니다</div>
          <div style={{ fontSize: 14, color: "#888", marginBottom: 28, lineHeight: 1.6 }}>{failMessage}</div>
          <a href={backHref} style={{
            display: "block", width: "100%", padding: "18px", borderRadius: 14,
            background: "#1428A0", color: "#fff", fontSize: 16, fontWeight: 800,
            textDecoration: "none", boxSizing: "border-box",
          }}>티켓으로 돌아가기</a>
        </div>
      </div>
    );
  }

  /* ─── 성공 ─── */
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f8", fontFamily: "'Pretendard', -apple-system, sans-serif", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ marginBottom: 18 }}><PBadge size={52} /></div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#16A34A", marginBottom: 10 }}>결제가 완료되었습니다</div>
        <div style={{
          margin: "0 auto 28px", background: "#fff", borderRadius: 16,
          padding: "20px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 14, color: "#666" }}>결제 금액</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#1428A0", fontFamily: "'Outfit', sans-serif" }}>
            {fmtMoney(Number(amountRaw))}
          </span>
        </div>
        <a href={backHref} style={{
          display: "block", width: "100%", padding: "18px", borderRadius: 14,
          background: "#1428A0", color: "#fff", fontSize: 16, fontWeight: 800,
          textDecoration: "none", boxSizing: "border-box",
        }}>티켓으로 돌아가기</a>
      </div>
    </div>
  );
}
