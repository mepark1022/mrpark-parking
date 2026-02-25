// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function CrewAuthCallback() {
  const [status, setStatus] = useState<"loading" | "error" | "no-access">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      
      // OAuth 콜백 처리
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setErrorMsg("로그인에 실패했습니다.");
        setStatus("error");
        return;
      }

      // 프로필 조회
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, org_id, name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        // 신규 사용자 - 프로필 없음
        setErrorMsg("등록되지 않은 계정입니다. 관리자에게 문의하세요.");
        setStatus("no-access");
        return;
      }

      // 권한 확인 (crew 또는 admin만 접근 가능)
      if (profile.role !== "crew" && profile.role !== "admin") {
        setErrorMsg("크루 권한이 없습니다. 관리자에게 문의하세요.");
        setStatus("no-access");
        return;
      }

      // 매장 배정 확인
      const { data: storeMembers } = await supabase
        .from("store_members")
        .select("store_id")
        .eq("user_id", user.id);

      if (!storeMembers || storeMembers.length === 0) {
        setErrorMsg("배정된 매장이 없습니다. 관리자에게 문의하세요.");
        setStatus("no-access");
        return;
      }

      // 성공 - 매장 수에 따라 분기
      if (storeMembers.length > 1) {
        router.replace("/crew/select-store");
      } else {
        // 단일 매장 - localStorage에 저장 후 홈으로
        const stId = storeMembers[0].store_id;
        localStorage.setItem("crew_store_id", stId);
        // 매장명도 저장
        const { data: storeInfo } = await supabase
          .from("stores").select("name").eq("id", stId).single();
        if (storeInfo) localStorage.setItem("crew_store_name", storeInfo.name);
        router.replace("/crew");
      }
    };

    handleCallback();
  }, [router]);

  // 로딩 UI
  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#1428A0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}>
        <div style={{
          width: 48,
          height: 48,
          border: "4px solid rgba(255,255,255,0.2)",
          borderTopColor: "#F5B731",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>
          로그인 확인 중...
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 에러/권한없음 UI
  return (
    <div style={{
      minHeight: "100dvh",
      background: "#1428A0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: "32px 24px",
        maxWidth: 340,
        width: "100%",
        textAlign: "center",
      }}>
        <div style={{
          fontSize: 48,
          marginBottom: 16,
        }}>
          {status === "error" ? "⚠️" : "🔒"}
        </div>
        <div style={{
          fontSize: 17,
          fontWeight: 700,
          color: "#1A1D2B",
          marginBottom: 8,
        }}>
          {status === "error" ? "로그인 실패" : "접근 불가"}
        </div>
        <div style={{
          fontSize: 14,
          color: "#64748B",
          lineHeight: 1.6,
          marginBottom: 24,
        }}>
          {errorMsg}
        </div>
        <button
          onClick={() => router.replace("/crew/login")}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 10,
            background: "#1428A0",
            border: "none",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
