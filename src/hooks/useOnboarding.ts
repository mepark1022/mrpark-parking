// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";

export type OnboardingRole = "admin" | "crew" | null;

const LS_KEY = "mepark_onboarding_done";

export function useOnboarding() {
  const [showTour, setShowTour] = useState(false);
  const [role, setRole] = useState<OnboardingRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  async function checkOnboardingStatus() {
    try {
      // localStorage 우선 체크 (가장 빠름)
      if (typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "true") {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const ctx = await getUserContext();
      if (!ctx.userId) { setLoading(false); return; }

      // profiles에서 onboarding_completed 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, role")
        .eq("id", ctx.userId)
        .single();

      // 완료된 경우 투어 안 보여줌 + localStorage 동기화
      if (profile?.onboarding_completed) {
        if (typeof window !== "undefined") localStorage.setItem(LS_KEY, "true");
        setLoading(false);
        return;
      }

      // role 결정
      const userRole = profile?.role || ctx.role;
      const isAdmin = ["admin", "owner", "super_admin"].includes(userRole);
      setRole(isAdmin ? "admin" : "crew");
      setShowTour(true);
    } catch (e) {
      console.error("온보딩 상태 확인 실패:", e);
    } finally {
      setLoading(false);
    }
  }

  async function completeOnboarding() {
    // 1. localStorage 즉시 저장 (DB 실패해도 다시 안 뜸)
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, "true");
    setShowTour(false);

    // 2. DB 저장 (실패해도 무시)
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    } catch (e) {
      console.error("온보딩 완료 DB 저장 실패 (localStorage로 대체됨):", e);
    }
  }

  // /guide 페이지에서 다시보기용
  async function restartTour(targetRole?: OnboardingRole) {
    const ctx = await getUserContext();
    const isAdmin = ["admin", "owner", "super_admin"].includes(ctx.role);
    setRole(targetRole || (isAdmin ? "admin" : "crew"));
    setShowTour(true);
  }

  return { showTour, role, loading, completeOnboarding, restartTour };
}
