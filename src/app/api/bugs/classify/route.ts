// @ts-nocheck
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { bugId, title, description, category, page_url, steps } = await req.json();

    if (!bugId || !title) {
      return NextResponse.json({ error: "bugId, title 필수" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // API 키 없으면 기본 분석만
      const sb = supabaseAdmin();
      await sb.from("bug_reports").update({
        ai_analysis: "API 키 미설정 — 수동 분석 필요",
        ai_priority: category === "function" || category === "data" ? "high" : "medium",
        updated_at: new Date().toISOString(),
      }).eq("id", bugId);
      return NextResponse.json({ success: true, mode: "fallback" });
    }

    // Claude API 호출
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `미팍티켓 어드민 시스템(Next.js+Supabase+Vercel) 버그 리포트를 분석해주세요.

제목: ${title}
카테고리: ${category}
발생 페이지: ${page_url}
설명: ${description || "없음"}
재현 방법: ${steps || "없음"}

아래 JSON 형식으로만 응답하세요 (백틱 없이):
{
  "ai_priority": "low|medium|high|critical",
  "ai_analysis": "추정 원인 1~2문장",
  "ai_suggestion": "수정 방향 1~2문장",
  "ai_affected_files": ["추정 파일 경로 최대 3개"]
}`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API ${response.status}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "";

    // JSON 파싱
    let parsed;
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        ai_priority: "medium",
        ai_analysis: text.slice(0, 200),
        ai_suggestion: "",
        ai_affected_files: [],
      };
    }

    // DB 업데이트
    const sb = supabaseAdmin();
    await sb.from("bug_reports").update({
      ai_priority: parsed.ai_priority || "medium",
      ai_analysis: parsed.ai_analysis || "",
      ai_suggestion: parsed.ai_suggestion || "",
      ai_affected_files: parsed.ai_affected_files || [],
      updated_at: new Date().toISOString(),
    }).eq("id", bugId);

    return NextResponse.json({ success: true, analysis: parsed });
  } catch (err) {
    console.error("Bug classify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
