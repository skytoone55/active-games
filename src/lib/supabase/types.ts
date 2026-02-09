/**
 * Types TypeScript générés pour Supabase
 * Basé sur le schéma de la base de données
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BookingType = 'GAME' | 'EVENT'
export type BookingStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
// UserRole est maintenant un string pour supporter les rôles personnalisés
// Les valeurs par défaut sont: 'super_admin', 'branch_admin', 'agent'
export type UserRole = string
export type ContactStatus = 'active' | 'archived'
export type ContactSource = 'admin_agenda' | 'public_booking' | 'website'
export type ClientType = 'individual' | 'company'
export type GameArea = 'ACTIVE' | 'LASER' | 'MIX' | 'CUSTOM'

// Types pour Orders (commandes en ligne)
export type OrderStatus = 'aborted' | 'pending' | 'auto_confirmed' | 'manually_confirmed' | 'cancelled' | 'closed'
export type OrderType = 'GAME' | 'EVENT'
export type PendingReason = 'overbooking' | 'room_unavailable' | 'slot_unavailable' | 'laser_vests_full' | 'other'

// Types pour Activity Logs
export type ActionType =
  | 'booking_created'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'booking_deleted'
  | 'order_created'
  | 'order_updated'
  | 'order_confirmed'
  | 'order_cancelled'
  | 'order_deleted'
  | 'contact_created'
  | 'contact_updated'
  | 'contact_archived'
  | 'contact_deleted'
  | 'contact_synced_icount'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_login'
  | 'user_logout'
  | 'permission_changed'
  | 'settings_updated'
  | 'log_deleted'
  | 'email_sent'

export type TargetType = 'booking' | 'order' | 'contact' | 'user' | 'branch' | 'settings' | 'log' | 'email' | 'call'

// Types pour Calls (appels téléphoniques)
export type CallDirection = 'inbound' | 'outbound'
export type CallStatus = 'completed' | 'missed' | 'busy' | 'failed' | 'no-answer'

// Types pour Permissions
export type ResourceType = 'agenda' | 'orders' | 'clients' | 'users' | 'logs' | 'settings' | 'permissions' | 'calls' | 'messenger'

// Type pour la table roles (rôles dynamiques avec hiérarchie)
export interface Role {
  id: string
  name: string                    // Slug unique: "branch_admin"
  display_name: string            // Nom affiché: "Admin Agence"
  description: string | null
  level: number                   // 1 = plus haute autorité, 10 = plus basse
  color: string                   // Couleur du badge: "#3B82F6"
  icon: string                    // Nom icône Lucide: "Shield"
  is_system: boolean              // true = ne peut pas être modifié/supprimé
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: Role
        Insert: Omit<Role, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Role, 'id' | 'created_at' | 'updated_at' | 'is_system'>>
      }
      branches: {
        Row: {
          id: string
          slug: string
          name: string
          name_en: string | null
          address: string
          phone: string | null
          phone_extension: string | null
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      branch_settings: {
        Row: {
          id: string
          branch_id: string | null
          max_concurrent_players: number
          total_slots: number | null
          max_players_per_slot: number | null
          slot_duration_minutes: number
          game_duration_minutes: number
          event_total_duration_minutes: number
          event_game_duration_minutes: number
          event_buffer_before_minutes: number
          event_buffer_after_minutes: number
          event_min_participants: number
          game_price_per_person: number
          bracelet_price: number
          event_price_15_29: number
          event_price_30_plus: number
          opening_hours: Json
          laser_total_vests: number | null
          laser_spare_vests: number | null
          laser_exclusive_threshold: number | null
          laser_enabled: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['branch_settings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['branch_settings']['Insert']>
      }
      event_rooms: {
        Row: {
          id: string
          branch_id: string | null
          slug: string
          name: string
          name_en: string | null
          capacity: number
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['event_rooms']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['event_rooms']['Insert']>
      }
      laser_rooms: {
        Row: {
          id: string
          branch_id: string | null
          slug: string
          name: string
          name_en: string | null
          capacity: number
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['laser_rooms']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['laser_rooms']['Insert']>
      }
      game_sessions: {
        Row: {
          id: string
          booking_id: string
          game_area: GameArea
          start_datetime: string
          end_datetime: string
          laser_room_id: string | null
          session_order: number
          pause_before_minutes: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['game_sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['game_sessions']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          branch_id_main: string
          first_name: string
          last_name: string | null
          phone: string
          email: string | null
          notes_client: string | null
          alias: string | null
          status: ContactStatus
          source: ContactSource
          client_type: ClientType
          company_name: string | null
          vat_id: string | null
          icount_client_id: number | null
          preferred_locale: 'he' | 'fr' | 'en'
          archived_at: string | null
          archived_reason: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'source' | 'client_type' | 'preferred_locale'> & {
          status?: ContactStatus
          source?: ContactSource
          client_type?: ClientType
          preferred_locale?: 'he' | 'fr' | 'en'
        }
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      booking_contacts: {
        Row: {
          id: string
          booking_id: string
          contact_id: string
          is_primary: boolean
          role: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['booking_contacts']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['booking_contacts']['Insert']>
      }
      bookings: {
        Row: {
          id: string
          branch_id: string | null
          type: BookingType
          status: BookingStatus
          start_datetime: string
          end_datetime: string
          game_start_datetime: string | null
          game_end_datetime: string | null
          participants_count: number
          event_room_id: string | null
          customer_first_name: string
          customer_last_name: string
          customer_phone: string
          customer_email: string | null
          customer_notes_at_booking: string | null
          reference_code: string
          total_price: number | null
          notes: string | null
          color: string | null
          primary_contact_id: string | null
          icount_offer_id: number | null
          icount_offer_url: string | null
          icount_invrec_id: number | null
          created_at: string
          updated_at: string
          cancelled_at: string | null
          cancelled_reason: string | null
        }
        Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'> & {
          status?: BookingStatus
        }
        Update: Partial<Database['public']['Tables']['bookings']['Insert']>
      }
      booking_slots: {
        Row: {
          id: string
          booking_id: string | null
          branch_id: string | null
          slot_start: string
          slot_end: string
          participants_count: number
          slot_type: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['booking_slots']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['booking_slots']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          role: UserRole
          role_id: string | null    // FK vers roles.id (nouveau)
          first_name: string
          last_name: string
          phone: string
          full_name: string | null // Deprecated, gardé pour compatibilité
          avatar_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          role_id?: string | null
          first_name: string
          last_name: string
          phone: string
          full_name?: string | null
          avatar_url?: string | null
          created_by?: string | null
        }
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Insert'], 'id'>>
      }
      user_branches: {
        Row: {
          id: string
          user_id: string
          branch_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_branches']['Insert']>
      }
      orders: {
        Row: {
          id: string
          branch_id: string | null
          order_type: OrderType
          status: OrderStatus
          source: 'admin_agenda' | 'website' | null
          booking_id: string | null
          contact_id: string | null
          request_reference: string
          customer_first_name: string
          customer_last_name: string | null
          customer_phone: string
          customer_email: string | null
          customer_notes: string | null
          requested_date: string
          requested_time: string
          participants_count: number
          game_area: GameArea | null
          number_of_games: number | null
          event_type: string | null
          event_celebrant_age: number | null
          pending_reason: PendingReason | null
          pending_details: string | null
          terms_accepted: boolean
          terms_accepted_at: string | null
          cgv_token: string | null
          cgv_validated_at: string | null
          cgv_reminder_sent_at: string | null
          cgv_reminder_count: number
          processed_at: string | null
          processed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at' | 'status'> & {
          status?: OrderStatus
        }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string | null
          user_role: UserRole
          user_name: string
          action_type: ActionType
          target_type: TargetType | null
          target_id: string | null
          target_name: string | null
          branch_id: string | null
          details: Json
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at' | 'details'> & {
          details?: Json
        }
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>
      }
      role_permissions: {
        Row: {
          id: string
          role: UserRole
          role_id: string | null    // FK vers roles.id (nouveau)
          resource: ResourceType
          can_view: boolean
          can_create: boolean
          can_edit: boolean
          can_delete: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['role_permissions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>
      }
      icount_products: {
        Row: {
          id: string
          branch_id: string | null
          code: string
          name: string
          name_he: string | null
          description: string | null
          unit_price: number
          price_type: 'per_person' | 'flat' | 'per_game'
          category: 'game' | 'room' | 'event_tariff' | 'other'
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['icount_products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['icount_products']['Insert']>
      }
      icount_formulas: {
        Row: {
          id: string
          branch_id: string | null
          code: string
          name: string
          name_he: string | null
          description: string | null
          booking_type: 'EVENT' | 'GAME'
          game_area: 'LASER' | 'ACTIVE' | 'BOTH' | null
          min_participants: number
          max_participants: number
          priority: number
          is_active: boolean
          items: { product_code: string; quantity: number | 'participants' }[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['icount_formulas']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['icount_formulas']['Insert']>
      }
      messenger_settings: {
        Row: {
          id: string
          is_active: boolean
          welcome_delay_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          welcome_delay_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          welcome_delay_seconds?: number
          created_at?: string
          updated_at?: string
        }
      }
      messenger_faq: {
        Row: {
          id: string
          category: string
          question: Json
          answer: Json
          order_index: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category: string
          question: Json
          answer: Json
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category?: string
          question?: Json
          answer?: Json
          order_index?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messenger_validation_formats: {
        Row: {
          id: string
          format_code: string
          format_name: string
          validation_regex: string | null
          error_message: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          format_code: string
          format_name: string
          validation_regex?: string | null
          error_message: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          format_code?: string
          format_name?: string
          validation_regex?: string | null
          error_message?: Json
          created_at?: string
          updated_at?: string
        }
      }
      messenger_modules: {
        Row: {
          id: string
          ref_code: string
          name: string
          module_type: string
          content: Json
          validation_format_code: string | null
          choices: Json | null
          llm_config: Json | null
          category: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ref_code: string
          name: string
          module_type: string
          content: Json
          validation_format_code?: string | null
          choices?: Json | null
          llm_config?: Json | null
          category?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ref_code?: string
          name?: string
          module_type?: string
          content?: Json
          validation_format_code?: string | null
          choices?: Json | null
          llm_config?: Json | null
          category?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messenger_workflows: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      messenger_workflow_steps: {
        Row: {
          id: string
          workflow_id: string
          step_ref: string
          step_name: string
          module_ref: string
          is_entry_point: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          step_ref: string
          step_name: string
          module_ref: string
          is_entry_point?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          step_ref?: string
          step_name?: string
          module_ref?: string
          is_entry_point?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      messenger_workflow_outputs: {
        Row: {
          id: string
          workflow_id: string
          from_step_ref: string
          output_type: string
          output_label: string | null
          destination_type: string
          destination_ref: string | null
          priority: number
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          from_step_ref: string
          output_type: string
          output_label?: string | null
          destination_type: string
          destination_ref?: string | null
          priority?: number
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          from_step_ref?: string
          output_type?: string
          output_label?: string | null
          destination_type?: string
          destination_ref?: string | null
          priority?: number
          created_at?: string
        }
      }
      messenger_conversations: {
        Row: {
          id: string
          session_id: string
          branch_id: string | null
          contact_id: string | null
          current_workflow_id: string
          current_step_ref: string | null
          collected_data: Json
          status: string
          completed_at: string | null
          last_activity_at: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          branch_id?: string | null
          contact_id?: string | null
          current_workflow_id: string
          current_step_ref?: string | null
          collected_data?: Json
          status?: string
          completed_at?: string | null
          last_activity_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          branch_id?: string | null
          contact_id?: string | null
          current_workflow_id?: string
          current_step_ref?: string | null
          collected_data?: Json
          status?: string
          completed_at?: string | null
          last_activity_at?: string
          created_at?: string
        }
      }
      messenger_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          step_ref: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          step_ref?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          step_ref?: string | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      booking_type: BookingType
      booking_status: BookingStatus
    }
  }
}

// Types utilitaires - Row (lecture)
export type Branch = Database['public']['Tables']['branches']['Row']
export type BranchSettings = Database['public']['Tables']['branch_settings']['Row']
export type EventRoom = Database['public']['Tables']['event_rooms']['Row']
export type LaserRoom = Database['public']['Tables']['laser_rooms']['Row']
export type GameSession = Database['public']['Tables']['game_sessions']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type BookingContact = Database['public']['Tables']['booking_contacts']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type BookingSlot = Database['public']['Tables']['booking_slots']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type UserBranch = Database['public']['Tables']['user_branches']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
export type RolePermission = Database['public']['Tables']['role_permissions']['Row']
export type ICountProduct = Database['public']['Tables']['icount_products']['Row']
export type ICountFormula = Database['public']['Tables']['icount_formulas']['Row']

// Types Insert (création)
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type BookingSlotInsert = Database['public']['Tables']['booking_slots']['Insert']
export type BookingContactInsert = Database['public']['Tables']['booking_contacts']['Insert']
export type GameSessionInsert = Database['public']['Tables']['game_sessions']['Insert']
export type ContactInsert = Database['public']['Tables']['contacts']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert']
export type RolePermissionInsert = Database['public']['Tables']['role_permissions']['Insert']
export type ICountProductInsert = Database['public']['Tables']['icount_products']['Insert']
export type ICountFormulaInsert = Database['public']['Tables']['icount_formulas']['Insert']

// Types Update (modification)
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']
export type BookingContactUpdate = Database['public']['Tables']['booking_contacts']['Update']
export type ContactUpdate = Database['public']['Tables']['contacts']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type RolePermissionUpdate = Database['public']['Tables']['role_permissions']['Update']
export type ICountProductUpdate = Database['public']['Tables']['icount_products']['Update']
export type ICountFormulaUpdate = Database['public']['Tables']['icount_formulas']['Update']

// Helper types complexes
export type UserWithBranches = Profile & {
  branches: Branch[]
  creator?: Profile | null
  email?: string // Email récupéré depuis auth.users
}

// Type étendu pour Order avec relations
export interface OrderWithRelations extends Order {
  branch?: Branch | null
  booking?: Booking | null
  contact?: Contact | null
}

// Type étendu pour Booking avec relations contacts
export interface BookingWithContacts extends Booking {
  booking_contacts?: Array<{
    id: string
    contact: Contact
    is_primary: boolean
    role: string | null
  }>
  primaryContact?: Contact | null
  allContacts?: Contact[]
}

// Type pour un utilisateur avec son profil et ses branches
export interface UserWithProfile {
  id: string
  email: string
  profile: Profile | null
  branches: Branch[]
}

// Type étendu pour ActivityLog avec relations
export interface ActivityLogWithRelations extends ActivityLog {
  branch?: Branch | null
}

// Type pour les permissions par ressource (utilisé côté client)
export interface PermissionSet {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

export type PermissionsByResource = Record<ResourceType, PermissionSet>

// Type pour un Profile avec son rôle complet
export interface ProfileWithRole extends Profile {
  roleDetails?: Role | null
}

// Type pour un utilisateur avec profil, rôle et branches
export interface UserWithProfileAndRole extends UserWithProfile {
  roleDetails?: Role | null
}

// Type pour les opérations de rôle avec vérification de hiérarchie
export interface RoleHierarchyCheck {
  userLevel: number
  targetLevel: number
  canManage: boolean
}

// Types pour Email System (Phase 2)
export type EmailStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
export type EmailEntityType = 'booking' | 'order' | 'contact'

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_name: string | null
  template_id: string | null
  template_code: string | null
  subject: string
  body_preview: string | null
  body_html: string | null
  entity_type: EmailEntityType | null
  entity_id: string | null
  branch_id: string | null
  attachments: Json
  status: EmailStatus
  error_message: string | null
  metadata: Json
  sent_at: string | null
  created_at: string
  triggered_by: string | null
}

export interface EmailTemplate {
  id: string
  code: string
  name: string
  description: string | null
  subject_template: string
  body_template: string
  is_active: boolean
  is_system: boolean
  branch_id: string | null
  available_variables: Json
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface EmailSettings {
  id: string
  smtp_user: string | null
  smtp_password: string | null
  smtp_host: string
  smtp_port: number
  from_email: string | null
  from_name: string
  logo_activegames_url: string | null
  logo_lasercity_url: string | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export type EmailLogInsert = Omit<EmailLog, 'id' | 'created_at'>
export type EmailLogUpdate = Partial<EmailLogInsert>
export type EmailTemplateInsert = Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>
export type EmailTemplateUpdate = Partial<EmailTemplateInsert>

// Type étendu pour EmailLog avec relations
export interface EmailLogWithRelations extends EmailLog {
  branch?: Branch | null
  template?: EmailTemplate | null
}

// Types pour les demandes de contact (leads)
export interface ContactRequest {
  id: string
  branch_id: string
  name: string
  email: string | null
  phone: string
  message: string
  is_read: boolean
  read_by: string | null
  read_at: string | null
  contact_id: string | null
  created_at: string
  updated_at: string
}

export type ContactRequestInsert = Omit<ContactRequest, 'id' | 'is_read' | 'read_by' | 'read_at' | 'contact_id' | 'created_at' | 'updated_at'>
export type ContactRequestUpdate = Partial<Pick<ContactRequest, 'is_read' | 'read_by' | 'read_at' | 'contact_id'>>

// Types pour le système de paiement
export type PaymentStatus = 'pending' | 'deposit_paid' | 'fully_paid' | 'card_authorized' | 'refunded' | 'failed'
export type PaymentType = 'full' | 'deposit' | 'balance' | 'refund'
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'check'

export interface Payment {
  id: string
  order_id: string | null
  booking_id: string | null
  contact_id: string | null
  branch_id: string
  amount: number
  currency: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  status: string
  icount_transaction_id: string | null
  icount_confirmation_code: string | null
  icount_document_id: string | null
  icount_document_type: string | null
  icount_doc_url: string | null
  cc_last4: string | null
  cc_type: string | null
  check_number: string | null
  check_bank: string | null
  check_date: string | null
  transfer_reference: string | null
  notes: string | null
  processed_by: string | null
  created_at: string
  updated_at: string
}

export type PaymentInsert = Omit<Payment, 'id' | 'created_at' | 'updated_at'>
export type PaymentUpdate = Partial<PaymentInsert>

// Type étendu pour Payment avec relations
export interface PaymentWithRelations extends Payment {
  order?: Order | null
  booking?: Booking | null
  contact?: Contact | null
  branch?: Branch | null
}

// Type étendu pour Order avec paiements
export interface OrderWithPayments extends OrderWithRelations {
  payments?: Payment[]
}

// ============================================
// Types pour Clara AI
// ============================================

// System Settings
export interface SystemSetting {
  id: string
  key: string
  value: Json
  description: string | null
  created_at: string
  updated_at: string
}

// Clara Settings (valeur de system_settings où key = 'clara')
export interface ClaraSettings {
  enabled: boolean
  provider: 'gemini' | 'openai' | 'anthropic'
  model: string
  max_tokens: number
  temperature: number
  rate_limit_per_minute: number
  rate_limit_per_hour: number
  session_timeout_minutes: number
  max_conversation_messages: number
  public_chat: {
    enabled: boolean
    welcome_message: string
    quick_replies: string[]
  }
  crm_chat: {
    enabled: boolean
    features: ('search' | 'stats' | 'actions')[]
  }
}

// Clara Branch Settings (clara_settings dans branch_settings)
export interface ClaraBranchSettings {
  welcome_message_override?: string
  quick_replies_override?: string[]
  disabled_features?: string[]
}

// Conversations IA (CRM - utilisateurs authentifiés)
export interface AIConversation {
  id: string
  user_id: string
  branch_id: string | null
  title: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Json
  created_at: string
}

// Conversations publiques (visiteurs)
export interface PublicConversation {
  id: string
  session_id: string
  branch_id: string | null
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  ip_address: string | null
  user_agent: string | null
  locale: string
  created_at: string
  updated_at: string
  last_message_at: string | null
  is_converted: boolean
  converted_contact_id: string | null
}

export interface PublicMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata: Json
  created_at: string
}

// Rate Limiting Clara
export interface ClaraRateLimit {
  id: string
  identifier: string
  request_count: number
  window_start: string
  created_at: string
}

// Types Insert
export type AIConversationInsert = Omit<AIConversation, 'id' | 'created_at' | 'updated_at'>
export type AIMessageInsert = Omit<AIMessage, 'id' | 'created_at'>
export type PublicConversationInsert = Omit<PublicConversation, 'id' | 'created_at' | 'updated_at'>
export type PublicMessageInsert = Omit<PublicMessage, 'id' | 'created_at'>

// Types avec relations
export interface AIConversationWithMessages extends AIConversation {
  messages?: AIMessage[]
}

export interface PublicConversationWithMessages extends PublicConversation {
  messages?: PublicMessage[]
  branch?: Branch | null
}

// Interface pour les appels téléphoniques (Telnyx)
export interface Call {
  id: string
  telnyx_call_control_id: string
  telnyx_call_session_id: string | null
  direction: CallDirection
  status: CallStatus
  from_number: string
  to_number: string
  from_number_normalized: string | null
  to_number_normalized: string | null
  started_at: string
  answered_at: string | null
  ended_at: string | null
  duration_seconds: number
  recording_url: string | null
  recording_duration_seconds: number | null
  contact_id: string | null
  contact_linked_at: string | null
  contact_linked_by: string | null
  branch_id: string | null
  notes: string | null
  metadata: Json
  created_at: string
  updated_at: string
}
