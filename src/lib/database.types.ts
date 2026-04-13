export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accident_reports: {
        Row: {
          accident_at: string
          accident_type: string
          admin_memo: string | null
          created_at: string | null
          detail: string | null
          id: string
          org_id: string
          phone: string | null
          reported_by: string | null
          reporter: string
          status: string
          store_id: string
          updated_at: string | null
          vehicle: string
        }
        Insert: {
          accident_at?: string
          accident_type?: string
          admin_memo?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          org_id: string
          phone?: string | null
          reported_by?: string | null
          reporter: string
          status?: string
          store_id: string
          updated_at?: string | null
          vehicle: string
        }
        Update: {
          accident_at?: string
          accident_type?: string
          admin_memo?: string | null
          created_at?: string | null
          detail?: string | null
          id?: string
          org_id?: string
          phone?: string | null
          reported_by?: string | null
          reporter?: string
          status?: string
          store_id?: string
          updated_at?: string | null
          vehicle?: string
        }
        Relationships: [
          {
            foreignKeyName: "accident_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accident_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      alimtalk_send_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          monthly_parking_id: string | null
          org_id: string
          phone_masked: string
          send_status: string | null
          sent_at: string | null
          template_type: string
          ticket_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          monthly_parking_id?: string | null
          org_id: string
          phone_masked: string
          send_status?: string | null
          sent_at?: string | null
          template_type: string
          ticket_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          monthly_parking_id?: string | null
          org_id?: string
          phone_masked?: string
          send_status?: string | null
          sent_at?: string | null
          template_type?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alimtalk_send_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "mepark_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_overrides: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          created_by: string
          employee_id: string
          id: string
          memo: string | null
          org_id: string
          reason: string | null
          status: string
          store_id: string | null
          updated_at: string | null
          updated_by: string | null
          work_date: string
          work_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          created_by: string
          employee_id: string
          id?: string
          memo?: string | null
          org_id: string
          reason?: string | null
          status: string
          store_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          work_date: string
          work_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          created_by?: string
          employee_id?: string
          id?: string
          memo?: string | null
          org_id?: string
          reason?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          work_date?: string
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changed_at: string | null
          changed_by: string
          id: string
          ip_address: string | null
          org_id: string
          reason: string | null
          record_id: string
          table_name: string
          user_agent: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string | null
          changed_by: string
          id?: string
          ip_address?: string | null
          org_id: string
          reason?: string | null
          record_id: string
          table_name: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changed_at?: string | null
          changed_by?: string
          id?: string
          ip_address?: string | null
          org_id?: string
          reason?: string | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          admin_note: string | null
          ai_affected_files: string[] | null
          ai_analysis: string | null
          ai_priority: string | null
          ai_suggestion: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          org_id: string
          page_url: string | null
          reporter_email: string
          reporter_id: string | null
          resolved_at: string | null
          screen_size: string | null
          screenshot_urls: string[] | null
          severity: string
          status: string
          steps_to_reproduce: string | null
          title: string
          updated_at: string | null
          user_agent: string | null
        }
        Insert: {
          admin_note?: string | null
          ai_affected_files?: string[] | null
          ai_analysis?: string | null
          ai_priority?: string | null
          ai_suggestion?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          org_id: string
          page_url?: string | null
          reporter_email?: string
          reporter_id?: string | null
          resolved_at?: string | null
          screen_size?: string | null
          screenshot_urls?: string[] | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Update: {
          admin_note?: string | null
          ai_affected_files?: string[] | null
          ai_analysis?: string | null
          ai_priority?: string | null
          ai_suggestion?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          org_id?: string
          page_url?: string | null
          reporter_email?: string
          reporter_id?: string | null
          resolved_at?: string | null
          screen_size?: string | null
          screenshot_urls?: string[] | null
          severity?: string
          status?: string
          steps_to_reproduce?: string | null
          title?: string
          updated_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_checkout_time: string | null
          created_at: string | null
          id: string
          org_id: string
          reject_reason: string | null
          request_date: string
          request_reason: string | null
          requested_checkout_time: string | null
          status: string
          store_id: string
          updated_at: string | null
          user_id: string
          worker_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_checkout_time?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          reject_reason?: string | null
          request_date: string
          request_reason?: string | null
          requested_checkout_time?: string | null
          status?: string
          store_id: string
          updated_at?: string | null
          user_id: string
          worker_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_checkout_time?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          reject_reason?: string | null
          request_date?: string
          request_reason?: string | null
          requested_checkout_time?: string | null
          status?: string
          store_id?: string
          updated_at?: string | null
          user_id?: string
          worker_id?: string
        }
        Relationships: []
      }
      daily_records: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          day_type: string | null
          id: string
          is_holiday: boolean | null
          memo: string | null
          note: string | null
          org_id: string | null
          store_id: string
          total_cars: number | null
          updated_at: string | null
          valet_count: number | null
          valet_revenue: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          day_type?: string | null
          id?: string
          is_holiday?: boolean | null
          memo?: string | null
          note?: string | null
          org_id?: string | null
          store_id: string
          total_cars?: number | null
          updated_at?: string | null
          valet_count?: number | null
          valet_revenue?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          day_type?: string | null
          id?: string
          is_holiday?: boolean | null
          memo?: string | null
          note?: string | null
          org_id?: string | null
          store_id?: string
          total_cars?: number | null
          updated_at?: string | null
          valet_count?: number | null
          valet_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_extra: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          org_id: string
          report_id: string
          storage_path: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          org_id: string
          report_id: string
          storage_path?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          org_id?: string
          report_id?: string
          storage_path?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_extra_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_payment: {
        Row: {
          amount: number
          count: number | null
          created_at: string | null
          id: string
          memo: string | null
          method: string
          org_id: string
          report_id: string
        }
        Insert: {
          amount?: number
          count?: number | null
          created_at?: string | null
          id?: string
          memo?: string | null
          method: string
          org_id: string
          report_id: string
        }
        Update: {
          amount?: number
          count?: number | null
          created_at?: string | null
          id?: string
          memo?: string | null
          method?: string
          org_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_payment_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_staff: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          employee_id: string
          id: string
          memo: string | null
          org_id: string
          report_id: string
          role: string | null
          staff_type: string
          work_hours: number | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          memo?: string | null
          org_id: string
          report_id: string
          role?: string | null
          staff_type: string
          work_hours?: number | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          memo?: string | null
          org_id?: string
          report_id?: string
          role?: string | null
          staff_type?: string
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_staff_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_staff_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string
          event_flag: boolean | null
          event_name: string | null
          id: string
          memo: string | null
          org_id: string
          report_date: string
          status: string
          store_id: string
          submitted_at: string | null
          total_cars: number | null
          total_revenue: number | null
          updated_at: string | null
          valet_count: number | null
          weather: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by: string
          event_flag?: boolean | null
          event_name?: string | null
          id?: string
          memo?: string | null
          org_id: string
          report_date: string
          status?: string
          store_id: string
          submitted_at?: string | null
          total_cars?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          valet_count?: number | null
          weather?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string
          event_flag?: boolean | null
          event_name?: string | null
          id?: string
          memo?: string | null
          org_id?: string
          report_date?: string
          status?: string
          store_id?: string
          submitted_at?: string | null
          total_cars?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          valet_count?: number | null
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account: string | null
          bank_holder: string | null
          bank_name: string | null
          base_salary: number | null
          created_at: string | null
          emp_no: string
          employment_type: string | null
          hire_date: string
          id: string
          insurance_employ: boolean | null
          insurance_health: boolean | null
          insurance_injury: boolean | null
          insurance_national: boolean | null
          memo: string | null
          name: string
          org_id: string
          phone: string | null
          position: string | null
          probation_end: string | null
          probation_months: number | null
          region: string | null
          resign_date: string | null
          role: string
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          tax_type: string | null
          updated_at: string | null
          weekend_daily: number | null
          work_type: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          base_salary?: number | null
          created_at?: string | null
          emp_no: string
          employment_type?: string | null
          hire_date: string
          id?: string
          insurance_employ?: boolean | null
          insurance_health?: boolean | null
          insurance_injury?: boolean | null
          insurance_national?: boolean | null
          memo?: string | null
          name: string
          org_id: string
          phone?: string | null
          position?: string | null
          probation_end?: string | null
          probation_months?: number | null
          region?: string | null
          resign_date?: string | null
          role?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          tax_type?: string | null
          updated_at?: string | null
          weekend_daily?: number | null
          work_type?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          base_salary?: number | null
          created_at?: string | null
          emp_no?: string
          employment_type?: string | null
          hire_date?: string
          id?: string
          insurance_employ?: boolean | null
          insurance_health?: boolean | null
          insurance_injury?: boolean | null
          insurance_national?: boolean | null
          memo?: string | null
          name?: string
          org_id?: string
          phone?: string | null
          position?: string | null
          probation_end?: string | null
          probation_months?: number | null
          region?: string | null
          resign_date?: string | null
          role?: string
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          tax_type?: string | null
          updated_at?: string | null
          weekend_daily?: number | null
          work_type?: string | null
        }
        Relationships: []
      }
      exit_requests: {
        Row: {
          assigned_crew_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          org_id: string
          parking_location: string | null
          pickup_location: string | null
          plate_number: string
          preparing_at: string | null
          ready_at: string | null
          requested_at: string | null
          status: string
          store_id: string
          ticket_id: string
        }
        Insert: {
          assigned_crew_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          org_id: string
          parking_location?: string | null
          pickup_location?: string | null
          plate_number: string
          preparing_at?: string | null
          ready_at?: string | null
          requested_at?: string | null
          status?: string
          store_id: string
          ticket_id: string
        }
        Update: {
          assigned_crew_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          org_id?: string
          parking_location?: string | null
          pickup_location?: string | null
          plate_number?: string
          preparing_at?: string | null
          ready_at?: string | null
          requested_at?: string | null
          status?: string
          store_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exit_requests_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "mepark_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_data: {
        Row: {
          car_count: number | null
          hour: number
          id: string
          org_id: string | null
          record_id: string
        }
        Insert: {
          car_count?: number | null
          hour: number
          id?: string
          org_id?: string | null
          record_id: string
        }
        Update: {
          car_count?: number | null
          hour?: number
          id?: string
          org_id?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_data_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hourly_data_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "daily_records"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          org_id: string | null
          role: string | null
          status: string | null
          store_id: string | null
          store_ids: Json | null
          token: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string | null
          role?: string | null
          status?: string | null
          store_id?: string | null
          store_ids?: Json | null
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string | null
          role?: string | null
          status?: string | null
          store_id?: string | null
          store_ids?: Json | null
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mepark_tickets: {
        Row: {
          additional_fee: number | null
          additional_paid_at: string | null
          calculated_fee: number | null
          completed_at: string | null
          created_at: string | null
          entry_alimtalk_sent: boolean | null
          entry_at: string
          entry_crew_id: string | null
          entry_method: string | null
          exit_at: string | null
          exit_crew_id: string | null
          exit_requested_at: string | null
          id: string
          is_demo: boolean | null
          is_free: boolean | null
          is_monthly: boolean | null
          monthly_parking_id: string | null
          org_id: string
          paid_amount: number | null
          parking_location: string | null
          parking_lot_id: string | null
          parking_type: string
          payment_key: string | null
          payment_method: string | null
          plate_last4: string
          plate_number: string
          pre_paid_at: string | null
          pre_paid_deadline: string | null
          ready_alimtalk_sent: boolean | null
          receipt_url: string | null
          status: string
          store_id: string
          updated_at: string | null
          vehicle_photos: string[] | null
          visit_place_id: string | null
        }
        Insert: {
          additional_fee?: number | null
          additional_paid_at?: string | null
          calculated_fee?: number | null
          completed_at?: string | null
          created_at?: string | null
          entry_alimtalk_sent?: boolean | null
          entry_at?: string
          entry_crew_id?: string | null
          entry_method?: string | null
          exit_at?: string | null
          exit_crew_id?: string | null
          exit_requested_at?: string | null
          id?: string
          is_demo?: boolean | null
          is_free?: boolean | null
          is_monthly?: boolean | null
          monthly_parking_id?: string | null
          org_id: string
          paid_amount?: number | null
          parking_location?: string | null
          parking_lot_id?: string | null
          parking_type?: string
          payment_key?: string | null
          payment_method?: string | null
          plate_last4: string
          plate_number: string
          pre_paid_at?: string | null
          pre_paid_deadline?: string | null
          ready_alimtalk_sent?: boolean | null
          receipt_url?: string | null
          status?: string
          store_id: string
          updated_at?: string | null
          vehicle_photos?: string[] | null
          visit_place_id?: string | null
        }
        Update: {
          additional_fee?: number | null
          additional_paid_at?: string | null
          calculated_fee?: number | null
          completed_at?: string | null
          created_at?: string | null
          entry_alimtalk_sent?: boolean | null
          entry_at?: string
          entry_crew_id?: string | null
          entry_method?: string | null
          exit_at?: string | null
          exit_crew_id?: string | null
          exit_requested_at?: string | null
          id?: string
          is_demo?: boolean | null
          is_free?: boolean | null
          is_monthly?: boolean | null
          monthly_parking_id?: string | null
          org_id?: string
          paid_amount?: number | null
          parking_location?: string | null
          parking_lot_id?: string | null
          parking_type?: string
          payment_key?: string | null
          payment_method?: string | null
          plate_last4?: string
          plate_number?: string
          pre_paid_at?: string | null
          pre_paid_deadline?: string | null
          ready_alimtalk_sent?: boolean | null
          receipt_url?: string | null
          status?: string
          store_id?: string
          updated_at?: string | null
          vehicle_photos?: string[] | null
          visit_place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mepark_tickets_monthly_parking_id_fkey"
            columns: ["monthly_parking_id"]
            isOneToOne: false
            referencedRelation: "monthly_parking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mepark_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mepark_tickets_parking_lot_id_fkey"
            columns: ["parking_lot_id"]
            isOneToOne: false
            referencedRelation: "parking_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mepark_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mepark_tickets_visit_place_id_fkey"
            columns: ["visit_place_id"]
            isOneToOne: false
            referencedRelation: "visit_places"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_parking: {
        Row: {
          contract_status: string | null
          created_at: string | null
          customer_name: string
          customer_phone: string
          d7_alimtalk_sent: boolean | null
          d7_alimtalk_sent_at: string | null
          end_date: string
          id: string
          monthly_fee: number
          note: string | null
          org_id: string | null
          payment_status: string | null
          renewed_from_id: string | null
          start_date: string
          store_id: string
          tenant_id: string | null
          updated_at: string | null
          vehicle_number: string
          vehicle_type: string | null
        }
        Insert: {
          contract_status?: string | null
          created_at?: string | null
          customer_name: string
          customer_phone: string
          d7_alimtalk_sent?: boolean | null
          d7_alimtalk_sent_at?: string | null
          end_date: string
          id?: string
          monthly_fee: number
          note?: string | null
          org_id?: string | null
          payment_status?: string | null
          renewed_from_id?: string | null
          start_date: string
          store_id: string
          tenant_id?: string | null
          updated_at?: string | null
          vehicle_number: string
          vehicle_type?: string | null
        }
        Update: {
          contract_status?: string | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          d7_alimtalk_sent?: boolean | null
          d7_alimtalk_sent_at?: string | null
          end_date?: string
          id?: string
          monthly_fee?: number
          note?: string | null
          org_id?: string | null
          payment_status?: string | null
          renewed_from_id?: string | null
          start_date?: string
          store_id?: string
          tenant_id?: string | null
          updated_at?: string | null
          vehicle_number?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_parking_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_parking_renewed_from_id_fkey"
            columns: ["renewed_from_id"]
            isOneToOne: false
            referencedRelation: "monthly_parking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_parking_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_parking_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          max_stores: number | null
          max_workers: number | null
          name: string
          owner_id: string | null
          plan: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_stores?: number | null
          max_workers?: number | null
          name: string
          owner_id?: string | null
          plan?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          max_stores?: number | null
          max_workers?: number | null
          name?: string
          owner_id?: string | null
          plan?: string | null
        }
        Relationships: []
      }
      overtime_shifts: {
        Row: {
          created_at: string | null
          date: string
          end_time: string
          id: string
          note: string | null
          org_id: string | null
          start_time: string
          store_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          note?: string | null
          org_id?: string | null
          start_time: string
          store_id: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          note?: string | null
          org_id?: string | null
          start_time?: string
          store_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overtime_shifts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_entries: {
        Row: {
          created_at: string | null
          entry_time: string
          exit_time: string | null
          fee_charged: number | null
          floor: string | null
          id: string
          note: string | null
          org_id: string | null
          parking_lot_id: string | null
          parking_type: string
          photo_url: string | null
          plate_number: string
          status: string
          store_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          entry_time?: string
          exit_time?: string | null
          fee_charged?: number | null
          floor?: string | null
          id?: string
          note?: string | null
          org_id?: string | null
          parking_lot_id?: string | null
          parking_type?: string
          photo_url?: string | null
          plate_number: string
          status?: string
          store_id: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          entry_time?: string
          exit_time?: string | null
          fee_charged?: number | null
          floor?: string | null
          id?: string
          note?: string | null
          org_id?: string | null
          parking_lot_id?: string | null
          parking_type?: string
          photo_url?: string | null
          plate_number?: string
          status?: string
          store_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parking_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_entries_parking_lot_id_fkey"
            columns: ["parking_lot_id"]
            isOneToOne: false
            referencedRelation: "parking_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      parking_lots: {
        Row: {
          base_fee: number | null
          base_minutes: number | null
          close_time: string | null
          created_at: string | null
          daily_max: number | null
          display_order: number | null
          extra_fee: number | null
          extra_unit: number | null
          id: string
          lot_tag: string | null
          lot_type: string
          mechanical_normal: number | null
          mechanical_suv: number | null
          name: string
          open_time: string | null
          operating_days: Json | null
          operation_mode: string | null
          org_id: string | null
          parking_type: string[]
          road_address: string | null
          self_spaces: number | null
          store_id: string
          total_spaces: number | null
        }
        Insert: {
          base_fee?: number | null
          base_minutes?: number | null
          close_time?: string | null
          created_at?: string | null
          daily_max?: number | null
          display_order?: number | null
          extra_fee?: number | null
          extra_unit?: number | null
          id?: string
          lot_tag?: string | null
          lot_type?: string
          mechanical_normal?: number | null
          mechanical_suv?: number | null
          name: string
          open_time?: string | null
          operating_days?: Json | null
          operation_mode?: string | null
          org_id?: string | null
          parking_type?: string[]
          road_address?: string | null
          self_spaces?: number | null
          store_id: string
          total_spaces?: number | null
        }
        Update: {
          base_fee?: number | null
          base_minutes?: number | null
          close_time?: string | null
          created_at?: string | null
          daily_max?: number | null
          display_order?: number | null
          extra_fee?: number | null
          extra_unit?: number | null
          id?: string
          lot_tag?: string | null
          lot_type?: string
          mechanical_normal?: number | null
          mechanical_suv?: number | null
          name?: string
          open_time?: string | null
          operating_days?: Json | null
          operation_mode?: string | null
          org_id?: string | null
          parking_type?: string[]
          road_address?: string | null
          self_spaces?: number | null
          store_id?: string
          total_spaces?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parking_lots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parking_lots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          amount: number
          canceled_at: string | null
          card_company: string | null
          created_at: string | null
          id: string
          method: string
          order_id: string
          org_id: string
          paid_at: string | null
          payment_key: string
          provider: string | null
          receipt_url: string | null
          status: string
          ticket_id: string
        }
        Insert: {
          amount: number
          canceled_at?: string | null
          card_company?: string | null
          created_at?: string | null
          id?: string
          method: string
          order_id: string
          org_id: string
          paid_at?: string | null
          payment_key: string
          provider?: string | null
          receipt_url?: string | null
          status?: string
          ticket_id: string
        }
        Update: {
          amount?: number
          canceled_at?: string | null
          card_company?: string | null
          created_at?: string | null
          id?: string
          method?: string
          order_id?: string
          org_id?: string
          paid_at?: string | null
          payment_key?: string
          provider?: string | null
          receipt_url?: string | null
          status?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "mepark_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          emp_no: string | null
          employee_id: string | null
          id: string
          last_login_at: string | null
          locked_until: string | null
          login_fail_count: number | null
          menu_order: Json | null
          name: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          org_id: string | null
          password_changed: boolean | null
          role: string | null
          site_code: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          emp_no?: string | null
          employee_id?: string | null
          id: string
          last_login_at?: string | null
          locked_until?: string | null
          login_fail_count?: number | null
          menu_order?: Json | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          org_id?: string | null
          password_changed?: boolean | null
          role?: string | null
          site_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          emp_no?: string | null
          employee_id?: string | null
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          login_fail_count?: number | null
          menu_order?: Json | null
          name?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          org_id?: string | null
          password_changed?: boolean | null
          role?: string | null
          site_code?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      store_default_workers: {
        Row: {
          created_at: string | null
          day_type: string
          id: string
          org_id: string | null
          sort_order: number | null
          store_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          day_type: string
          id?: string
          org_id?: string | null
          sort_order?: number | null
          store_id: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          day_type?: string
          id?: string
          org_id?: string | null
          sort_order?: number | null
          store_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_default_workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_default_workers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_default_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      store_late_rules: {
        Row: {
          absence_threshold_minutes: number
          absent_minutes: number | null
          created_at: string | null
          grace_minutes: number
          id: string
          late_minutes: number | null
          late_threshold_minutes: number
          org_id: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          absence_threshold_minutes?: number
          absent_minutes?: number | null
          created_at?: string | null
          grace_minutes?: number
          id?: string
          late_minutes?: number | null
          late_threshold_minutes?: number
          org_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          absence_threshold_minutes?: number
          absent_minutes?: number | null
          created_at?: string | null
          grace_minutes?: number
          id?: string
          late_minutes?: number | null
          late_threshold_minutes?: number
          org_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_late_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_late_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          deactivated_at: string | null
          employee_id: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          org_id: string | null
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          org_id?: string | null
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          employee_id?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          org_id?: string | null
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_operating_hours: {
        Row: {
          close_time: string
          created_at: string | null
          day_category: string | null
          day_of_week: number | null
          id: string
          is_closed: boolean | null
          open_time: string
          org_id: string | null
          store_id: string | null
        }
        Insert: {
          close_time?: string
          created_at?: string | null
          day_category?: string | null
          day_of_week?: number | null
          id?: string
          is_closed?: boolean | null
          open_time?: string
          org_id?: string | null
          store_id?: string | null
        }
        Update: {
          close_time?: string
          created_at?: string | null
          day_category?: string | null
          day_of_week?: number | null
          id?: string
          is_closed?: boolean | null
          open_time?: string
          org_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_operating_hours_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_operating_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_parking_fees: {
        Row: {
          base_fee: number | null
          base_minutes: number | null
          created_at: string | null
          daily_max_fee: number | null
          extra_unit_fee: number | null
          extra_unit_minutes: number | null
          fee_name: string
          free_minutes: number | null
          id: string
          is_active: boolean | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          base_fee?: number | null
          base_minutes?: number | null
          created_at?: string | null
          daily_max_fee?: number | null
          extra_unit_fee?: number | null
          extra_unit_minutes?: number | null
          fee_name?: string
          free_minutes?: number | null
          id?: string
          is_active?: boolean | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          base_fee?: number | null
          base_minutes?: number | null
          created_at?: string | null
          daily_max_fee?: number | null
          extra_unit_fee?: number | null
          extra_unit_minutes?: number | null
          fee_name?: string
          free_minutes?: number | null
          id?: string
          is_active?: boolean | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_parking_fees_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pricing: {
        Row: {
          base_fee: number
          base_minutes: number
          created_at: string | null
          daily_max: number | null
          extra_fee: number
          extra_minutes: number
          id: string
          is_active: boolean | null
          monthly_fee: number | null
          parking_type: string
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          base_fee?: number
          base_minutes?: number
          created_at?: string | null
          daily_max?: number | null
          extra_fee?: number
          extra_minutes?: number
          id?: string
          is_active?: boolean | null
          monthly_fee?: number | null
          parking_type?: string
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          base_fee?: number
          base_minutes?: number
          created_at?: string | null
          daily_max?: number | null
          extra_fee?: number
          extra_minutes?: number
          id?: string
          is_active?: boolean | null
          monthly_fee?: number | null
          parking_type?: string
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_pricing_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shifts: {
        Row: {
          created_at: string | null
          day_type: string
          end_time: string
          id: string
          min_workers: number | null
          name: string | null
          org_id: string | null
          shift_name: string
          start_time: string
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_type?: string
          end_time: string
          id?: string
          min_workers?: number | null
          name?: string | null
          org_id?: string | null
          shift_name: string
          start_time: string
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_type?: string
          end_time?: string
          id?: string
          min_workers?: number | null
          name?: string | null
          org_id?: string | null
          shift_name?: string
          start_time?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          address_detail: string | null
          address_road: string | null
          address_zipcode: string | null
          base_fee: number | null
          base_minutes: number | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          daily_max: number | null
          detail_address: string | null
          enable_monthly: boolean | null
          enable_plate_search: boolean | null
          enable_valet: boolean | null
          extra_fee: number | null
          extra_unit_minutes: number | null
          free_minutes: number | null
          gps_radius_meters: number | null
          grace_period_minutes: number | null
          has_kiosk: boolean | null
          has_toss_kiosk: boolean | null
          has_valet: boolean | null
          id: string
          is_active: boolean | null
          is_free_parking: boolean | null
          latitude: number | null
          longitude: number | null
          manager_name: string | null
          manager_phone: string | null
          name: string
          org_id: string | null
          region_city: string | null
          region_district: string | null
          region_id: string | null
          require_entry_photo: boolean | null
          require_visit_place: boolean | null
          road_address: string | null
          site_code: string | null
          updated_at: string | null
          valet_fee: number | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          address_road?: string | null
          address_zipcode?: string | null
          base_fee?: number | null
          base_minutes?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          daily_max?: number | null
          detail_address?: string | null
          enable_monthly?: boolean | null
          enable_plate_search?: boolean | null
          enable_valet?: boolean | null
          extra_fee?: number | null
          extra_unit_minutes?: number | null
          free_minutes?: number | null
          gps_radius_meters?: number | null
          grace_period_minutes?: number | null
          has_kiosk?: boolean | null
          has_toss_kiosk?: boolean | null
          has_valet?: boolean | null
          id?: string
          is_active?: boolean | null
          is_free_parking?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          name: string
          org_id?: string | null
          region_city?: string | null
          region_district?: string | null
          region_id?: string | null
          require_entry_photo?: boolean | null
          require_visit_place?: boolean | null
          road_address?: string | null
          site_code?: string | null
          updated_at?: string | null
          valet_fee?: number | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          address_road?: string | null
          address_zipcode?: string | null
          base_fee?: number | null
          base_minutes?: number | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          daily_max?: number | null
          detail_address?: string | null
          enable_monthly?: boolean | null
          enable_plate_search?: boolean | null
          enable_valet?: boolean | null
          extra_fee?: number | null
          extra_unit_minutes?: number | null
          free_minutes?: number | null
          gps_radius_meters?: number | null
          grace_period_minutes?: number | null
          has_kiosk?: boolean | null
          has_toss_kiosk?: boolean | null
          has_valet?: boolean | null
          id?: string
          is_active?: boolean | null
          is_free_parking?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_name?: string | null
          manager_phone?: string | null
          name?: string
          org_id?: string | null
          region_city?: string | null
          region_district?: string | null
          region_id?: string | null
          require_entry_photo?: boolean | null
          require_visit_place?: boolean | null
          road_address?: string | null
          site_code?: string | null
          updated_at?: string | null
          valet_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          business_no: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          default_store_id: string | null
          id: string
          last_contracted_at: string | null
          memo: string | null
          monthly_fee_default: number | null
          name: string
          org_id: string
          status: string
          updated_at: string
          updated_by: string | null
          usage_count: number
        }
        Insert: {
          business_no?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          default_store_id?: string | null
          id?: string
          last_contracted_at?: string | null
          memo?: string | null
          monthly_fee_default?: number | null
          name: string
          org_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          usage_count?: number
        }
        Update: {
          business_no?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          default_store_id?: string | null
          id?: string
          last_contracted_at?: string | null
          memo?: string | null
          monthly_fee_default?: number | null
          name?: string
          org_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenants_default_store_id_fkey"
            columns: ["default_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          created_at: string | null
          id: string
          notify_entry: boolean | null
          notify_exit_request: boolean | null
          notify_payment: boolean | null
          org_id: string
          push_enabled: boolean | null
          sound_enabled: boolean | null
          updated_at: string | null
          user_id: string
          vibration_enabled: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notify_entry?: boolean | null
          notify_exit_request?: boolean | null
          notify_payment?: boolean | null
          org_id: string
          push_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
          vibration_enabled?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notify_entry?: boolean | null
          notify_exit_request?: boolean | null
          notify_payment?: boolean | null
          org_id?: string
          push_enabled?: boolean | null
          sound_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
          vibration_enabled?: boolean | null
        }
        Relationships: []
      }
      visit_places: {
        Row: {
          base_fee: number | null
          base_minutes: number | null
          created_at: string | null
          daily_max: number | null
          display_order: number | null
          extra_fee: number | null
          floor: string | null
          free_minutes: number | null
          id: string
          monthly_fee: number | null
          name: string
          org_id: string | null
          store_id: string
          valet_fee: number | null
        }
        Insert: {
          base_fee?: number | null
          base_minutes?: number | null
          created_at?: string | null
          daily_max?: number | null
          display_order?: number | null
          extra_fee?: number | null
          floor?: string | null
          free_minutes?: number | null
          id?: string
          monthly_fee?: number | null
          name: string
          org_id?: string | null
          store_id: string
          valet_fee?: number | null
        }
        Update: {
          base_fee?: number | null
          base_minutes?: number | null
          created_at?: string | null
          daily_max?: number | null
          display_order?: number | null
          extra_fee?: number | null
          floor?: string | null
          free_minutes?: number | null
          id?: string
          monthly_fee?: number | null
          name?: string
          org_id?: string | null
          store_id?: string
          valet_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_places_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_places_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_assignments: {
        Row: {
          id: string
          org_id: string | null
          record_id: string
          worker_id: string
          worker_type: string | null
        }
        Insert: {
          id?: string
          org_id?: string | null
          record_id: string
          worker_id: string
          worker_type?: string | null
        }
        Update: {
          id?: string
          org_id?: string | null
          record_id?: string
          worker_id?: string
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "daily_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_assignments_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_attendance: {
        Row: {
          check_in: string | null
          check_in_distance_m: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_type: string | null
          check_out: string | null
          check_out_distance_m: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_type: string | null
          created_at: string | null
          date: string
          id: string
          note: string | null
          org_id: string | null
          status: string
          store_id: string | null
          worker_id: string | null
        }
        Insert: {
          check_in?: string | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_type?: string | null
          check_out?: string | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_type?: string | null
          created_at?: string | null
          date: string
          id?: string
          note?: string | null
          org_id?: string | null
          status?: string
          store_id?: string | null
          worker_id?: string | null
        }
        Update: {
          check_in?: string | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_type?: string | null
          check_out?: string | null
          check_out_distance_m?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_type?: string | null
          created_at?: string | null
          date?: string
          id?: string
          note?: string | null
          org_id?: string | null
          status?: string
          store_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_leave_records: {
        Row: {
          created_at: string | null
          days: number
          end_date: string
          id: string
          leave_type: string
          org_id: string | null
          reason: string | null
          reject_reason: string | null
          requested_by_crew: boolean | null
          start_date: string
          status: string
          worker_id: string | null
        }
        Insert: {
          created_at?: string | null
          days?: number
          end_date: string
          id?: string
          leave_type?: string
          org_id?: string | null
          reason?: string | null
          reject_reason?: string | null
          requested_by_crew?: boolean | null
          start_date: string
          status?: string
          worker_id?: string | null
        }
        Update: {
          created_at?: string | null
          days?: number
          end_date?: string
          id?: string
          leave_type?: string
          org_id?: string | null
          reason?: string | null
          reject_reason?: string | null
          requested_by_crew?: boolean | null
          start_date?: string
          status?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_leave_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_leave_records_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_leaves: {
        Row: {
          created_at: string | null
          id: string
          note: string | null
          org_id: string | null
          total_days: number
          updated_at: string | null
          used_days: number
          worker_id: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string | null
          org_id?: string | null
          total_days?: number
          updated_at?: string | null
          used_days?: number
          worker_id?: string | null
          year?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string | null
          org_id?: string | null
          total_days?: number
          updated_at?: string | null
          used_days?: number
          worker_id?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_leaves_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_leaves_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_reports: {
        Row: {
          content: string | null
          created_at: string | null
          date: string
          id: string
          org_id: string | null
          severity: string
          title: string
          worker_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          date: string
          id?: string
          org_id?: string | null
          severity?: string
          title: string
          worker_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          date?: string
          id?: string
          org_id?: string | null
          severity?: string
          title?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_reports_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_reviews: {
        Row: {
          attitude: number
          average: number | null
          comment: string | null
          created_at: string | null
          id: string
          month: string
          org_id: string | null
          punctuality: number
          skill: number
          teamwork: number
          worker_id: string | null
        }
        Insert: {
          attitude?: number
          average?: number | null
          comment?: string | null
          created_at?: string | null
          id?: string
          month: string
          org_id?: string | null
          punctuality?: number
          skill?: number
          teamwork?: number
          worker_id?: string | null
        }
        Update: {
          attitude?: number
          average?: number | null
          comment?: string | null
          created_at?: string | null
          id?: string
          month?: string
          org_id?: string | null
          punctuality?: number
          skill?: number
          teamwork?: number
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_reviews_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string | null
          district: string | null
          hire_date: string | null
          id: string
          name: string
          org_id: string | null
          phone: string | null
          region_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          district?: string | null
          hire_date?: string | null
          id?: string
          name: string
          org_id?: string | null
          phone?: string | null
          region_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          district?: string | null
          hire_date?: string | null
          id?: string
          name?: string
          org_id?: string | null
          phone?: string | null
          region_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_org_id: { Args: never; Returns: string }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
