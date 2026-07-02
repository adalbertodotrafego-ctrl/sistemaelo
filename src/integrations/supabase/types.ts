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
      agency_settings: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          budget: number | null
          channel: Database["public"]["Enums"]["campaign_channel"]
          client_id: string | null
          cpa: number | null
          cpc: number | null
          created_at: string
          ctr: number | null
          end_date: string | null
          id: string
          invested: number | null
          leads: number | null
          name: string
          notes: string | null
          objective: string | null
          owner_id: string | null
          roas: number | null
          roi: number | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          channel?: Database["public"]["Enums"]["campaign_channel"]
          client_id?: string | null
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          end_date?: string | null
          id?: string
          invested?: number | null
          leads?: number | null
          name: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          roas?: number | null
          roi?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          channel?: Database["public"]["Enums"]["campaign_channel"]
          client_id?: string | null
          cpa?: number | null
          cpc?: number | null
          created_at?: string
          ctr?: number | null
          end_date?: string | null
          id?: string
          invested?: number | null
          leads?: number | null
          name?: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          roas?: number | null
          roi?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          entry_date: string | null
          id: string
          instagram: string | null
          monthly_value: number | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          plan: string | null
          segment: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          entry_date?: string | null
          id?: string
          instagram?: string | null
          monthly_value?: number | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          plan?: string | null
          segment?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          entry_date?: string | null
          id?: string
          instagram?: string | null
          monthly_value?: number | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          plan?: string | null
          segment?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          client_id: string | null
          created_at: string
          file_path: string | null
          id: string
          notes: string | null
          renewal_at: string | null
          signed_at: string | null
          status: string | null
          title: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          renewal_at?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          renewal_at?: string | null
          signed_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          company: string | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          position: number
          source: string | null
          stage: Database["public"]["Enums"]["crm_stage"]
          updated_at: string
          value_expected: number | null
        }
        Insert: {
          company?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string
          value_expected?: number | null
        }
        Update: {
          company?: string | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string
          value_expected?: number | null
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          user_id: string
        }
        Insert: {
          event_id: string
          user_id: string
        }
        Update: {
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          end_at: string | null
          external_id: string | null
          external_source: string | null
          id: string
          location: string | null
          meet_link: string | null
          notes: string | null
          project_id: string | null
          start_at: string
          title: string
          type: Database["public"]["Enums"]["event_type"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          location?: string | null
          meet_link?: string | null
          notes?: string | null
          project_id?: string | null
          start_at: string
          title: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          location?: string | null
          meet_link?: string | null
          notes?: string | null
          project_id?: string | null
          start_at?: string
          title?: string
          type?: Database["public"]["Enums"]["event_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          client_id: string | null
          created_at: string
          folder_id: string | null
          id: string
          mime: string | null
          name: string
          owner_id: string | null
          path: string
          size: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          mime?: string | null
          name: string
          owner_id?: string | null
          path: string
          size?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          folder_id?: string | null
          id?: string
          mime?: string | null
          name?: string
          owner_id?: string | null
          path?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["finance_kind"]
          paid_at: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kind: Database["public"]["Enums"]["finance_kind"]
          paid_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["finance_kind"]
          paid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          metric: string | null
          owner_id: string | null
          period_end: string | null
          period_start: string | null
          progress: number
          scope: string
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_start?: string | null
          progress?: number
          scope?: string
          target?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string | null
          owner_id?: string | null
          period_end?: string | null
          period_start?: string | null
          progress?: number
          scope?: string
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_roles: {
        Row: {
          allowed_pages: string[]
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          allowed_pages?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          allowed_pages?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          agenda: string | null
          client_id: string | null
          created_at: string
          event_id: string | null
          id: string
          status: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          status?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          client_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          status?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          job_role_id: string | null
          phone: string | null
          role_title: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          job_role_id?: string | null
          phone?: string | null
          role_title?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          job_role_id?: string | null
          phone?: string | null
          role_title?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string | null
          client_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          name: string
          owner_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          progress: number
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          assets: string[] | null
          caption: string | null
          client_id: string | null
          created_at: string
          format: Database["public"]["Enums"]["social_format"]
          id: string
          owner_id: string | null
          scheduled_at: string | null
          status: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          assets?: string[] | null
          caption?: string | null
          client_id?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["social_format"]
          id?: string
          owner_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          assets?: string[] | null
          caption?: string | null
          client_id?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["social_format"]
          id?: string
          owner_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          position: number
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      week_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          day_of_week: number
          description: string | null
          end_time: string | null
          id: string
          start_time: string | null
          tag_id: string | null
          title: string
          updated_at: string
          week_start: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week: number
          description?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          tag_id?: string | null
          title: string
          updated_at?: string
          week_start: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          description?: string | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          tag_id?: string | null
          title?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_items_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "schedule_tags"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "member"
      campaign_channel: "meta" | "google" | "tiktok" | "linkedin" | "other"
      client_status: "active" | "paused" | "churned" | "prospect"
      crm_stage:
        | "lead"
        | "contact"
        | "meeting"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      event_type: "meeting" | "delivery" | "campaign" | "reminder" | "event"
      finance_kind: "income" | "expense"
      notification_kind:
        | "info"
        | "warning"
        | "success"
        | "task"
        | "meeting"
        | "mention"
      priority_level: "low" | "medium" | "high" | "urgent"
      project_status:
        | "planning"
        | "in_progress"
        | "review"
        | "done"
        | "on_hold"
        | "canceled"
      social_format: "post" | "story" | "reel" | "carousel" | "video"
      task_status: "todo" | "in_progress" | "review" | "done" | "canceled"
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
      app_role: ["admin", "manager", "member"],
      campaign_channel: ["meta", "google", "tiktok", "linkedin", "other"],
      client_status: ["active", "paused", "churned", "prospect"],
      crm_stage: [
        "lead",
        "contact",
        "meeting",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      event_type: ["meeting", "delivery", "campaign", "reminder", "event"],
      finance_kind: ["income", "expense"],
      notification_kind: [
        "info",
        "warning",
        "success",
        "task",
        "meeting",
        "mention",
      ],
      priority_level: ["low", "medium", "high", "urgent"],
      project_status: [
        "planning",
        "in_progress",
        "review",
        "done",
        "on_hold",
        "canceled",
      ],
      social_format: ["post", "story", "reel", "carousel", "video"],
      task_status: ["todo", "in_progress", "review", "done", "canceled"],
    },
  },
} as const
