// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";

interface AdminGpsMapProps {
  storeLat: number | null;
  storeLng: number | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
}

declare global {
  interface Window {
    kakao: any;
  }
}

export default function AdminGpsMap({ storeLat, storeLng, checkInLat, checkInLng, checkOutLat, checkOutLng }: AdminGpsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  const hasAnyCoord = storeLat || checkInLat || checkOutLat;

  useEffect(() => {
    if (window.kakao?.maps) {
      setMapLoaded(true);
      return;
    }

    const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!KAKAO_JS_KEY) {
      setMapError(true);
      return;
    }

    const existingScript = document.querySelector(`script[src*="dapi.kakao.com/v2/maps/sdk.js"]`);
    if (existingScript) {
      const check = setInterval(() => {
        if (window.kakao?.maps) { clearInterval(check); setMapLoaded(true); }
      }, 100);
      setTimeout(() => { clearInterval(check); setMapError(true); }, 5000);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => setMapLoaded(true));
    };
    script.onerror = () => setMapError(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.kakao?.maps) return;

    const maps = window.kakao.maps;
    const centerLat = storeLat || checkOutLat || checkInLat || 37.5665;
    const centerLng = storeLng || checkOutLng || checkInLng || 126.978;
    const center = new maps.LatLng(centerLat, centerLng);
    const map = new maps.Map(mapRef.current, { center, level: 4 });
    const bounds = new maps.LatLngBounds();

    // 매장 마커 + 반경
    if (storeLat && storeLng) {
      const pos = new maps.LatLng(storeLat, storeLng);
      bounds.extend(pos);
      const el = document.createElement("div");
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#1428A0;color:#fff;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">🏪 매장</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #1428A0;margin-top:-1px"></div></div>`;
      new maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.3, map });
      new maps.Circle({
        center: pos, radius: 200,
        strokeWeight: 2, strokeColor: "#1428A0", strokeOpacity: 0.6, strokeStyle: "dashed",
        fillColor: "#1428A0", fillOpacity: 0.08, map,
      });
    }

    // 출근 마커
    if (checkInLat && checkInLng) {
      const pos = new maps.LatLng(checkInLat, checkInLng);
      bounds.extend(pos);
      const el = document.createElement("div");
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#16A34A;color:#fff;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">☀️ 출근</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #16A34A;margin-top:-1px"></div></div>`;
      new maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.3, map });
      new maps.Circle({ center: pos, radius: 8, strokeWeight: 2, strokeColor: "#16A34A", strokeOpacity: 1, fillColor: "#16A34A", fillOpacity: 0.6, map });
    }

    // 퇴근 마커
    if (checkOutLat && checkOutLng) {
      const pos = new maps.LatLng(checkOutLat, checkOutLng);
      bounds.extend(pos);
      const el = document.createElement("div");
      el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center"><div style="background:#DC2626;color:#fff;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">🌙 퇴근</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid #DC2626;margin-top:-1px"></div></div>`;
      new maps.CustomOverlay({ position: pos, content: el, yAnchor: 1.3, map });
      new maps.Circle({ center: pos, radius: 8, strokeWeight: 2, strokeColor: "#DC2626", strokeOpacity: 1, fillColor: "#DC2626", fillOpacity: 0.6, map });
    }

    if (bounds.toString() !== "((),())") {
      map.setBounds(bounds, 60, 60, 60, 60);
    }
  }, [mapLoaded, storeLat, storeLng, checkInLat, checkInLng, checkOutLat, checkOutLng]);

  if (!hasAnyCoord) {
    return (
      <div style={{ background: "#F1F5F9", borderRadius: 14, padding: 20, textAlign: "center", color: "#64748B", fontSize: 13 }}>
        GPS 좌표가 기록되지 않았습니다
      </div>
    );
  }

  if (mapError) {
    return (
      <div style={{ background: "#F1F5F9", borderRadius: 14, padding: 16, textAlign: "center", color: "#64748B", fontSize: 13 }}>
        <div style={{ marginBottom: 8 }}>🗺️ 지도를 불러올 수 없습니다</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", fontSize: 11 }}>
          {checkInLat && <span>🟢 출근: {checkInLat.toFixed(5)}, {checkInLng?.toFixed(5)}</span>}
          {checkOutLat && <span>🔴 퇴근: {checkOutLat.toFixed(5)}, {checkOutLng?.toFixed(5)}</span>}
        </div>
      </div>
    );
  }

  return (
    <div ref={mapRef} style={{
      width: "100%", height: 260, borderRadius: 14, overflow: "hidden",
      border: "1.5px solid #E2E8F0", background: "#F1F5F9",
    }}>
      {!mapLoaded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94A3B8", fontSize: 13 }}>
          🗺️ 지도 로딩 중...
        </div>
      )}
    </div>
  );
}
