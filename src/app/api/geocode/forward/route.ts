import { NextRequest, NextResponse } from "next/server";

// 주소 → 좌표 변환 (카카오 Geocoding API)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address 필수" }, { status: 400 });
  }

  const KAKAO_KEY = process.env.KAKAO_REST_KEY;
  if (!KAKAO_KEY) {
    return NextResponse.json({ error: "KAKAO_REST_KEY 미설정" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }
    );

    const data = await res.json();

    if (!data.documents || data.documents.length === 0) {
      return NextResponse.json({ lat: null, lng: null, error: "주소 검색 결과 없음" });
    }

    const doc = data.documents[0];
    return NextResponse.json({
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
      address_name: doc.address_name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "geocode failed" }, { status: 500 });
  }
}
