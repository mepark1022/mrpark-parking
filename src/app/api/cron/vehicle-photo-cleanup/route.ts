// @ts-nocheck
/**
 * GET /api/cron/vehicle-photo-cleanup   (GAP-P1-8 P1-8c)
 * Vercel Cron: 매일 새벽 4시 KST (UTC 19:00 전일)
 *
 * vehicle-photos 버킷에서 "촬영 2개월(60일) 경과" 객체만 자동 삭제한다.
 *  - 입차 차량사진은 사고 클레임의 "입차 전 상태 증거"용 → ~2개월이면 소임 종료.
 *    "용량제한 없음"(고해상 6장) 입력 정책의 짝꿍으로, Storage 총량을 이 cron이 관리한다.
 *  - ⚠️ ticket row(mepark_tickets)와 vehicle_photos 컬럼은 "절대" 건드리지 않는다.
 *    Storage 객체만 remove (요구사항 명시). → DB 미조회 = 컬럼 유지가 자연 충족.
 *  - 멱등(idempotent): 삭제된 객체는 다음 list에 안 잡힘 → cron이 같은 객체를 재처리하지 않음.
 *  - 경로 포맷: {org_id}/{ticket_id}/{idx}_{slotKey}.jpg
 *    (entry/page.tsx 업로드 · tickets POST photo_path_prefix 와 정합)
 *  - 인증: demo-cleanup 동일 패턴 (CRON_SECRET Bearer).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "vehicle-photos";
const RETENTION_DAYS = 60;        // 촬영 2개월(60일) 경과 기준
const LIST_PAGE = 1000;           // 폴더당 list 페이지 크기
const REMOVE_BATCH = 100;         // storage.remove 호출당 경로 수
const MAX_REMOVE_PER_RUN = 1000;  // 1회 실행 안전 상한(함수 타임아웃 방지). 초과분은 다음 실행에서 계속

export async function GET(req: NextRequest) {
  // ── Vercel Cron 인증 (demo-cleanup 동일) ──
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  // 폴더(prefix) 내 항목을 페이지네이션하며 전부 수집
  const listAll = async (prefix: string) => {
    const out: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: LIST_PAGE, offset });
      if (error) {
        console.warn(`[Cron/vehicle-photo-cleanup] list 경고 (${prefix || "/"}):`, error.message);
        break;
      }
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < LIST_PAGE) break;
      offset += LIST_PAGE;
    }
    return out;
  };

  // 폴더 판별: Supabase Storage list는 폴더(prefix)에 id=null 을 반환, 파일은 id 존재
  const isFolder = (e: any) => !e?.id;

  const stalePaths: string[] = [];
  let truncated = false;
  let scannedFiles = 0;

  try {
    // L0: org_id 폴더 → L1: ticket_id 폴더 → L2: 파일
    const orgFolders = (await listAll("")).filter(isFolder);

    outer: for (const org of orgFolders) {
      const orgId = org.name;
      const ticketFolders = (await listAll(orgId)).filter(isFolder);

      for (const tk of ticketFolders) {
        const prefix = `${orgId}/${tk.name}`;
        const files = (await listAll(prefix)).filter((e) => !isFolder(e));

        for (const f of files) {
          if (!f.name || f.name.startsWith(".")) continue; // placeholder 등 제외
          scannedFiles++;
          const created = f.created_at ? new Date(f.created_at).getTime() : NaN;
          // created_at 미존재 시 보수적으로 보존(삭제하지 않음)
          if (!Number.isFinite(created)) continue;
          if (created < cutoffMs) {
            stalePaths.push(`${prefix}/${f.name}`);
            if (stalePaths.length >= MAX_REMOVE_PER_RUN) {
              truncated = true;
              break outer;
            }
          }
        }
      }
    }

    // ── 배치 삭제 (Storage 객체만) ──
    let removed = 0;
    for (let i = 0; i < stalePaths.length; i += REMOVE_BATCH) {
      const batch = stalePaths.slice(i, i + REMOVE_BATCH);
      const { error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) {
        console.warn("[Cron/vehicle-photo-cleanup] remove 경고:", error.message);
      } else {
        removed += batch.length;
      }
    }

    console.log(
      `[Cron/vehicle-photo-cleanup] 완료: 스캔 ${scannedFiles} / 만료 ${stalePaths.length} / 삭제 ${removed}` +
        (truncated ? " (상한 도달 — 다음 실행에서 계속)" : "")
    );

    return NextResponse.json({
      success: true,
      bucket: BUCKET,
      retentionDays: RETENTION_DAYS,
      scannedFiles,
      stale: stalePaths.length,
      removed,
      truncated,
    });
  } catch (err: any) {
    console.error("[Cron/vehicle-photo-cleanup] 오류:", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
