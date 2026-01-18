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
export type GameArea = 'ACTIVE' | 'LASER'

// Types pour Orders (commandes en ligne)
export type OrderStatus = 'pending' | 'auto_confirmed' | 'manually_confirmed' | 'cancelled'
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
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_login'
  | 'user_logout'
  | 'permission_changed'
  | 'settings_updated'
  | 'log_deleted'

export type TargetType = 'booking' | 'order' | 'contact' | 'user' | 'branch' | 'settings' | 'log'

// Types pour Permissions
export type ResourceType = 'agenda' | 'orders' | 'clients' | 'users' | 'logs' | 'settings' | 'permissions'

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
          archived_at: string | null
          archived_reason: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'source'> & {
          status?: ContactStatus
          source?: ContactSource
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

// Types Update (modification)
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']
export type BookingContactUpdate = Database['public']['Tables']['booking_contacts']['Update']
export type ContactUpdate = Database['public']['Tables']['contacts']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type RolePermissionUpdate = Database['public']['Tables']['role_permissions']['Update']

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
