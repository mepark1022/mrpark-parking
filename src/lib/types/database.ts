export type Database = {
  public: {
    Tables: {
      regions: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
      };
      stores: {
        Row: {
          id: string; name: string; region_id: string | null;
          has_valet: boolean; valet_fee: number; address: string | null;
          is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; name: string; region_id?: string | null;
          has_valet?: boolean; valet_fee?: number; address?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; name?: string; region_id?: string | null;
          has_valet?: boolean; valet_fee?: number; address?: string | null;
          is_active?: boolean; created_at?: string; updated_at?: string;
        };
      };
      workers: {
        Row: {
          id: string; name: string; phone: string | null;
          status: "active" | "inactive"; region_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; name: string; phone?: string | null;
          status?: "active" | "inactive"; region_id?: string | null; created_at?: string;
        };
        Update: {
          id?: string; name?: string; phone?: string | null;
          status?: "active" | "inactive"; region_id?: string | null; created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string; email: string; name: string | null;
          role: "admin" | "member"; status: "active" | "pending" | "disabled";
          created_at: string;
        };
        Insert: {
          id: string; email: string; name?: string | null;
          role?: "admin" | "member"; status?: "active" | "pending" | "disabled";
          created_at?: string;
        };
        Update: {
          id?: string; email?: string; name?: string | null;
          role?: "admin" | "member"; status?: "active" | "pending" | "disabled";
          created_at?: string;
        };
      };
      store_default_workers: {
        Row: {
          id: string; store_id: string; worker_id: string;
          day_type: "weekday" | "weekend"; sort_order: number; created_at: string;
        };
        Insert: {
          id?: string; store_id: string; worker_id: string;
          day_type: "weekday" | "weekend"; sort_order?: number; created_at?: string;
        };
        Update: {
          id?: string; store_id?: string; worker_id?: string;
          day_type?: "weekday" | "weekend"; sort_order?: number; created_at?: string;
        };
      };
      daily_records: {
        Row: {
          id: string; store_id: string; date: string;
          total_cars: number; valet_count: number; valet_revenue: number;
          note: string | null; created_by: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; store_id: string; date: string;
          total_cars?: number; valet_count?: number; valet_revenue?: number;
          note?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; store_id?: string; date?: string;
          total_cars?: number; valet_count?: number; valet_revenue?: number;
          note?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
      };
      hourly_data: {
        Row: { id: string; record_id: string; hour: number; car_count: number };
        Insert: { id?: string; record_id: string; hour: number; car_count?: number };
        Update: { id?: string; record_id?: string; hour?: number; car_count?: number };
      };
      worker_assignments: {
        Row: {
          id: string; record_id: string; worker_id: string;
          worker_type: "default" | "substitute" | "hq_support";
        };
        Insert: {
          id?: string; record_id: string; worker_id: string;
          worker_type?: "default" | "substitute" | "hq_support";
        };
        Update: {
          id?: string; record_id?: string; worker_id?: string;
          worker_type?: "default" | "substitute" | "hq_support";
        };
      };
      monthly_parking: {
        Row: {
          id: string; store_id: string; vehicle_number: string;
          vehicle_type: string | null; customer_name: string; customer_phone: string;
          start_date: string; end_date: string; monthly_fee: number;
          payment_status: "paid" | "unpaid" | "overdue";
          contract_status: "active" | "expired" | "cancelled";
          note: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; store_id: string; vehicle_number: string;
          vehicle_type?: string | null; customer_name: string; customer_phone: string;
          start_date: string; end_date: string; monthly_fee: number;
          payment_status?: "paid" | "unpaid" | "overdue";
          contract_status?: "active" | "expired" | "cancelled";
          note?: string | null; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; store_id?: string; vehicle_number?: string;
          vehicle_type?: string | null; customer_name?: string; customer_phone?: string;
          start_date?: string; end_date?: string; monthly_fee?: number;
          payment_status?: "paid" | "unpaid" | "overdue";
          contract_status?: "active" | "expired" | "cancelled";
          note?: string | null; created_at?: string; updated_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string; email: string; role: string;
          invited_by: string | null; status: "pending" | "accepted" | "rejected";
          token: string; created_at: string;
        };
        Insert: {
          id?: string; email: string; role?: string;
          invited_by?: string | null; status?: "pending" | "accepted" | "rejected";
          token?: string; created_at?: string;
        };
        Update: {
          id?: string; email?: string; role?: string;
          invited_by?: string | null; status?: "pending" | "accepted" | "rejected";
          token?: string; created_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string; user_id: string | null; action: string;
          table_name: string | null; record_id: string | null;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string; user_id?: string | null; action: string;
          table_name?: string | null; record_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string; user_id?: string | null; action?: string;
          table_name?: string | null; record_id?: string | null;
          old_data?: Record<string, unknown> | null;
          new_data?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
    };
  };
};

export type Region = Database["public"]["Tables"]["regions"]["Row"];
export type Store = Database["public"]["Tables"]["stores"]["Row"];
export type Worker = Database["public"]["Tables"]["workers"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type StoreDefaultWorker = Database["public"]["Tables"]["store_default_workers"]["Row"];
export type DailyRecord = Database["public"]["Tables"]["daily_records"]["Row"];
export type HourlyData = Database["public"]["Tables"]["hourly_data"]["Row"];
export type WorkerAssignment = Database["public"]["Tables"]["worker_assignments"]["Row"];
export type MonthlyParking = Database["public"]["Tables"]["monthly_parking"]["Row"];
export type Invitation = Database["public"]["Tables"]["invitations"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];
export type WorkerType = "default" | "substitute" | "hq_support";
export type DayType = "weekday" | "weekend";
export type PaymentStatus = "paid" | "unpaid" | "overdue";
export type ContractStatus = "active" | "expired" | "cancelled";
export type UserRole = "admin" | "member";
export type UserStatus = "active" | "pending" | "disabled";