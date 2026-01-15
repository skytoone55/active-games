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
export type UserRole = 'super_admin' | 'branch_admin' | 'agent'
export type ContactStatus = 'active' | 'archived'
export type ContactSource = 'admin_agenda' | 'public_booking'
export type GameArea = 'ACTIVE' | 'LASER'

export interface Database {
  public: {
    Tables: {
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
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          full_name?: string | null
          avatar_url?: string | null
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
    }
    Views: {}
    Functions: {}
    Enums: {
      booking_type: BookingType
      booking_status: BookingStatus
    }
  }
}

// Types utilitaires
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
