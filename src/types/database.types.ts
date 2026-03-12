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
      activity_logs: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          target_request_id: string | null
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          target_request_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          target_request_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_activities: {
        Row: {
          action: Database["public"]["Enums"]["admin_action"]
          admin_id: string | null
          created_at: string | null
          details: string | null
          id: string
          target_id: string | null
          target_table: string
        }
        Insert: {
          action: Database["public"]["Enums"]["admin_action"]
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_table: string
        }
        Update: {
          action?: Database["public"]["Enums"]["admin_action"]
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_activities_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          request_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          request_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          request_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["contact_status"] | null
          subject: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["contact_status"] | null
          subject?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["contact_status"] | null
          subject?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_ar: string | null
          answer_en: string
          answer_fr: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          question_ar: string | null
          question_en: string
          question_fr: string | null
          updated_at: string | null
        }
        Insert: {
          answer_ar?: string | null
          answer_en: string
          answer_fr?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question_ar?: string | null
          question_en: string
          question_fr?: string | null
          updated_at?: string | null
        }
        Update: {
          answer_ar?: string | null
          answer_en?: string
          answer_fr?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question_ar?: string | null
          question_en?: string
          question_fr?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          after_image_url: string | null
          before_image_url: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_fr: string | null
          id: string
          title: string
          title_ar: string | null
          title_fr: string | null
          updated_at: string | null
          visibility: Database["public"]["Enums"]["project_visibility"] | null
        }
        Insert: {
          after_image_url?: string | null
          before_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_fr?: string | null
          id?: string
          title: string
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["project_visibility"] | null
        }
        Update: {
          after_image_url?: string | null
          before_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_fr?: string | null
          id?: string
          title?: string
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["project_visibility"] | null
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          content_ar: string
          content_en: string
          content_fr: string
          created_at: string | null
          id: string
          slug: string
          title_ar: string
          title_en: string
          title_fr: string
          updated_at: string | null
        }
        Insert: {
          content_ar: string
          content_en: string
          content_fr: string
          created_at?: string | null
          id?: string
          slug: string
          title_ar: string
          title_en: string
          title_fr: string
          updated_at?: string | null
        }
        Update: {
          content_ar?: string
          content_en?: string
          content_fr?: string
          created_at?: string | null
          id?: string
          slug?: string
          title_ar?: string
          title_en?: string
          title_fr?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          chat_room_id: string | null
          content: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          is_read: boolean | null
          media_url: string | null
          message_type: Database["public"]["Enums"]["message_type_enum"] | null
          request_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json | null
          chat_room_id?: string | null
          content: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          request_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json | null
          chat_room_id?: string | null
          content?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          is_read?: boolean | null
          media_url?: string | null
          message_type?: Database["public"]["Enums"]["message_type_enum"] | null
          request_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          internal_notes: string | null
          is_active: boolean | null
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          internal_notes?: string | null
          is_active?: boolean | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean | null
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_images: {
        Row: {
          id: string
          image_url: string
          is_cover: boolean | null
          project_id: string | null
          sort_order: number | null
          uploaded_at: string | null
        }
        Insert: {
          id?: string
          image_url: string
          is_cover?: boolean | null
          project_id?: string | null
          sort_order?: number | null
          uploaded_at?: string | null
        }
        Update: {
          id?: string
          image_url?: string
          is_cover?: boolean | null
          project_id?: string | null
          sort_order?: number | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          construction_end_date: string | null
          construction_start_date: string | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_fr: string | null
          height: number | null
          id: string
          location: string | null
          location_ar: string | null
          location_fr: string | null
          main_image_url: string | null
          service_type_id: string | null
          slug: string | null
          space_type: Database["public"]["Enums"]["space_type"] | null
          space_type_id: string | null
          thumbnail_url: string | null
          title: string
          title_ar: string | null
          title_fr: string | null
          updated_at: string | null
          view_count: number
          visibility: Database["public"]["Enums"]["project_visibility"] | null
          width: number | null
        }
        Insert: {
          construction_end_date?: string | null
          construction_start_date?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_fr?: string | null
          height?: number | null
          id?: string
          location?: string | null
          location_ar?: string | null
          location_fr?: string | null
          main_image_url?: string | null
          service_type_id?: string | null
          slug?: string | null
          space_type?: Database["public"]["Enums"]["space_type"] | null
          space_type_id?: string | null
          thumbnail_url?: string | null
          title: string
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string | null
          view_count?: number
          visibility?: Database["public"]["Enums"]["project_visibility"] | null
          width?: number | null
        }
        Update: {
          construction_end_date?: string | null
          construction_start_date?: string | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_fr?: string | null
          height?: number | null
          id?: string
          location?: string | null
          location_ar?: string | null
          location_fr?: string | null
          main_image_url?: string | null
          service_type_id?: string | null
          slug?: string | null
          space_type?: Database["public"]["Enums"]["space_type"] | null
          space_type_id?: string | null
          thumbnail_url?: string | null
          title?: string
          title_ar?: string | null
          title_fr?: string | null
          updated_at?: string | null
          view_count?: number
          visibility?: Database["public"]["Enums"]["project_visibility"] | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_space_type_id_fkey"
            columns: ["space_type_id"]
            isOneToOne: false
            referencedRelation: "space_types"
            referencedColumns: ["id"]
          },
        ]
      }
      request_attachments: {
        Row: {
          file_name: string
          file_type: Database["public"]["Enums"]["file_type_enum"]
          file_url: string
          id: string
          request_id: string | null
          uploaded_at: string | null
        }
        Insert: {
          file_name: string
          file_type: Database["public"]["Enums"]["file_type_enum"]
          file_url: string
          id?: string
          request_id?: string | null
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string
          file_type?: Database["public"]["Enums"]["file_type_enum"]
          file_url?: string
          id?: string
          request_id?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          created_at: string | null
          description: string | null
          duration: number | null
          height: number | null
          id: string
          location: string | null
          request_code: string | null
          service_type_id: string
          space_type: Database["public"]["Enums"]["space_type"] | null
          space_type_id: string | null
          status: Database["public"]["Enums"]["request_status"] | null
          updated_at: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          height?: number | null
          id?: string
          location?: string | null
          request_code?: string | null
          service_type_id: string
          space_type?: Database["public"]["Enums"]["space_type"] | null
          space_type_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          height?: number | null
          id?: string
          location?: string | null
          request_code?: string | null
          service_type_id?: string
          space_type?: Database["public"]["Enums"]["space_type"] | null
          space_type_id?: string | null
          status?: Database["public"]["Enums"]["request_status"] | null
          updated_at?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_space_type_id_fkey"
            columns: ["space_type_id"]
            isOneToOne: false
            referencedRelation: "space_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string
          description: string | null
          display_name_ar: string | null
          display_name_en: string
          display_name_fr: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name_ar?: string | null
          display_name_en: string
          display_name_fr?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name_ar?: string | null
          display_name_en?: string
          display_name_fr?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      space_type_images: {
        Row: {
          id: string
          image_url: string
          sort_order: number
          space_type_id: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          image_url: string
          sort_order?: number
          space_type_id: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          image_url?: string
          sort_order?: number
          space_type_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_type_images_space_type_id_fkey"
            columns: ["space_type_id"]
            isOneToOne: false
            referencedRelation: "space_types"
            referencedColumns: ["id"]
          },
        ]
      }
      space_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_name_ar: string | null
          display_name_en: string
          display_name_fr: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name_ar?: string | null
          display_name_en: string
          display_name_fr?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name_ar?: string | null
          display_name_en?: string
          display_name_fr?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          project_id: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          project_id?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          project_id?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_project_view_count: {
        Args: { project_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      admin_action: "STATUS_CHANGE" | "PROJECT_PUBLISH" | "SETTINGS_UPDATE"
      contact_status: "NEW" | "READ" | "ARCHIVED"
      file_type_enum: "IMAGE" | "PDF" | "DOCUMENT" | "CAD" | "3D_MODEL"
      message_type_enum:
        | "TEXT"
        | "IMAGE"
        | "AUDIO"
        | "SYSTEM"
        | "FILE"
        | "VIDEO"
      project_visibility: "PUBLIC" | "AUTHENTICATED_ONLY" | "HIDDEN"
      request_status:
        | "Submitted"
        | "Under Review"
        | "Waiting for Client Info"
        | "Approved"
        | "In Progress"
        | "Completed"
        | "Rejected"
        | "Cancelled"
      space_type:
        | "HOUSES_AND_ROOMS"
        | "COMMERCIAL_SHOPS"
        | "SCHOOLS_AND_NURSERIES"
        | "OFFICES_RECEPTION"
        | "DORMITORY_LODGINGS"
      user_role: "customer" | "admin" | "super_admin"
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
      admin_action: ["STATUS_CHANGE", "PROJECT_PUBLISH", "SETTINGS_UPDATE"],
      contact_status: ["NEW", "READ", "ARCHIVED"],
      file_type_enum: ["IMAGE", "PDF", "DOCUMENT", "CAD", "3D_MODEL"],
      message_type_enum: ["TEXT", "IMAGE", "AUDIO", "SYSTEM", "FILE", "VIDEO"],
      project_visibility: ["PUBLIC", "AUTHENTICATED_ONLY", "HIDDEN"],
      request_status: [
        "Submitted",
        "Under Review",
        "Waiting for Client Info",
        "Approved",
        "In Progress",
        "Completed",
        "Rejected",
        "Cancelled",
      ],
      space_type: [
        "HOUSES_AND_ROOMS",
        "COMMERCIAL_SHOPS",
        "SCHOOLS_AND_NURSERIES",
        "OFFICES_RECEPTION",
        "DORMITORY_LODGINGS",
      ],
      user_role: ["customer", "admin", "super_admin"],
    },
  },
} as const
