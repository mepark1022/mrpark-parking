// @ts-nocheck
/**
 * 미팍 통합앱 v2 — 현장일보 사진 업로드 + 갤러리 (Part 13C)
 *
 * - 업로드: POST /api/v1/daily-reports/:id/images (multipart, files[])
 *   최대 20개 / 10MB / jpeg·png·webp·heic
 * - 갤러리: report.extra 중 category='photo'만 표시
 * - 미리보기: storage_path → Supabase signed URL (Storage 클라이언트 직접 생성)
 *
 * 권한: OPERATE 이상 + canEdit 조건 (본인+미확정 / MANAGE)
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const BUCKET = "daily-report-photos";
const MAX_FILES = 20;
const MAX_SIZE_MB = 10;

interface Props {
  reportId: string;
  orgId: string;
  extraList: any[];
  canUpload: boolean;
  onUploaded: () => void;
}

export default function PhotoUpload({ reportId, orgId, extraList, canUpload, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // photo 카테고리만 필터
  const photos = (extraList || []).filter((e) => e.category === "photo");

  // ── 서명 URL 일괄 생성 ──
  useEffect(() => {
    if (photos.length === 0) {
      setSignedUrls({});
      return;
    }
    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const paths = photos.map((p) => p.storage_path).filter(Boolean);
      if (paths.length === 0) return;
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(paths, 3600); // 1시간
        if (error || !data) return;
        const map: Record<string, string> = {};
        data.forEach((d, i) => {
          if (d.signedUrl && paths[i]) map[paths[i]] = d.signedUrl;
        });
        setSignedUrls(map);
      } catch {
        // 미리보기 실패는 치명적 아님
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(photos.map((p) => p.id))]);

  // ── 파일 선택 → 업로드 ──
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > MAX_FILES) {
      alert(`한 번에 최대 ${MAX_FILES}장까지 업로드 가능합니다`);
      return;
    }
    for (const f of Array.from(files)) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`파일이 너무 큽니다 (${f.name}). 최대 ${MAX_SIZE_MB}MB`);
        return;
      }
    }

    setUploading(true);
    setProgress(`${files.length}장 업로드 중...`);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) {
        fd.append("files", f);
      }
      const res = await fetch(`/api/v1/daily-reports/${reportId}/images`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        alert(json?.error?.message || `업로드 실패 (${res.status})`);
        return;
      }
      const data = json?.data || json;
      alert(`✅ ${data.uploaded_count || files.length}장 업로드 완료`);
      onUploaded();
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setUploading(false);
      setProgress("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {/* 업로드 영역 */}
      {canUpload && (
        <div style={{
          padding: 20, borderRadius: 10,
          border: "2px dashed #cbd5e1", background: "#f8fafc",
          marginBottom: 16, textAlign: "center",
        }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
            현장 사진을 업로드해주세요 (최대 {MAX_FILES}장 / 각 {MAX_SIZE_MB}MB)
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              height: 40, padding: "0 22px", borderRadius: 8,
              background: uploading ? "#94a3b8" : "#1428A0",
              color: "#fff", border: "none",
              fontWeight: 700, fontSize: 14,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            {uploading ? progress || "업로드 중..." : "📸 사진 선택"}
          </button>
        </div>
      )}

      {/* 갤러리 */}
      {photos.length === 0 ? (
        <div style={{
          padding: 30, textAlign: "center", color: "#94a3b8",
          background: "#f8fafc", borderRadius: 8, fontSize: 13,
        }}>
          {canUpload ? "아직 등록된 사진이 없습니다" : "등록된 사진이 없습니다"}
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 10,
        }}>
          {photos.map((p) => {
            const url = signedUrls[p.storage_path];
            return (
              <a
                key={p.id}
                href={url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", aspectRatio: "1 / 1",
                  borderRadius: 10, overflow: "hidden",
                  background: "#f1f5f9",
                  border: "1px solid #e2e8f0",
                  textDecoration: "none",
                  position: "relative",
                }}
              >
                {url ? (
                  <img
                    src={url}
                    alt={p.title || "사진"}
                    style={{
                      width: "100%", height: "100%",
                      objectFit: "cover", display: "block",
                    }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#94a3b8", fontSize: 12,
                  }}>
                    🖼 로딩...
                  </div>
                )}
                {p.title && (
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    padding: "6px 8px",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    color: "#fff", fontSize: 11, fontWeight: 600,
                    overflow: "hidden",
                    whiteSpace: "nowrap", textOverflow: "ellipsis",
                  }}>
                    {p.title}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
          총 {photos.length}장 (클릭 시 원본)
        </div>
      )}
    </div>
  );
}
