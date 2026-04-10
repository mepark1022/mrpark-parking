/**
 * 미팍 통합앱 v2 — API 타입 정의
 * 
 * 역할 체계: super_admin > admin > crew > field_member
 * 권한 분류: SYSTEM > MANAGE > OPERATE > SELF > PUBLIC
 * 모든 API 응답은 ApiResponse<T> 형식
 */

// ── 역할 ──
export type UserRole = 'super_admin' | 'admin' | 'crew' | 'field_member';

// ── 권한 레벨 ──
export type PermissionLevel = 'SYSTEM' | 'MANAGE' | 'OPERATE' | 'SELF' | 'PUBLIC' | 'CRON';

// ── 역할별 허용 권한 ──
export const ROLE_HIERARCHY: Record<UserRole, PermissionLevel[]> = {
  super_admin: ['SYSTEM', 'MANAGE', 'OPERATE', 'SELF'],
  admin:       ['MANAGE', 'OPERATE', 'SELF'],
  crew:        ['OPERATE', 'SELF'],
  field_member: ['SELF'],
};

// ── 직원 상태 ──
export type EmployeeStatus = '재직' | '퇴사' | '수습' | '휴직';

// ── 근태 상태 8종 ──
export type AttendanceStatus = 
  | 'present'    // 출근
  | 'additional' // 추가
  | 'peak'       // 피크
  | 'support'    // 지원
  | 'late'       // 지각
  | 'absent'     // 결근
  | 'off'        // 휴무
  | 'leave';     // 연차

// ── 로그인 입력 유형 ──
export type LoginInputType = 'EMAIL' | 'PHONE' | 'EMPNO';

// ── API 성공 응답 ──
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    page_size?: number;   // 현재 페이지의 실제 항목 수 (limit과 동일하거나 작음)
    total_pages?: number; // 전체 페이지 수 = ceil(total / limit)
  };
}

// ── API 실패 응답 ──
export interface ApiError {
  success: false;
  error: {
    code: string;      // AUTH_INVALID_TOKEN, PERM_INSUFFICIENT, EMP_DUPLICATE_NO 등
    message: string;   // 한글 메시지
    details?: unknown;
  };
}

// ── 통합 API 응답 ──
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── 인증된 사용자 컨텍스트 ──
export interface AuthContext {
  userId: string;       // Supabase auth.users.id
  orgId: string;        // 소속 org_id
  role: UserRole;       // 역할
  empNo?: string;       // 사번 (직원인 경우)
  employeeId?: string;  // employees.id (직원인 경우)
  siteCode?: string;    // 주 사업장 코드
  storeIds?: string[];  // 접근 가능 사업장 ID 목록 (crew/field)
}

// ── Profiles 테이블 (확장) ──
export interface ProfileRow {
  id: string;                  // auth.users.id
  org_id: string;
  role: UserRole;
  emp_no?: string;
  employee_id?: string;
  site_code?: string;
  password_changed: boolean;
  last_login_at?: string;
  login_fail_count: number;
  locked_until?: string;
  created_at: string;
  // 기존 컬럼 (하위 호환)
  name?: string;
  menu_order?: string;
}

// ── Employees 테이블 ──
export interface EmployeeRow {
  id: string;
  org_id: string;
  emp_no: string;           // 사번 (MP17001, MPA1 등)
  name: string;
  phone?: string;           // 전화번호 (마스킹 저장 또는 암호화)
  position?: string;        // 직위
  role: UserRole;           // crew / field_member / admin
  status: EmployeeStatus;
  hire_date: string;        // 입사일 (필수)
  resign_date?: string;     // 퇴사일
  probation_end?: string;   // 수습 종료일
  work_type?: string;       // 근무형태 코드 (A~G, W 등)
  base_salary?: number;     // 기본급
  weekend_daily?: number;   // 주말일당
  bank_name?: string;
  bank_account?: string;
  region?: string;
  status_changed_at?: string;
  status_changed_by?: string;
  created_at: string;
  updated_at: string;
}

// ── Store Members (사업장 배정) ──
export interface StoreMemberRow {
  id: string;
  org_id: string;
  employee_id: string;
  store_id: string;
  is_primary: boolean;      // 주 사업장 여부
  is_active: boolean;       // 활성 여부 (퇴사 시 false)
  assigned_at: string;
  assigned_by?: string;
}

// ── Store (사업장) ──
export interface StoreRow {
  id: string;
  org_id: string;
  name: string;
  site_code?: string;
  region_city?: string;
  region_district?: string;
  road_address?: string;
  address?: string;
  manager_name?: string;
  contact_name?: string;
  contact_phone?: string;
  latitude?: number;
  longitude?: number;
  status?: string;             // active / deleted
  is_active: boolean;
  is_free_parking?: boolean;
  has_valet?: boolean;
  valet_fee?: number;
  has_kiosk?: boolean;
  has_toss_kiosk?: boolean;
  grace_period_minutes?: number;
  gps_radius_meters?: number;
  // CREW앱 운영 설정
  require_entry_photo?: boolean;
  enable_plate_search?: boolean;
  enable_valet?: boolean;
  enable_monthly?: boolean;
  require_visit_place?: boolean;
  created_at: string;
  updated_at: string;
}

// ── Parking Lot (주차장) ──
export interface ParkingLotRow {
  id: string;
  org_id: string;
  store_id: string;
  name: string;
  lot_type: string;            // internal / external
  parking_type: string[];      // ['self', 'mechanical'] 등
  road_address?: string;
  self_spaces: number;
  mechanical_normal: number;
  mechanical_suv: number;
  operating_days?: Record<string, boolean>;
  open_time?: string;
  close_time?: string;
  created_at: string;
  updated_at: string;
}

// ── Visit Place (방문지) ──
export interface VisitPlaceRow {
  id: string;
  org_id: string;
  store_id: string;
  name: string;
  floor?: string;
  free_minutes: number;
  base_fee: number;
  base_minutes: number;
  extra_fee: number;
  daily_max: number;
  valet_fee: number;
  monthly_fee: number;
  created_at: string;
  updated_at: string;
}

// ── Audit Log ──
export interface AuditLogRow {
  id: string;
  org_id: string;
  table_name: string;
  record_id: string;
  action: 'insert' | 'update' | 'delete';
  changed_by: string;
  changed_at: string;
  before_data?: unknown;
  after_data?: unknown;
  reason?: string;
}
