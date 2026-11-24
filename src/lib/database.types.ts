export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string;
          email: string;
          display_name: string;
          role: "super_admin" | "admin" | "editor" | "viewer";
          permissions: Json;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string;
          role?: "super_admin" | "admin" | "editor" | "viewer";
          permissions?: Json;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          role?: "super_admin" | "admin" | "editor" | "viewer";
          permissions?: Json;
          is_active?: boolean;
          last_login_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_sequences: {
        Row: {
          sequence_key: string;
          prefix: string;
          current_value: number;
          pad_length: number;
          updated_at: string;
        };
        Insert: {
          sequence_key: string;
          prefix?: string;
          current_value?: number;
          pad_length?: number;
          updated_at?: string;
        };
        Update: {
          prefix?: string;
          current_value?: number;
          pad_length?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          member_number: string;
          normalized_member_number: string;
          registration_number: string;
          full_name: string;
          garage_name: string;
          photo_path: string | null;
          signature_path: string | null;
          address: string;
          residence_address: string;
          date_of_birth: string | null;
          blood_group: string;
          nominee_name: string;
          nominee_age: number | null;
          mobile: string;
          whatsapp_number: string;
          emergency_contact: string;
          status: "active" | "inactive" | "archived";
          registration_date: string | null;
          consent_given: boolean;
          notes: string;
          aadhaar_last4: string;
          pan_last4: string;
          dl_last4: string;
          is_demo: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_number: string;
          registration_number?: string;
          full_name: string;
          garage_name?: string;
          photo_path?: string | null;
          signature_path?: string | null;
          address?: string;
          residence_address?: string;
          date_of_birth?: string | null;
          blood_group?: string;
          nominee_name?: string;
          nominee_age?: number | null;
          mobile?: string;
          whatsapp_number?: string;
          emergency_contact?: string;
          status?: "active" | "inactive" | "archived";
          registration_date?: string | null;
          consent_given?: boolean;
          notes?: string;
          aadhaar_last4?: string;
          pan_last4?: string;
          dl_last4?: string;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_number?: string;
          registration_number?: string;
          full_name?: string;
          garage_name?: string;
          photo_path?: string | null;
          signature_path?: string | null;
          address?: string;
          residence_address?: string;
          date_of_birth?: string | null;
          blood_group?: string;
          nominee_name?: string;
          nominee_age?: number | null;
          mobile?: string;
          whatsapp_number?: string;
          emergency_contact?: string;
          status?: "active" | "inactive" | "archived";
          registration_date?: string | null;
          consent_given?: boolean;
          notes?: string;
          is_demo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      member_documents: {
        Row: {
          id: string;
          member_id: string;
          aadhaar_number: string;
          pan_number: string;
          driving_licence_number: string;
          aadhaar_doc_path: string | null;
          pan_doc_path: string | null;
          dl_doc_path: string | null;
          other_doc_path: string | null;
          other_doc_label: string;
          notes: string;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          aadhaar_number?: string;
          pan_number?: string;
          driving_licence_number?: string;
          aadhaar_doc_path?: string | null;
          pan_doc_path?: string | null;
          dl_doc_path?: string | null;
          other_doc_path?: string | null;
          other_doc_label?: string;
          notes?: string;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          aadhaar_number?: string;
          pan_number?: string;
          driving_licence_number?: string;
          aadhaar_doc_path?: string | null;
          pan_doc_path?: string | null;
          dl_doc_path?: string | null;
          other_doc_path?: string | null;
          other_doc_label?: string;
          notes?: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      committee_roles: {
        Row: {
          id: string;
          role_name: string;
          display_order: number;
          is_multiple_allowed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role_name: string;
          display_order?: number;
          is_multiple_allowed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role_name?: string;
          display_order?: number;
          is_multiple_allowed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      committee_members: {
        Row: {
          id: string;
          member_id: string;
          role_id: string;
          term_start: string | null;
          term_end: string | null;
          public_phone: string;
          show_phone: boolean;
          public_photo_path: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          role_id: string;
          term_start?: string | null;
          term_end?: string | null;
          public_phone?: string;
          show_phone?: boolean;
          public_photo_path?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          role_id?: string;
          term_start?: string | null;
          term_end?: string | null;
          public_phone?: string;
          show_phone?: boolean;
          public_photo_path?: string | null;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          image_path: string;
          title: string;
          caption: string;
          category: "Office" | "Meetings" | "Events" | "Activities" | "Other";
          event_date: string | null;
          uploaded_at: string;
          alt_text: string;
          credit: string;
          is_published: boolean;
          display_order: number;
          is_demo: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_path: string;
          title: string;
          caption?: string;
          category?: "Office" | "Meetings" | "Events" | "Activities" | "Other";
          event_date?: string | null;
          uploaded_at?: string;
          alt_text?: string;
          credit?: string;
          is_published?: boolean;
          display_order?: number;
          is_demo?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          image_path?: string;
          title?: string;
          caption?: string;
          category?: "Office" | "Meetings" | "Events" | "Activities" | "Other";
          event_date?: string | null;
          alt_text?: string;
          credit?: string;
          is_published?: boolean;
          display_order?: number;
          is_demo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          category: "Notice" | "Meeting" | "Event" | "Welfare" | "General";
          published_date: string;
          is_published: boolean;
          is_pinned: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string;
          category?: "Notice" | "Meeting" | "Event" | "Welfare" | "General";
          published_date?: string;
          is_published?: boolean;
          is_pinned?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          category?: "Notice" | "Meeting" | "Event" | "Welfare" | "General";
          published_date?: string;
          is_published?: boolean;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          sender_name: string;
          sender_phone: string;
          sender_email: string;
          subject: string;
          message: string;
          status: "unread" | "read" | "replied" | "archived";
          admin_notes: string;
          replied_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_name: string;
          sender_phone?: string;
          sender_email?: string;
          subject?: string;
          message: string;
          status?: "unread" | "read" | "replied" | "archived";
          admin_notes?: string;
          replied_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "unread" | "read" | "replied" | "archived";
          admin_notes?: string;
          replied_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: string;
          association_name: string;
          short_name: string;
          tagline: string;
          logo_path: string | null;
          location_label: string;
          address: string;
          phone: string;
          whatsapp: string;
          email: string;
          office_hours: string;
          map_url: string;
          facebook_url: string;
          youtube_url: string;
          x_url: string;
          home_intro: string;
          about_intro: string;
          mission: string;
          vision: string;
          history: string;
          activities: string;
          form_code: string;
          required_fields: Json;
          fee_defaults: Json;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          association_name?: string;
          short_name?: string;
          tagline?: string;
          logo_path?: string | null;
          location_label?: string;
          address?: string;
          phone?: string;
          whatsapp?: string;
          email?: string;
          office_hours?: string;
          map_url?: string;
          facebook_url?: string;
          youtube_url?: string;
          x_url?: string;
          home_intro?: string;
          about_intro?: string;
          mission?: string;
          vision?: string;
          history?: string;
          activities?: string;
          form_code?: string;
          required_fields?: Json;
          fee_defaults?: Json;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          association_name?: string;
          short_name?: string;
          tagline?: string;
          logo_path?: string | null;
          location_label?: string;
          address?: string;
          phone?: string;
          whatsapp?: string;
          email?: string;
          office_hours?: string;
          map_url?: string;
          facebook_url?: string;
          youtube_url?: string;
          x_url?: string;
          home_intro?: string;
          about_intro?: string;
          mission?: string;
          vision?: string;
          history?: string;
          activities?: string;
          form_code?: string;
          required_fields?: Json;
          fee_defaults?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          admin_email: string;
          action: string;
          entity_type: string;
          entity_id: string;
          summary: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          admin_email?: string;
          action: string;
          entity_type: string;
          entity_id?: string;
          summary: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      member_fees: {
        Row: {
          id: string;
          member_id: string;
          amount: number;
          fee_type: "Registration" | "Annual" | "Monthly" | "Donation" | "Fine" | "Other";
          payment_mode: "Cash" | "UPI" | "Bank transfer" | "Cheque";
          paid_on: string;
          period: string;
          receipt_number: string;
          notes: string;
          is_demo: boolean;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          amount: number;
          fee_type: "Registration" | "Annual" | "Monthly" | "Donation" | "Fine" | "Other";
          payment_mode: "Cash" | "UPI" | "Bank transfer" | "Cheque";
          paid_on?: string;
          period?: string;
          receipt_number?: string;
          notes?: string;
          is_demo?: boolean;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          amount?: number;
          fee_type?: "Registration" | "Annual" | "Monthly" | "Donation" | "Fine" | "Other";
          payment_mode?: "Cash" | "UPI" | "Bank transfer" | "Cheque";
          paid_on?: string;
          period?: string;
          receipt_number?: string;
          notes?: string;
          is_demo?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_role: {
        Args: { _user_id: string; _role: string };
        Returns: boolean;
      };
      peek_next_member_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      next_member_number: {
        Args: Record<string, never>;
        Returns: string;
      };
      upsert_member_with_documents: {
        Args: { p_member_id: string | null; p_payload: Json };
        Returns: Database["public"]["Tables"]["members"]["Row"];
      };
      bulk_import_members: {
        Args: { p_rows: Json };
        Returns: number;
      };
      delete_member_permanently: {
        Args: { p_member_id: string };
        Returns: Json;
      };
      get_public_committee: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          name: string;
          role_name: string;
          role_order: number;
          display_order: number;
          phone: string | null;
          photo_path: string | null;
        }>;
      };
      submit_contact_message: {
        Args: {
          p_sender_name: string;
          p_sender_phone?: string;
          p_sender_email?: string;
          p_subject?: string;
          p_message?: string;
        };
        Returns: string;
      };
      normalize_member_number: {
        Args: { val: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
