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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address_line: string | null
          base_currency: string | null
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          fax: string | null
          id: string
          is_active: boolean
          is_head_office: boolean
          manager_employee_id: string | null
          mobile: string | null
          name: string
          name_ar: string | null
          notes: string | null
          phone: string | null
          position: number
          postal_code: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line?: string | null
          base_currency?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean
          is_head_office?: boolean
          manager_employee_id?: string | null
          mobile?: string | null
          name: string
          name_ar?: string | null
          notes?: string | null
          phone?: string | null
          position?: number
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line?: string | null
          base_currency?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean
          is_head_office?: boolean
          manager_employee_id?: string | null
          mobile?: string | null
          name?: string
          name_ar?: string | null
          notes?: string | null
          phone?: string | null
          position?: number
          postal_code?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          base_currency: string | null
          city: string | null
          code: string
          country: string | null
          cr_no: string | null
          created_at: string
          created_by: string | null
          date_format: string | null
          default_language: string | null
          email: string | null
          emails: Json
          fax: string | null
          faxes: Json
          finance_manager: string | null
          fiscal_year_end: string | null
          fiscal_year_start: string | null
          gm_name: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          mobile: string | null
          mobiles: Json
          name: string
          name_ar: string | null
          notes: string | null
          number_format: string | null
          phone: string | null
          phones: Json
          postal_code: string | null
          purchasing_manager: string | null
          sales_manager: string | null
          short_name: string | null
          state: string | null
          tax_no: string | null
          timezone: string | null
          updated_at: string
          vat_no: string | null
          website: string | null
          websites: Json
        }
        Insert: {
          address?: string | null
          base_currency?: string | null
          city?: string | null
          code: string
          country?: string | null
          cr_no?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_language?: string | null
          email?: string | null
          emails?: Json
          fax?: string | null
          faxes?: Json
          finance_manager?: string | null
          fiscal_year_end?: string | null
          fiscal_year_start?: string | null
          gm_name?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mobile?: string | null
          mobiles?: Json
          name: string
          name_ar?: string | null
          notes?: string | null
          number_format?: string | null
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          purchasing_manager?: string | null
          sales_manager?: string | null
          short_name?: string | null
          state?: string | null
          tax_no?: string | null
          timezone?: string | null
          updated_at?: string
          vat_no?: string | null
          website?: string | null
          websites?: Json
        }
        Update: {
          address?: string | null
          base_currency?: string | null
          city?: string | null
          code?: string
          country?: string | null
          cr_no?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_language?: string | null
          email?: string | null
          emails?: Json
          fax?: string | null
          faxes?: Json
          finance_manager?: string | null
          fiscal_year_end?: string | null
          fiscal_year_start?: string | null
          gm_name?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mobile?: string | null
          mobiles?: Json
          name?: string
          name_ar?: string | null
          notes?: string | null
          number_format?: string | null
          phone?: string | null
          phones?: Json
          postal_code?: string | null
          purchasing_manager?: string | null
          sales_manager?: string | null
          short_name?: string | null
          state?: string | null
          tax_no?: string | null
          timezone?: string | null
          updated_at?: string
          vat_no?: string | null
          website?: string | null
          websites?: Json
        }
        Relationships: []
      }
      company_document_files: {
        Row: {
          document_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          document_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          document_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "company_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      company_document_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          default_department_ids: string[]
          description: string | null
          id: string
          is_system: boolean
          name_ar: string
          name_en: string
          notify_days_before: number
          notify_repeat: Database["public"]["Enums"]["doc_notify_repeat"]
          position: number
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          default_department_ids?: string[]
          description?: string | null
          id?: string
          is_system?: boolean
          name_ar: string
          name_en: string
          notify_days_before?: number
          notify_repeat?: Database["public"]["Enums"]["doc_notify_repeat"]
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          default_department_ids?: string[]
          description?: string | null
          id?: string
          is_system?: boolean
          name_ar?: string
          name_en?: string
          notify_days_before?: number
          notify_repeat?: Database["public"]["Enums"]["doc_notify_repeat"]
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_document_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          department_ids: string[] | null
          doc_number: string | null
          expiry_date: string | null
          extra: Json
          id: string
          issue_date: string | null
          last_notified_at: string | null
          notes: string | null
          notify_days_before: number | null
          notify_repeat: Database["public"]["Enums"]["doc_notify_repeat"] | null
          superseded_at: string | null
          superseded_by: string | null
          type_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          department_ids?: string[] | null
          doc_number?: string | null
          expiry_date?: string | null
          extra?: Json
          id?: string
          issue_date?: string | null
          last_notified_at?: string | null
          notes?: string | null
          notify_days_before?: number | null
          notify_repeat?:
            | Database["public"]["Enums"]["doc_notify_repeat"]
            | null
          superseded_at?: string | null
          superseded_by?: string | null
          type_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          department_ids?: string[] | null
          doc_number?: string | null
          expiry_date?: string | null
          extra?: Json
          id?: string
          issue_date?: string | null
          last_notified_at?: string | null
          notes?: string | null
          notify_days_before?: number | null
          notify_repeat?:
            | Database["public"]["Enums"]["doc_notify_repeat"]
            | null
          superseded_at?: string | null
          superseded_by?: string | null
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "company_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "company_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      company_features: {
        Row: {
          approval_workflow: boolean
          attachments: boolean
          audit_log: boolean
          batch_control: boolean
          company_id: string
          created_at: string
          e_signatures: boolean
          finance: boolean
          heat_number: boolean
          id: string
          inventory: boolean
          lot_number: boolean
          multi_branch: boolean
          multi_currency: boolean
          multi_warehouse: boolean
          procurement: boolean
          quality: boolean
          sales: boolean
          traceability: boolean
          updated_at: string
        }
        Insert: {
          approval_workflow?: boolean
          attachments?: boolean
          audit_log?: boolean
          batch_control?: boolean
          company_id: string
          created_at?: string
          e_signatures?: boolean
          finance?: boolean
          heat_number?: boolean
          id?: string
          inventory?: boolean
          lot_number?: boolean
          multi_branch?: boolean
          multi_currency?: boolean
          multi_warehouse?: boolean
          procurement?: boolean
          quality?: boolean
          sales?: boolean
          traceability?: boolean
          updated_at?: string
        }
        Update: {
          approval_workflow?: boolean
          attachments?: boolean
          audit_log?: boolean
          batch_control?: boolean
          company_id?: string
          created_at?: string
          e_signatures?: boolean
          finance?: boolean
          heat_number?: boolean
          id?: string
          inventory?: boolean
          lot_number?: boolean
          multi_branch?: boolean
          multi_currency?: boolean
          multi_warehouse?: boolean
          procurement?: boolean
          quality?: boolean
          sales?: boolean
          traceability?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_numbering: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          doc_type: string
          id: string
          next_seq: number
          padding: number
          prefix: string
          updated_at: string
          year_segment: boolean
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          doc_type: string
          id?: string
          next_seq?: number
          padding?: number
          prefix: string
          updated_at?: string
          year_segment?: boolean
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          next_seq?: number
          padding?: number
          prefix?: string
          updated_at?: string
          year_segment?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_numbering_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_numbering_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_attachments: {
        Row: {
          category: Database["public"]["Enums"]["customer_attachment_category"]
          created_at: string
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          file_name: string
          file_path: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["customer_attachment_category"]
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name: string
          file_path: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["customer_attachment_category"]
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string
          file_path?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_banks: {
        Row: {
          account_name: string | null
          account_name_ar: string | null
          account_name_en: string | null
          account_number: string | null
          bank_name: string
          bank_name_ar: string | null
          bank_name_en: string | null
          branch: string | null
          branch_ar: string | null
          branch_en: string | null
          created_at: string
          currency: string
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          iban: string | null
          id: string
          is_primary: boolean
          notes: string | null
          swift: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_name_ar?: string | null
          account_name_en?: string | null
          account_number?: string | null
          bank_name: string
          bank_name_ar?: string | null
          bank_name_en?: string | null
          branch?: string | null
          branch_ar?: string | null
          branch_en?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          iban?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          swift?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_name_ar?: string | null
          account_name_en?: string | null
          account_number?: string | null
          bank_name?: string
          bank_name_ar?: string | null
          bank_name_en?: string | null
          branch?: string | null
          branch_ar?: string | null
          branch_en?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          iban?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          swift?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_banks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_primary: boolean
          name: string
          name_ar: string | null
          name_en: string | null
          notes: string | null
          phone: string | null
          title: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_primary?: boolean
          name: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          phone?: string | null
          title?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_field_definitions: {
        Row: {
          col_span: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          entity_key: string
          field_type: Database["public"]["Enums"]["customer_field_type"]
          help_text_ar: string | null
          help_text_en: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_active: boolean
          is_required: boolean
          is_system: boolean
          key: string
          label_ar: string
          label_en: string
          placeholder_ar: string | null
          placeholder_en: string | null
          position: number
          row_index: number
          section_ar: string | null
          section_en: string | null
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          col_span?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_key?: string
          field_type: Database["public"]["Enums"]["customer_field_type"]
          help_text_ar?: string | null
          help_text_en?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system?: boolean
          key: string
          label_ar: string
          label_en: string
          placeholder_ar?: string | null
          placeholder_en?: string | null
          position?: number
          row_index?: number
          section_ar?: string | null
          section_en?: string | null
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          col_span?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          entity_key?: string
          field_type?: Database["public"]["Enums"]["customer_field_type"]
          help_text_ar?: string | null
          help_text_en?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          is_system?: boolean
          key?: string
          label_ar?: string
          label_en?: string
          placeholder_ar?: string | null
          placeholder_en?: string | null
          position?: number
          row_index?: number
          section_ar?: string | null
          section_en?: string | null
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: []
      }
      customer_field_options: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          field_id: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_active: boolean
          label_ar: string
          label_en: string
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          field_id: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_active?: boolean
          label_ar: string
          label_en: string
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          field_id?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_active?: boolean
          label_ar?: string
          label_en?: string
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "customer_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_field_values: {
        Row: {
          created_at: string
          customer_id: string
          field_id: string
          id: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          field_id: string
          id?: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_field_values_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "customer_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          address_ar: string | null
          address_en: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          industry: string | null
          industry_ar: string | null
          industry_en: string | null
          name: string
          name_ar: string | null
          name_en: string | null
          notes: string | null
          payment_terms: string | null
          payment_terms_ar: string | null
          payment_terms_en: string | null
          phone: string | null
          tax_id: string | null
          terms: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          address_ar?: string | null
          address_en?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          industry?: string | null
          industry_ar?: string | null
          industry_en?: string | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          payment_terms?: string | null
          payment_terms_ar?: string | null
          payment_terms_en?: string | null
          phone?: string | null
          tax_id?: string | null
          terms?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          address_ar?: string | null
          address_en?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          industry?: string | null
          industry_ar?: string | null
          industry_en?: string | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          notes?: string | null
          payment_terms?: string | null
          payment_terms_ar?: string | null
          payment_terms_en?: string | null
          phone?: string | null
          tax_id?: string | null
          terms?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          color: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          extension: string | null
          hidden_at: string | null
          hidden_by: string | null
          icon: string | null
          id: string
          is_system: boolean
          location: string | null
          management_id: string | null
          manager_id: string | null
          metadata: Json
          name: string
          name_ar: string | null
          name_en: string | null
          parent_id: string | null
          phone: string | null
          position: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          extension?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          location?: string | null
          management_id?: string | null
          manager_id?: string | null
          metadata?: Json
          name: string
          name_ar?: string | null
          name_en?: string | null
          parent_id?: string | null
          phone?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          extension?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          location?: string | null
          management_id?: string | null
          manager_id?: string | null
          metadata?: Json
          name?: string
          name_ar?: string | null
          name_en?: string | null
          parent_id?: string | null
          phone?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_management_id_fkey"
            columns: ["management_id"]
            isOneToOne: false
            referencedRelation: "managements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          employee_id: string
          id: string
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id: string
          id?: string
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          employee_id?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          direct_manager_id: string | null
          email: string | null
          employee_code: string | null
          employment_status: Database["public"]["Enums"]["employment_status"]
          full_name: string
          full_name_ar: string | null
          full_name_en: string | null
          id: string
          joining_date: string | null
          management_id: string | null
          metadata: Json
          national_id: string | null
          notes: string | null
          passport_no: string | null
          phone: string | null
          photo_url: string | null
          position_id: string | null
          signature_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          direct_manager_id?: string | null
          email?: string | null
          employee_code?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          joining_date?: string | null
          management_id?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          passport_no?: string | null
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          signature_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          direct_manager_id?: string | null
          email?: string | null
          employee_code?: string | null
          employment_status?: Database["public"]["Enums"]["employment_status"]
          full_name?: string
          full_name_ar?: string | null
          full_name_en?: string | null
          id?: string
          joining_date?: string | null
          management_id?: string | null
          metadata?: Json
          national_id?: string | null
          notes?: string | null
          passport_no?: string | null
          phone?: string | null
          photo_url?: string | null
          position_id?: string | null
          signature_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_direct_manager_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_management_id_fkey"
            columns: ["management_id"]
            isOneToOne: false
            referencedRelation: "managements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_titles: {
        Row: {
          code: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          description: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_system: boolean
          level: number
          metadata: Json
          name: string
          name_ar: string | null
          name_en: string | null
          position: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          description?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_system?: boolean
          level?: number
          metadata?: Json
          name: string
          name_ar?: string | null
          name_en?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          description?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_system?: boolean
          level?: number
          metadata?: Json
          name?: string
          name_ar?: string | null
          name_en?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_titles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      managements: {
        Row: {
          code: string | null
          color: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          director_id: string | null
          icon: string | null
          id: string
          is_system: boolean
          metadata: Json
          name: string
          name_ar: string | null
          name_en: string | null
          position: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          director_id?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name: string
          name_ar?: string | null
          name_en?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          color?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          director_id?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean
          metadata?: Json
          name?: string
          name_ar?: string | null
          name_en?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "managements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managements_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          browser_push_enabled: boolean
          categories: Json
          created_at: string
          enabled: boolean
          reminder_enabled: boolean
          reminder_interval_minutes: number
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          browser_push_enabled?: boolean
          categories?: Json
          created_at?: string
          enabled?: boolean
          reminder_enabled?: boolean
          reminder_interval_minutes?: number
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          browser_push_enabled?: boolean
          categories?: Json
          created_at?: string
          enabled?: boolean
          reminder_enabled?: boolean
          reminder_interval_minutes?: number
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          link: string | null
          priority: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          link?: string | null
          priority?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      org_field_templates: {
        Row: {
          created_at: string
          entity: string
          field_type: string
          id: string
          is_system: boolean
          key: string
          label_ar: string
          label_en: string | null
          position: number
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity: string
          field_type?: string
          id?: string
          is_system?: boolean
          key: string
          label_ar: string
          label_en?: string | null
          position?: number
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity?: string
          field_type?: string
          id?: string
          is_system?: boolean
          key?: string
          label_ar?: string
          label_en?: string | null
          position?: number
          required?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          full_name: string | null
          id: string
          job_title_id: string | null
          manager_id: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          full_name?: string | null
          id: string
          job_title_id?: string | null
          manager_id?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title_id?: string | null
          manager_id?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_job_title_fk"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_approvals: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          decided_at: string | null
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          quote_id: string
          stage_id: string
          updated_at: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          quote_id: string
          stage_id: string
          updated_at?: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          quote_id?: string
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_approvals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_approvals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_attachments: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          file_name: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          mime_type: string | null
          quote_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          mime_type?: string | null
          quote_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_name?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          mime_type?: string | null
          quote_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_email_log: {
        Row: {
          id: string
          quote_id: string
          recipients: string[]
          sender_id: string
          sent_at: string
          stage_id: string | null
          subject: string | null
        }
        Insert: {
          id?: string
          quote_id: string
          recipients: string[]
          sender_id: string
          sent_at?: string
          stage_id?: string | null
          subject?: string | null
        }
        Update: {
          id?: string
          quote_id?: string
          recipients?: string[]
          sender_id?: string
          sent_at?: string
          stage_id?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_email_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_email_log_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number | null
          approval_state: Database["public"]["Enums"]["quote_approval_state"]
          created_at: string
          currency: string
          current_stage_id: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          expiry_date: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          notes: string | null
          received_date: string
          reference_no: string | null
          status: Database["public"]["Enums"]["quote_status"]
          supplier_name: string
          terms_override: string | null
          updated_at: string
          user_id: string
          workflow_template_id: string | null
        }
        Insert: {
          amount?: number | null
          approval_state?: Database["public"]["Enums"]["quote_approval_state"]
          created_at?: string
          currency?: string
          current_stage_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expiry_date?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          notes?: string | null
          received_date?: string
          reference_no?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_name: string
          terms_override?: string | null
          updated_at?: string
          user_id: string
          workflow_template_id?: string | null
        }
        Update: {
          amount?: number | null
          approval_state?: Database["public"]["Enums"]["quote_approval_state"]
          created_at?: string
          currency?: string
          current_stage_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          expiry_date?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          notes?: string | null
          received_date?: string
          reference_no?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          supplier_name?: string
          terms_override?: string | null
          updated_at?: string
          user_id?: string
          workflow_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          color: string | null
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          name_ar: string | null
          name_en: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          name_ar?: string | null
          name_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      search_embeddings: {
        Row: {
          content: string
          embedding: string
          entity: string
          entity_id: string
          id: string
          link: string
          model: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          embedding: string
          entity: string
          entity_id: string
          id?: string
          link: string
          model?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          embedding?: string
          entity?: string
          entity_id?: string
          id?: string
          link?: string
          model?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          clicked_entity: string | null
          clicked_id: string | null
          clicked_link: string | null
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          clicked_entity?: string | null
          clicked_id?: string | null
          clicked_link?: string | null
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          clicked_entity?: string | null
          clicked_id?: string | null
          clicked_link?: string | null
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          is_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_ui_preferences: {
        Row: {
          accent_color: string | null
          created_at: string
          density: string
          font_family: string
          lang: string
          preset: string
          primary_color: string | null
          radius: string
          sidebar_collapsed: boolean
          theme_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          density?: string
          font_family?: string
          lang?: string
          preset?: string
          primary_color?: string | null
          radius?: string
          sidebar_collapsed?: boolean
          theme_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          density?: string
          font_family?: string
          lang?: string
          preset?: string
          primary_color?: string | null
          radius?: string
          sidebar_collapsed?: boolean
          theme_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          branch_id: string | null
          code: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_main: boolean
          name: string
          name_ar: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name: string
          name_ar?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          name_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stage_approvers: {
        Row: {
          approver_id: string
          created_at: string
          id: string
          position: number
          stage_id: string
        }
        Insert: {
          approver_id: string
          created_at?: string
          id?: string
          position?: number
          stage_id: string
        }
        Update: {
          approver_id?: string
          created_at?: string
          id?: string
          position?: number
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stage_approvers_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_stage_approvers_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "workflow_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_stages: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          name: string
          position: number
          template_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          name: string
          position: number
          template_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          name?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_workflow_stage: {
        Args: { _name?: string; _template_id: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          id: string
          name: string
          position: number
          template_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workflow_stages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_workflow_stage_approvers: {
        Args: { _stage_id: string; _user_id: string }
        Returns: boolean
      }
      current_company_document: {
        Args: { _type_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string | null
          department_ids: string[] | null
          doc_number: string | null
          expiry_date: string | null
          extra: Json
          id: string
          issue_date: string | null
          last_notified_at: string | null
          notes: string | null
          notify_days_before: number | null
          notify_repeat: Database["public"]["Enums"]["doc_notify_repeat"] | null
          superseded_at: string | null
          superseded_by: string | null
          type_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "company_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_profile_locked_fields: {
        Args: never
        Returns: {
          department_id: string
          job_title_id: string
          manager_id: string
          status: Database["public"]["Enums"]["profile_status"]
        }[]
      }
      current_user_status: {
        Args: never
        Returns: Database["public"]["Enums"]["profile_status"]
      }
      find_customer_by_tax_id: {
        Args: { _tax_id: string }
        Returns: {
          id: string
          name: string
          owner_id: string
        }[]
      }
      generate_company_document_notifications: { Args: never; Returns: number }
      global_search: {
        Args: { _limit?: number; _q: string }
        Returns: {
          entity: string
          id: string
          link: string
          rank: number
          subtitle: string
          title: string
        }[]
      }
      has_any_company: { Args: never; Returns: boolean }
      has_any_user: { Args: never; Returns: boolean }
      has_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
      is_owner: { Args: { _uid: string }; Returns: boolean }
      is_template_owner: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      is_workflow_approver: {
        Args: { _template_id: string; _user_id: string }
        Returns: boolean
      }
      is_workflow_stage_approver: {
        Args: { _stage_id: string; _user_id: string }
        Returns: boolean
      }
      match_search_embeddings: {
        Args: { _embedding: string; _limit?: number; _min_similarity?: number }
        Returns: {
          entity: string
          entity_id: string
          link: string
          similarity: number
          subtitle: string
          title: string
        }[]
      }
      user_accessible_branches: {
        Args: { _user_id: string }
        Returns: string[]
      }
      user_default_branch: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_permission:
        | "customers.view"
        | "customers.manage"
        | "quotes.view"
        | "quotes.manage"
        | "quotes.approve"
        | "workflows.view"
        | "workflows.manage"
        | "hr.view"
        | "hr.manage"
        | "team.view"
        | "team.manage"
        | "reports.view"
        | "customers.create"
        | "customers.edit"
        | "customers.delete"
        | "customers.view_payment_info"
        | "quotes.view_own"
        | "quotes.view_team"
        | "quotes.view_all"
        | "quotes.create"
        | "quotes.edit"
        | "quotes.delete"
        | "quotes.assign"
        | "users.manage_roles"
        | "templates.manage"
        | "notifications.view"
        | "manage_customer_fields"
        | "manage_form_fields"
        | "inventory.manage"
        | "inventory.transfer"
      app_role: "owner" | "admin" | "member"
      approval_decision: "pending" | "approved" | "rejected"
      customer_attachment_category:
        | "company_profile"
        | "commercial_register"
        | "tax_card"
        | "bank_letter"
        | "other"
      customer_field_type:
        | "text"
        | "number"
        | "email"
        | "phone"
        | "date"
        | "dropdown"
        | "textarea"
        | "checkbox"
        | "file"
        | "multiselect"
        | "bilingual_text"
      doc_notify_repeat: "none" | "daily" | "weekly" | "monthly"
      employment_status:
        | "active"
        | "on_leave"
        | "suspended"
        | "terminated"
        | "probation"
      profile_status: "pending" | "active" | "suspended"
      quote_approval_state: "none" | "in_progress" | "approved" | "rejected"
      quote_status: "new" | "reviewing" | "accepted" | "rejected" | "expired"
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
    Enums: {
      app_permission: [
        "customers.view",
        "customers.manage",
        "quotes.view",
        "quotes.manage",
        "quotes.approve",
        "workflows.view",
        "workflows.manage",
        "hr.view",
        "hr.manage",
        "team.view",
        "team.manage",
        "reports.view",
        "customers.create",
        "customers.edit",
        "customers.delete",
        "customers.view_payment_info",
        "quotes.view_own",
        "quotes.view_team",
        "quotes.view_all",
        "quotes.create",
        "quotes.edit",
        "quotes.delete",
        "quotes.assign",
        "users.manage_roles",
        "templates.manage",
        "notifications.view",
        "manage_customer_fields",
        "manage_form_fields",
        "inventory.manage",
        "inventory.transfer",
      ],
      app_role: ["owner", "admin", "member"],
      approval_decision: ["pending", "approved", "rejected"],
      customer_attachment_category: [
        "company_profile",
        "commercial_register",
        "tax_card",
        "bank_letter",
        "other",
      ],
      customer_field_type: [
        "text",
        "number",
        "email",
        "phone",
        "date",
        "dropdown",
        "textarea",
        "checkbox",
        "file",
        "multiselect",
        "bilingual_text",
      ],
      doc_notify_repeat: ["none", "daily", "weekly", "monthly"],
      employment_status: [
        "active",
        "on_leave",
        "suspended",
        "terminated",
        "probation",
      ],
      profile_status: ["pending", "active", "suspended"],
      quote_approval_state: ["none", "in_progress", "approved", "rejected"],
      quote_status: ["new", "reviewing", "accepted", "rejected", "expired"],
    },
  },
} as const
