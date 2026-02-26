import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat, lng 필수" }, { status: 400 });
  }

  const KAKAO_KEY = process.env.KAKAO_REST_KEY;
  if (!KAKAO_KEY) {
    return NextResponse.json({ error: "KAKAO_REST_KEY 미설정" }, { status: 500 });
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    });

    const data = await res.json();

    // 디버깅: 카카오 응답이 비어있으면 전체 응답 반환
    if (!data.documents || data.documents.length === 0) {
      return NextResponse.json({
        debug: true,
        kakao_status: res.status,
        kakao_response: data,
        address: "",
        road_address: "",
        building_name: "",
        full: "",
      });
    }

    const doc = data.documents[0];
    const road = doc.road_address;
    const addr = doc.address;

    if (road) {
      return NextResponse.json({
        address: `${road.region_1depth_name} ${road.region_2depth_name} ${road.region_3depth_name}`,
        road_address: `${road.road_name} ${road.main_building_no}${road.sub_building_no ? `-${road.sub_building_no}` : ""}`,
        building_name: road.building_name || "",
        full: road.address_name,
      });
    }

    if (addr) {
      return NextResponse.json({
        address: `${addr.region_1depth_name} ${addr.region_2depth_name} ${addr.region_3depth_name}`,
        road_address: "",
        building_name: "",
        full: addr.address_name,
      });
    }

    return NextResponse.json({ address: "", road_address: "", building_name: "", full: "" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "geocode failed" }, { status: 500 });
  }
}
