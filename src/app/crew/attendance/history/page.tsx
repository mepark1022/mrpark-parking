// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import CrewHeader from "@/components/crew/CrewHeader";

interface CheckoutRequest {
  id: string;
  requested_at: string;
  status: "pending" | "approved" | "rejected";
  memo: string | null;
  rejected_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
}

export default function CrewAttendanceHistoryPage() {
  const [requests, setRequests] = useState<CheckoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [workerId, setWorkerId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchHistory = async () => {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/crew/login");
        return;
      }

      const savedStoreId = localStorage.getItem("crew_store_id");
      setStoreId(savedStoreId);

      // worker 정보
      const { data: worker } = await supabase
        .from("workers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!worker) {
        setLoading(false);
        return;
      }

      setWorkerId(worker.id);

      // 퇴근 요청 이력 조회 (최근 30일)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: requestsData } = await supabase
        .from("checkout_requests")
        .select("*")
        .eq("worker_id", worker.id)
        .gte("requested_at", thirtyDaysAgo.toISOString())
        .order("requested_at", { ascending: false });

      setRequests(requestsData || []);
      setLoading(false);
    };

    fetchHistory();
  }, [router]);

  const handleReRequest = async (originalRequest: CheckoutRequest) => {
    if (!workerId || !storeId) return;
    
    setActionLoading(originalRequest.id);
    const supabase = createClient();

    try {
      // 새 퇴근 요청 생성 (이전 요청 참조)
      const { error } = await supabase
        .from("checkout_requests")
        .insert({
          worker_id: workerId,
          store_id: storeId,
          requested_at: new Date().toISOString(),
          status: "pending",
          memo: "재요청",
          previous_request_id: originalRequest.id,
        });

      if (error) throw error;

      // 목록 새로고침
      const { data: updated } = await supabase
        .from("checkout_requests")
        .select("*")
        .eq("worker_id", workerId)
        .order("requested_at", { ascending: false });

      setRequests(updated || []);
      alert("퇴근 재요청이 전송되었습니다.");
    } catch (err) {
      console.error("재요청 실패:", err);
      alert("재요청에 실패했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];
    return `${month}.${day} (${weekday})`;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { emoji: "🟡", text: "대기 중", color: "#92400E", bg: "#FEF3C7" };
      case "approved":
        return { emoji: "🟢", text: "승인", color: "#166534", bg: "#DCFCE7" };
      case "rejected":
        return { emoji: "🔴", text: "반려", color: "#991B1B", bg: "#FEE2E2" };
      default:
        return { emoji: "⚪", text: "알 수 없음", color: "#64748B", bg: "#F1F5F9" };
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#64748B", fontSize: 14 }}>로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .history-page {
          min-height: 100dvh;
          background: #F8FAFC;
        }
        
        .history-content {
          padding: 16px;
        }
        
        .history-empty {
          text-align: center;
          padding: 60px 20px;
          color: #64748B;
        }
        
        .history-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        
        .history-card {
          background: #fff;
          border-radius: 14px;
          border: 1px solid #E2E8F0;
          padding: 16px;
          margin-bottom: 12px;
        }
        
        .history-card.rejected {
          border-color: #FECACA;
          background: #FFFBEB;
        }
        
        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .history-date {
          font-size: 15px;
          font-weight: 600;
          color: #1A1D2B;
        }
        
        .history-status {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .history-time {
          font-size: 14px;
          color: #64748B;
          margin-bottom: 6px;
        }
        
        .history-divider {
          height: 1px;
          background: #E2E8F0;
          margin: 12px 0;
        }
        
        .history-reason-label {
          font-size: 12px;
          font-weight: 600;
          color: #991B1B;
          margin-bottom: 6px;
        }
        
        .history-reason {
          font-size: 14px;
          color: #7F1D1D;
          line-height: 1.5;
          background: #FEE2E2;
          padding: 10px 12px;
          border-radius: 8px;
        }
        
        .history-action {
          margin-top: 12px;
        }
        
        .history-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          background: #1428A0;
          color: #fff;
        }
        
        .history-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .history-approved-info {
          font-size: 13px;
          color: #166534;
          margin-top: 8px;
        }
      `}</style>

      <div className="history-page">
        <CrewHeader title="내 요청 이력" showBack />

        <div className="history-content">
          {requests.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">📋</div>
              <div>퇴근 요청 이력이 없습니다</div>
            </div>
          ) : (
            requests.map((req) => {
              const status = getStatusBadge(req.status);
              return (
                <div 
                  key={req.id} 
                  className={`history-card ${req.status === "rejected" ? "rejected" : ""}`}
                >
                  <div className="history-header">
                    <span className="history-date">{formatDate(req.requested_at)}</span>
                    <span 
                      className="history-status"
                      style={{ background: status.bg, color: status.color }}
                    >
                      {status.emoji} {status.text}
                    </span>
                  </div>
                  
                  <div className="history-time">
                    퇴근 요청: {formatTime(req.requested_at)}
                  </div>

                  {req.status === "approved" && req.approved_at && (
                    <div className="history-approved-info">
                      ✓ 승인됨: {formatTime(req.approved_at)}
                    </div>
                  )}

                  {req.status === "rejected" && (
                    <>
                      <div className="history-divider" />
                      <div className="history-reason-label">반려 사유</div>
                      <div className="history-reason">
                        {req.rejected_reason || "사유가 기록되지 않았습니다."}
                      </div>
                      <div className="history-action">
                        <button
                          className="history-btn"
                          onClick={() => handleReRequest(req)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? "처리 중..." : "🔄 재요청하기"}
                        </button>
                      </div>
                    </>
                  )}

                  {req.status === "pending" && (
                    <div style={{ fontSize: 13, color: "#92400E", marginTop: 8 }}>
                      ⏳ 관리자 승인 대기 중...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
