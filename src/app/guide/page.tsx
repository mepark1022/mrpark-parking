// @ts-nocheck
"use client";

import AppLayout from "@/components/layout/AppLayout";
import { LogoGNB } from "@/components/Logo";

const features = [
  { icon: "📊", title: "대시보드", desc: "매장별 매출 현황, 입차 통계, 월주차 현황, 근무자 배치 등을 한눈에 파악할 수 있습니다.", details: [
    "기간별 필터: 오늘 / 이번 주 / 이번 달 / 기간 직접 선택",
    "매장 선택 시 해당 매장의 상세 KPI 확인",
    "전체 선택 시 매장 간 매출 순위 비교 차트",
    "마감미정산 매장 실시간 알림",
  ]},
  { icon: "✏️", title: "데이터 입력", desc: "일일 매출, 입차 대수, 시간대별 현황, 근무자 배치 등 매장 운영 데이터를 입력합니다.", details: [
    "발렛비 · 수금 · 카드 매출 자동 합산",
    "시간대별 입차 현황 그래프",
    "근무자 배치 (주간/야간) 기록",
    "일자 · 매장 선택 후 간편 입력",
  ]},
  { icon: "🚗", title: "입차 현황", desc: "실시간 차량 입출차 현황을 관리합니다.", details: [
    "차량번호, 입차시간, 출차시간 기록",
    "발렛 여부 및 요금 정산",
    "미출차 차량 목록 확인",
    "날짜별 · 매장별 조회",
  ]},
  { icon: "🅿️", title: "월주차 관리", desc: "월정기 주차 계약을 체계적으로 관리합니다.", details: [
    "계약자, 차량번호, 계약기간, 요금 관리",
    "만료 예정 계약 자동 알림",
    "계약 상태: 활성 / 만료 / 해지",
    "매장별 월주차 현황 파이차트",
  ]},
  { icon: "📈", title: "매출 분석", desc: "매장별 · 기간별 매출 추이를 차트로 분석합니다.", details: [
    "일별, 주별, 월별, 분기별 매출 비교",
    "매장 간 성과 비교 랭킹",
    "발렛비 · 주차비 · 월주차비 항목별 분석",
    "기간 직접 선택 가능",
  ]},
  { icon: "👥", title: "근무자 관리", desc: "근무자의 출퇴근, 명부, 근태, 연차 등을 관리합니다.", details: [
    "출퇴근: 일별 출근/퇴근 시간, 근무상태 기록",
    "명부: 근무자 등록 · 수정 · 비활성화, 시/도 → 구/시 지역 상세 선택",
    "근태: 지각, 결근, 조퇴 등 근태 현황",
    "연차: 연차 사용 · 잔여 관리",
    "근무리뷰 · 시말서: 근무 평가 및 경고 기록",
  ]},
  { icon: "🏢", title: "매장 관리", desc: "매장 정보와 운영 설정을 관리합니다.", details: [
    "매장 추가 · 수정 · 삭제 (도로명주소 검색)",
    "운영시간: 요일별 영업시간 설정",
    "근무조: 주간/야간 근무조 편성",
    "정상출근체크: 출근 판별 기준시간 설정",
    "매장별 발렛비, 상태(운영중/일시중지) 관리",
  ]},
  { icon: "👋", title: "팀원 초대", desc: "이메일로 팀원을 초대하고 역할 · 매장을 배정합니다.", details: [
    "관리자(Admin): 전체 매장 접근 가능",
    "CREW(현장): 배정된 매장만 접근 가능",
    "초대 시 매장 복수 선택 가능",
    "기존 팀원 매장 추가/제거 (초대 불필요)",
    "카카오 로그인으로 간편 수락",
  ]},
  { icon: "⚠️", title: "사고보고", desc: "주차장 내 사고 발생 시 보고서를 작성합니다.", details: [
    "차량정보, 사고유형, 사고 내용 기록",
    "사진 첨부 기능",
    "처리 상태: 접수 → 처리중 → 완료",
    "매장별 사고 이력 조회",
  ]},
  { icon: "⚙️", title: "설정", desc: "시스템 환경설정을 관리합니다.", details: [
    "계정 정보 확인 및 수정",
    "알림 설정",
    "사이드바 메뉴 순서 편집 (드래그앤드롭)",
  ]},
];

export default function GuidePage() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="rounded-2xl overflow-hidden mb-6 shadow-sm" style={{ background: "linear-gradient(135deg, #020617 0%, #0a1352 50%, #1428A0 100%)" }}>
          <div className="px-8 py-8 flex items-center gap-5">
            <div style={{ background: "#F5B731", width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24 }}>📖</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white mb-1">ME.PARK 2.0 기능 안내</h1>
              <p className="text-sm text-white/60">주차운영 시스템의 모든 기능을 안내합니다</p>
            </div>
          </div>
        </div>

        {/* 기능 카드 */}
        <div className="space-y-4">
          {features.map((item, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)", overflow: "hidden", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--shadow-sm)"}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gold-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{item.desc}</p>
                    <div className="space-y-1.5">
                      {item.details.map((d, j) => (
                        <div key={j} className="flex items-start gap-2">
                          <span style={{ color: "var(--gold)", fontSize: 10, marginTop: 5, flexShrink: 0 }}>●</span>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 푸터 */}
        <div className="mt-8 text-center pb-4">
          <p style={{ fontSize: 11, color: "var(--text-muted)" }}>© 주식회사 미스터팍 (Mr. Park) · ME.PARK 2.0 주차운영 시스템</p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>문의: mepark1022@gmail.com</p>
        </div>
      </div>
    </AppLayout>
  );
}
