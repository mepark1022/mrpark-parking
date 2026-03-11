// @ts-nocheck
"use client";

import AppLayout from "@/components/layout/AppLayout";
import { LogoGNB } from "@/components/Logo";

const features = [
  { icon: "📊", title: "대시보드", desc: "매장별 매출 현황, 입차 통계, 월주차 현황, 근무자 배치 등을 한눈에 파악합니다.", details: [
    "기간별 필터: 오늘 / 이번 주 / 이번 달 / 기간 직접 선택",
    "매장 선택 시 해당 매장의 상세 KPI 확인",
    "주차장 점유율 실시간 표시 (여유/혼잡/만차 배지)",
    "전체 선택 시 매장 간 매출 순위 비교 차트",
  ]},
  { icon: "✏️", title: "일일 입력", desc: "일일 매출, 입차 대수, 시간대별 현황, 근무자 배치 등 매장 운영 데이터를 입력합니다.", details: [
    "발렛비 · 수금 · 카드 매출 자동 합산",
    "시간대별 입차 현황 그래프",
    "근무자 배치 (주간/야간) 기록",
    "한국 공휴일 자동 판별 (평일/토요일/공휴일 뱃지)",
  ]},
  { icon: "🚗", title: "입차 현황", desc: "미팍티켓 기반 실시간 차량 입출차 현황을 관리합니다.", details: [
    "CREW앱에서 등록한 차량 실시간 표시",
    "차량번호, 입차방식(카메라OCR/수기), 등록자 확인",
    "출차 처리 및 상태 관리",
    "날짜별 · 매장별 · 등록자별 필터링",
    "엑셀 다운로드 지원",
  ]},
  { icon: "🅿️", title: "월주차 관리", desc: "월정기 주차 계약을 등록·갱신·관리합니다.", details: [
    "신규 월주차 등록 (시작일 선택 시 말일 자동 세팅)",
    "계약 갱신 (1/3/6/12개월 퀵선택)",
    "만료 D-7 자동 알림톡 발송 (Solapi 연동)",
    "관리자 수동 알림톡 발송 기능",
    "계약 상태: 계약중 / 만료 / 해지",
    "납부 상태: 미납 / 납부완료 / 연체",
  ]},
  { icon: "📈", title: "매출 분석", desc: "매장별 · 기간별 매출 추이를 차트로 분석합니다.", details: [
    "일별, 주별, 월별, 분기별 매출 비교",
    "매장 간 성과 비교 랭킹",
    "발렛비 · 주차비 · 월주차비 항목별 분석",
    "전주/전월 대비 증감률 표시",
  ]},
  { icon: "👥", title: "근무자 관리", desc: "근무자의 출퇴근, 명부, 근태, 연차 등을 종합 관리합니다. (6개 탭)", details: [
    "출퇴근: 일별 출근/퇴근 현황, 퇴근수정 요청 승인/반려",
    "명부: 근무자 등록 · 수정, 시/도 → 구/시 지역 선택",
    "근태: 달력 매트릭스 뷰 (출근/지각/결근/휴무/연차), 엑셀 다운로드",
    "연차: 연차 자동 부여, 사용/잔여 관리",
    "근무리뷰 · 시말서 기록",
  ]},
  { icon: "🏢", title: "매장 관리", desc: "매장 정보와 운영 설정을 관리합니다. (4개 탭)", details: [
    "매장 추가 · 수정 · 삭제 (카카오 도로명주소 검색 + GPS 좌표 자동)",
    "방문지 관리: 층별 방문지, 개별 요금체계 설정",
    "주차장 관리: 본관/외부, 자주식/기계식, 면수 등록",
    "운영시간 · 근무조 · 정상출근체크 기준 설정",
    "크루앱 운영 설정 토글 (발렛/월주차/방문지 등)",
  ]},
  { icon: "👋", title: "팀원 관리", desc: "어드민이 직접 계정을 생성하고 역할 · 매장을 배정합니다.", details: [
    "계정 직접 생성: 이름(한글) + 이메일 + 비밀번호 + 연락처",
    "역할 지정: Admin(전체 접근) / CREW(배정 매장만)",
    "매장 복수 배정 가능",
    "비밀번호 재설정, 계정 활성화/비활성화",
    "팀원 제거 (조직에서 분리)",
  ]},
  { icon: "⚠️", title: "사고보고", desc: "CREW앱에서 접수된 사고보고를 관리합니다.", details: [
    "사고 유형, 차량번호, 사고 내용, 사진 확인",
    "처리 상태 변경: 접수 → 처리중 → 완료",
    "관리자 메모 추가",
    "매장별 · 기간별 · 상태별 필터링",
    "엑셀 다운로드",
  ]},
  { icon: "⚙️", title: "설정", desc: "시스템 환경설정을 관리합니다.", details: [
    "계정 정보 확인",
    "사이드바 메뉴 순서 드래그 편집",
  ]},
];

export default function GuidePage() {
  return (
    <AppLayout>
      <style>{`
        @media (max-width: 767px) {
          .guide-header { padding: 20px 16px !important; }
          .guide-header-icon { width: 38px !important; height: 38px !important; border-radius: 10px !important; }
          .guide-header-icon span { font-size: 18px !important; }
          .guide-header h1 { font-size: 16px !important; }
          .guide-card-inner { padding: 14px 14px !important; }
          .guide-feature-icon { width: 36px !important; height: 36px !important; border-radius: 10px !important; font-size: 18px !important; }
          .guide-feature-title { font-size: 14px !important; }
          .guide-feature-desc { font-size: 12px !important; margin-bottom: 8px !important; }
          .guide-detail-text { font-size: 11px !important; }
          .guide-footer { padding-bottom: 80px !important; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-sm" style={{ background: "linear-gradient(135deg, #020617 0%, #0a1352 50%, #1428A0 100%)" }}>
          <div className="guide-header px-8 py-8 flex items-center gap-5">
            <div className="guide-header-icon" style={{ background: "#F5B731", width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 24 }}>📖</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white mb-1">미팍Ticket 어드민 기능 안내</h1>
              <p className="text-sm text-white/60">주차운영 관리 시스템의 모든 기능을 안내합니다</p>
            </div>
          </div>
        </div>

        {/* 기능 카드 */}
        <div className="space-y-4">
          {features.map((item, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 20, border: "none", boxShadow: "0 2px 12px rgba(20,40,160,0.07)", overflow: "hidden", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
            >
              <div className="guide-card-inner p-6">
                <div className="flex items-start gap-4">
                  <div className="guide-feature-icon" style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gold-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="guide-feature-title" style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{item.title}</h3>
                    <p className="guide-feature-desc" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{item.desc}</p>
                    <div className="space-y-1.5">
                      {item.details.map((d, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span style={{ color: "var(--gold)", fontSize: 10, marginTop: 5, flexShrink: 0 }}>●</span>
                          <span className="guide-detail-text" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 업데이트 이력 */}
        <div style={{ marginTop: 32, background: "#fff", borderRadius: 20, boxShadow: "0 2px 12px rgba(20,40,160,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>업데이트 이력</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>시스템 변경 내역을 확인합니다</div>
            </div>
          </div>
          <div style={{ padding: "16px 24px" }}>
            {[
              { date: "2026.03.11", items: [
                "CREW앱 월주차 신규등록 · 수정 기능 추가",
                "월주차 시작일 → 해당월 말일 자동 세팅",
                "전체 시스템 KST 타임존 통일",
                "사이드바 배지 ID 기반 수정 (숫자 혼선 해결)",
                "workers ↔ profiles 이름 양방향 동기화",
                "팀원 페이지 invitations 코드 정리",
                "기능안내 페이지 최신화 (어드민 + CREW)",
              ]},
              { date: "2026.03.10", items: [
                "인증 정책 변경: 카카오 로그인 제거 → 어드민 직접 계정생성",
                "팀원 관리: ID/비밀번호 직접 부여 방식 전환",
                "비밀번호 재설정 기능 추가",
              ]},
              { date: "2026.03.05", items: [
                "OCR 번호판 인식 기능 구현 (Google Cloud Vision)",
                "CREW 입차등록: 카메라 OCR + 수기 입력",
                "CREW 입차현황: 출차처리 버튼 추가",
                "고객 티켓 페이지: 출차요청 + 예상요금 표시",
                "CREW 출차요청 실시간 알림 (폴링 + 토스트 + 진동)",
              ]},
              { date: "2026.02.28", items: [
                "솔라피 알림톡 연동 (입차확인 발송 성공)",
                "알림톡 5종 템플릿 승인 완료",
              ]},
              { date: "2026.02.25", items: [
                "v3 디자인 모바일 12페이지 전체 적용 완료",
                "CREW앱 PWA 기본 구조 완성",
              ]},
              { date: "2026.02.24", items: [
                "ME.PARK 2.0 미팍Ticket 시스템 초기 버전 배포",
                "어드민 11개 메뉴 (대시보드~설정) 구현",
                "월주차 D-7 자동 알림톡 Cron 설정",
              ]},
            ].map((log, i) => (
              <div key={i} style={{ marginBottom: 20, paddingBottom: i < 5 ? 20 : 0, borderBottom: i < 5 ? "1px solid var(--border-light)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", fontFamily: "monospace" }}>{log.date}</span>
                  {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--navy)", padding: "2px 8px", borderRadius: 4 }}>최신</span>}
                </div>
                {log.items.map((item, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "var(--gold)", fontSize: 8, marginTop: 5, flexShrink: 0 }}>●</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="guide-footer mt-8 text-center pb-4">
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>© 주식회사 미스터팍 (Mr. Park) · 미팍Ticket 주차운영 시스템</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>문의: mepark1022@gmail.com</p>
        </div>
      </div>
    </AppLayout>
  );
}
