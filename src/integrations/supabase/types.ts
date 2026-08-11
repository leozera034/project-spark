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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_kind: string
          actor_user_id: string | null
          context: Json
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          store_id: string | null
        }
        Insert: {
          action: string
          actor_kind?: string
          actor_user_id?: string | null
          context?: Json
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_user_id?: string | null
          context?: Json
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          image_url: string | null
          is_active: boolean
          is_archived: boolean
          name: string
          parent_id: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_same_store_fk"
            columns: ["parent_id", "store_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "categories_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          sort_order: number
          store_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          sort_order?: number
          store_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_same_store_fk"
            columns: ["combo_id", "store_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "combo_items_product_same_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "combo_items_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_variant_same_store_fk"
            columns: ["variant_id", "store_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      combos: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combos_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_action_intents: {
        Row: {
          action: string
          courier_id: string
          created_at: string
          delivery_id: string | null
          id: string
          idempotency_key: string
          result: Json | null
          store_id: string
        }
        Insert: {
          action: string
          courier_id: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          idempotency_key: string
          result?: Json | null
          store_id: string
        }
        Update: {
          action?: string
          courier_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          idempotency_key?: string
          result?: Json | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_action_intents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_auth_identities: {
        Row: {
          auth_user_id: string
          courier_id: string
          created_at: string
          id: string
          is_login_enabled: boolean
          login_identifier: string
          password_changed_at: string | null
          requires_password_change: boolean
          store_id: string
          synthetic_email: string
          temporary_password_issued_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          courier_id: string
          created_at?: string
          id?: string
          is_login_enabled?: boolean
          login_identifier: string
          password_changed_at?: string | null
          requires_password_change?: boolean
          store_id: string
          synthetic_email: string
          temporary_password_issued_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          courier_id?: string
          created_at?: string
          id?: string
          is_login_enabled?: boolean
          login_identifier?: string
          password_changed_at?: string | null
          requires_password_change?: boolean
          store_id?: string
          synthetic_email?: string
          temporary_password_issued_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_auth_identities_courier_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "courier_auth_identities_courier_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "courier_auth_identities_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_provisioning_intents: {
        Row: {
          courier_id: string | null
          created_at: string
          id: string
          idempotency_key: string
          request_hash: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          id?: string
          idempotency_key: string
          request_hash: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          request_hash?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courier_intents_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "courier_intents_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "courier_provisioning_intents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          can_accept_deliveries: boolean
          created_at: string
          deactivated_at: string | null
          full_name: string
          id: string
          is_online: boolean
          last_seen_at: string | null
          phone: string
          plate: string | null
          status: Database["public"]["Enums"]["courier_status"]
          store_id: string
          updated_at: string
          user_id: string | null
          vehicle: string | null
          version: number
        }
        Insert: {
          can_accept_deliveries?: boolean
          created_at?: string
          deactivated_at?: string | null
          full_name: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          phone: string
          plate?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          store_id: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
          version?: number
        }
        Update: {
          can_accept_deliveries?: boolean
          created_at?: string
          deactivated_at?: string | null
          full_name?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string | null
          phone?: string
          plate?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          store_id?: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "couriers_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_fingerprint: string | null
          complement: string | null
          created_at: string
          customer_id: string
          has_no_number: boolean
          id: string
          is_default: boolean
          label: string | null
          last_used_at: string | null
          latitude: number | null
          longitude: number | null
          neighborhood_id: string | null
          neighborhood_name: string
          number: string | null
          reference: string | null
          store_id: string
          street: string
          updated_at: string
        }
        Insert: {
          address_fingerprint?: string | null
          complement?: string | null
          created_at?: string
          customer_id: string
          has_no_number?: boolean
          id?: string
          is_default?: boolean
          label?: string | null
          last_used_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name: string
          number?: string | null
          reference?: string | null
          store_id: string
          street: string
          updated_at?: string
        }
        Update: {
          address_fingerprint?: string | null
          complement?: string | null
          created_at?: string
          customer_id?: string
          has_no_number?: boolean
          id?: string
          is_default?: boolean
          label?: string | null
          last_used_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood_id?: string | null
          neighborhood_name?: string
          number?: string | null
          reference?: string | null
          store_id?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_same_store_fk"
            columns: ["customer_id", "store_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "customer_addresses_neighborhood_same_store_fk"
            columns: ["neighborhood_id", "store_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "customer_addresses_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_order_at: string | null
          notes: string | null
          orders_count: number
          phone: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id?: string
          last_order_at?: string | null
          notes?: string | null
          orders_count?: number
          phone: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_order_at?: string | null
          notes?: string | null
          orders_count?: number
          phone?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          arrived_at_store_at: string | null
          assigned_at: string | null
          assigned_by_user_id: string | null
          cancelled_at: string | null
          completed_at: string | null
          courier_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          picked_up_at: string | null
          reason_code: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          arrived_at_store_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          reason_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          arrived_at_store_at?: string | null
          assigned_at?: string | null
          assigned_by_user_id?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          reason_code?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_by_user_id_fkey"
            columns: ["assigned_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "deliveries_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "deliveries_order_same_store_fk"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "deliveries_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          actor_user_id: string | null
          courier_id: string | null
          created_at: string
          delivery_id: string
          delivery_version: number | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["delivery_event_type"]
          latitude: number | null
          longitude: number | null
          previous_courier_id: string | null
          reason_code: string | null
          store_id: string
        }
        Insert: {
          actor_user_id?: string | null
          courier_id?: string | null
          created_at?: string
          delivery_id: string
          delivery_version?: number | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["delivery_event_type"]
          latitude?: number | null
          longitude?: number | null
          previous_courier_id?: string | null
          reason_code?: string | null
          store_id: string
        }
        Update: {
          actor_user_id?: string | null
          courier_id?: string | null
          created_at?: string
          delivery_id?: string
          delivery_version?: number | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["delivery_event_type"]
          latitude?: number | null
          longitude?: number | null
          previous_courier_id?: string | null
          reason_code?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "delivery_events_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "delivery_events_delivery_same_store_fk"
            columns: ["delivery_id", "store_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "delivery_events_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_occurrences: {
        Row: {
          code: string
          courier_id: string | null
          created_at: string
          delivery_id: string
          id: string
          note: string | null
          requires_store_attention: boolean
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          store_id: string
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          courier_id?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          note?: string | null
          requires_store_attention?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          store_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          courier_id?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          note?: string | null
          requires_store_attention?: boolean
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          store_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_occurrences_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          courier_id: string | null
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          platform: string
          store_id: string | null
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform?: string
          store_id?: string | null
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform?: string
          store_id?: string | null
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "device_push_tokens_courier_same_store_fk"
            columns: ["courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "device_push_tokens_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          created_at: string
          delivery_fee: number
          eta_minutes: number
          id: string
          is_active: boolean
          is_archived: boolean
          min_order_amount: number | null
          name: string
          notes: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_fee?: number
          eta_minutes?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          min_order_amount?: number | null
          name: string
          notes?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_fee?: number
          eta_minutes?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          min_order_amount?: number | null
          name?: string
          notes?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      option_groups: {
        Row: {
          allow_quantity: boolean
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_archived: boolean
          is_required: boolean
          max_selections: number
          min_selections: number
          name: string
          portion_count: number | null
          price_effect: Database["public"]["Enums"]["option_group_price_effect"]
          pricing_strategy: Database["public"]["Enums"]["option_group_pricing_strategy"]
          selection_type: Database["public"]["Enums"]["option_selection_type"]
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          allow_quantity?: boolean
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          portion_count?: number | null
          price_effect?: Database["public"]["Enums"]["option_group_price_effect"]
          pricing_strategy?: Database["public"]["Enums"]["option_group_pricing_strategy"]
          selection_type?: Database["public"]["Enums"]["option_selection_type"]
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          allow_quantity?: boolean
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          portion_count?: number | null
          price_effect?: Database["public"]["Enums"]["option_group_price_effect"]
          pricing_strategy?: Database["public"]["Enums"]["option_group_pricing_strategy"]
          selection_type?: Database["public"]["Enums"]["option_selection_type"]
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_groups_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      option_items: {
        Row: {
          additional_price: number
          archived_at: string | null
          created_at: string
          description: string | null
          id: string
          is_archived: boolean
          is_available: boolean
          max_quantity: number
          name: string
          option_group_id: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          additional_price?: number
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_available?: boolean
          max_quantity?: number
          name: string
          option_group_id: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          additional_price?: number
          archived_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_archived?: boolean
          is_available?: boolean
          max_quantity?: number
          name?: string
          option_group_id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_items_group_same_store_fk"
            columns: ["option_group_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "option_items_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_options: {
        Row: {
          additional_price: number
          created_at: string
          group_name: string
          id: string
          option_group_id: string | null
          option_item_id: string | null
          option_name: string
          order_item_id: string
          quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          additional_price?: number
          created_at?: string
          group_name: string
          id?: string
          option_group_id?: string | null
          option_item_id?: string | null
          option_name: string
          order_item_id: string
          quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          additional_price?: number
          created_at?: string
          group_name?: string
          id?: string
          option_group_id?: string | null
          option_item_id?: string | null
          option_name?: string
          order_item_id?: string
          quantity?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_group_same_store_fk"
            columns: ["option_group_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_item_options_item_same_store_fk"
            columns: ["order_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_item_options_option_same_store_fk"
            columns: ["option_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_item_options_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          notes: string | null
          options_total: number
          order_id: string
          pricing_unit: Database["public"]["Enums"]["pricing_unit"]
          product_id: string | null
          product_name: string
          quantity: number
          sort_order: number
          store_id: string
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          notes?: string | null
          options_total?: number
          order_id: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
          product_id?: string | null
          product_name: string
          quantity?: number
          sort_order?: number
          store_id: string
          unit_price: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          notes?: string | null
          options_total?: number
          order_id?: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
          product_id?: string | null
          product_name?: string
          quantity?: number
          sort_order?: number
          store_id?: string
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_same_store_fk"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_items_product_same_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_items_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_same_store_fk"
            columns: ["variant_id", "store_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          action: string | null
          actor_courier_id: string | null
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          customer_visible_message: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          internal_note: string | null
          order_id: string
          reason: string | null
          reason_code: string | null
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          action?: string | null
          actor_courier_id?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          customer_visible_message?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_note?: string | null
          order_id: string
          reason?: string | null
          reason_code?: string | null
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          action?: string | null
          actor_courier_id?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          customer_visible_message?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          internal_note?: string | null
          order_id?: string
          reason?: string | null
          reason_code?: string | null
          store_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_courier_same_store_fk"
            columns: ["actor_courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "courier_delivery_counts"
            referencedColumns: ["courier_id", "store_id"]
          },
          {
            foreignKeyName: "order_status_history_courier_same_store_fk"
            columns: ["actor_courier_id", "store_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_status_history_order_same_store_fk"
            columns: ["order_id", "store_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "order_status_history_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transition_reasons: {
        Row: {
          applies_cancel: boolean
          applies_reject: boolean
          code: string
          created_at: string
          internal_label: string
          is_active: boolean
          public_message: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          applies_cancel?: boolean
          applies_reject?: boolean
          code: string
          created_at?: string
          internal_label: string
          is_active?: boolean
          public_message: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          applies_cancel?: boolean
          applies_reject?: boolean
          code?: string
          created_at?: string
          internal_label?: string
          is_active?: boolean
          public_message?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          accepted_at: string | null
          address_id: string | null
          address_snapshot: Json | null
          cancellation_reason: string | null
          change_for: number | null
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          customer_phone_display: string | null
          customer_visible_message: string | null
          delivery_fee: number
          discount_total: number
          eta_minutes: number | null
          finished_at: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          idempotency_key: string | null
          internal_note: string | null
          items_subtotal: number
          minimum_order_amount: number
          neighborhood_id: string | null
          neighborhood_snapshot: string | null
          order_number: number
          payment_instructions: string | null
          payment_method_id: string | null
          payment_method_kind: string | null
          payment_method_label: string | null
          payment_needs_change: boolean
          public_tracking_token: string | null
          ready_at: string | null
          reason_code: string | null
          rejection_reason: string | null
          request_hash: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_amount: number
          tracking_token_hash: string | null
          updated_at: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          address_id?: string | null
          address_snapshot?: Json | null
          cancellation_reason?: string | null
          change_for?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          customer_phone_display?: string | null
          customer_visible_message?: string | null
          delivery_fee?: number
          discount_total?: number
          eta_minutes?: number | null
          finished_at?: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          items_subtotal?: number
          minimum_order_amount?: number
          neighborhood_id?: string | null
          neighborhood_snapshot?: string | null
          order_number: number
          payment_instructions?: string | null
          payment_method_id?: string | null
          payment_method_kind?: string | null
          payment_method_label?: string | null
          payment_needs_change?: boolean
          public_tracking_token?: string | null
          ready_at?: string | null
          reason_code?: string | null
          rejection_reason?: string | null
          request_hash?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_amount?: number
          tracking_token_hash?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          address_id?: string | null
          address_snapshot?: Json | null
          cancellation_reason?: string | null
          change_for?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          customer_phone_display?: string | null
          customer_visible_message?: string | null
          delivery_fee?: number
          discount_total?: number
          eta_minutes?: number | null
          finished_at?: string | null
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          items_subtotal?: number
          minimum_order_amount?: number
          neighborhood_id?: string | null
          neighborhood_snapshot?: string | null
          order_number?: number
          payment_instructions?: string | null
          payment_method_id?: string | null
          payment_method_kind?: string | null
          payment_method_label?: string | null
          payment_needs_change?: boolean
          public_tracking_token?: string | null
          ready_at?: string | null
          reason_code?: string | null
          rejection_reason?: string | null
          request_hash?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          total_amount?: number
          tracking_token_hash?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_same_store_fk"
            columns: ["address_id", "store_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "orders_customer_same_store_fk"
            columns: ["customer_id", "store_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "orders_neighborhood_same_store_fk"
            columns: ["neighborhood_id", "store_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "orders_payment_method_same_store_fk"
            columns: ["payment_method_id", "store_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "orders_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          available_for_delivery: boolean
          available_for_pickup: boolean
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          kind: Database["public"]["Enums"]["payment_method_kind"]
          label: string
          needs_change: boolean
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          available_for_delivery?: boolean
          available_for_pickup?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kind: Database["public"]["Enums"]["payment_method_kind"]
          label: string
          needs_change?: boolean
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          available_for_delivery?: boolean
          available_for_pickup?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          kind?: Database["public"]["Enums"]["payment_method_kind"]
          label?: string
          needs_change?: boolean
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_couriers: number | null
          max_orders_month: number | null
          max_team_members: number | null
          monthly_price: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_couriers?: number | null
          max_orders_month?: number | null
          max_team_members?: number | null
          monthly_price?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_couriers?: number | null
          max_orders_month?: number | null
          max_team_members?: number | null
          monthly_price?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_active: boolean
          is_archived: boolean
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          option_group_id: string
          product_id: string
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          option_group_id: string
          product_id: string
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          option_group_id?: string
          product_id?: string
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_group_same_store_fk"
            columns: ["option_group_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "product_option_groups_product_same_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "product_option_groups_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_option_item_prices: {
        Row: {
          created_at: string
          id: string
          option_item_id: string
          price: number
          product_id: string
          product_variant_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_item_id: string
          price: number
          product_id: string
          product_variant_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          option_item_id?: string
          price?: number
          product_id?: string
          product_variant_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvoip_item_fk"
            columns: ["option_item_id", "store_id"]
            isOneToOne: false
            referencedRelation: "option_items"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "pvoip_product_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "pvoip_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvoip_variant_fk"
            columns: ["product_variant_id", "store_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      product_variants: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_available: boolean
          is_default: boolean
          name: string
          package_quantity: number | null
          package_unit: Database["public"]["Enums"]["measurement_unit"] | null
          price: number
          product_id: string
          sku: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_available?: boolean
          is_default?: boolean
          name: string
          package_quantity?: number | null
          package_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          price: number
          product_id: string
          sku?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_available?: boolean
          is_default?: boolean
          name?: string
          package_quantity?: number | null
          package_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          price?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_same_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "product_variants_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allows_notes: boolean
          archived_at: string | null
          available_from: string | null
          available_to: string | null
          available_weekdays: number[] | null
          base_price: number
          category_id: string
          created_at: string
          description: string | null
          has_variants: boolean
          id: string
          image_path: string | null
          image_url: string | null
          is_archived: boolean
          is_available: boolean
          is_featured: boolean
          is_sold_out: boolean
          max_quantity: number | null
          measurement_unit: Database["public"]["Enums"]["measurement_unit"]
          minimum_quantity: number
          name: string
          pricing_unit: Database["public"]["Enums"]["pricing_unit"]
          quantity_step: number
          sale_mode: Database["public"]["Enums"]["product_sale_mode"]
          sort_order: number
          store_id: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          allows_notes?: boolean
          archived_at?: string | null
          available_from?: string | null
          available_to?: string | null
          available_weekdays?: number[] | null
          base_price?: number
          category_id: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_archived?: boolean
          is_available?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          max_quantity?: number | null
          measurement_unit?: Database["public"]["Enums"]["measurement_unit"]
          minimum_quantity?: number
          name: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
          quantity_step?: number
          sale_mode?: Database["public"]["Enums"]["product_sale_mode"]
          sort_order?: number
          store_id: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          allows_notes?: boolean
          archived_at?: string | null
          available_from?: string | null
          available_to?: string | null
          available_weekdays?: number[] | null
          base_price?: number
          category_id?: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_archived?: boolean
          is_available?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          max_quantity?: number | null
          measurement_unit?: Database["public"]["Enums"]["measurement_unit"]
          minimum_quantity?: number
          name?: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
          quantity_step?: number
          sale_mode?: Database["public"]["Enums"]["product_sale_mode"]
          sort_order?: number
          store_id?: string
          unit_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_same_store_fk"
            columns: ["category_id", "store_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "products_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          category_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["promotion_type"]
          name: string
          product_id: string | null
          starts_at: string | null
          store_id: string
          updated_at: string
          value: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["promotion_type"]
          name: string
          product_id?: string | null
          starts_at?: string | null
          store_id: string
          updated_at?: string
          value: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promotion_type"]
          name?: string
          product_id?: string | null
          starts_at?: string | null
          store_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_category_same_store_fk"
            columns: ["category_id", "store_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "promotions_product_same_store_fk"
            columns: ["product_id", "store_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "store_id"]
          },
          {
            foreignKeyName: "promotions_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_hours: {
        Row: {
          closes_at: string
          created_at: string
          id: string
          is_active: boolean
          opens_at: string
          store_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          id?: string
          is_active?: boolean
          opens_at: string
          store_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          id?: string
          is_active?: boolean
          opens_at?: string
          store_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_realtime_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          event_type: string
          expires_at: string
          id: string
          order_id: string | null
          status_version: number
          store_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type: string
          expires_at?: string
          id?: string
          order_id?: string | null
          status_version?: number
          store_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          expires_at?: string
          id?: string
          order_id?: string | null
          status_version?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_realtime_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_provisioning_intents: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          origin: string
          owner_user_id: string | null
          request_hash: string
          requested_by: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          origin?: string
          owner_user_id?: string | null
          request_hash: string
          requested_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          origin?: string
          owner_user_id?: string | null
          request_hash?: string
          requested_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_provisioning_intents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          auto_open_by_hours: boolean
          brand_accent: string
          brand_primary: string
          closed_message: string | null
          courier_can_accept: boolean
          cover_path: string | null
          cover_url: string | null
          created_at: string
          default_prep_minutes: number
          description: string | null
          logo_path: string | null
          logo_url: string | null
          manual_override_open: boolean | null
          min_order_amount: number
          sound_alert_enabled: boolean
          store_id: string
          theme_tokens: Json
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          auto_open_by_hours?: boolean
          brand_accent?: string
          brand_primary?: string
          closed_message?: string | null
          courier_can_accept?: boolean
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          default_prep_minutes?: number
          description?: string | null
          logo_path?: string | null
          logo_url?: string | null
          manual_override_open?: boolean | null
          min_order_amount?: number
          sound_alert_enabled?: boolean
          store_id: string
          theme_tokens?: Json
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          auto_open_by_hours?: boolean
          brand_accent?: string
          brand_primary?: string
          closed_message?: string | null
          courier_can_accept?: boolean
          cover_path?: string | null
          cover_url?: string | null
          created_at?: string
          default_prep_minutes?: number
          description?: string | null
          logo_path?: string | null
          logo_url?: string | null
          manual_override_open?: boolean | null
          min_order_amount?: number
          sound_alert_enabled?: boolean
          store_id?: string
          theme_tokens?: Json
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_store_fk"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          discount_amount: number
          due_day: number
          grace_days: number
          id: string
          monthly_price: number
          notes: string | null
          plan_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_amount?: number
          due_day?: number
          grace_days?: number
          id?: string
          monthly_price?: number
          notes?: string | null
          plan_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          discount_amount?: number
          due_day?: number
          grace_days?: number
          id?: string
          monthly_price?: number
          notes?: string | null
          plan_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_fk"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_fk"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepts_delivery: boolean
          accepts_pickup: boolean
          address_line: string | null
          city: string
          courier_acceptance_required: boolean
          created_at: string
          document: string | null
          email: string | null
          id: string
          latitude: number | null
          legal_name: string | null
          longitude: number | null
          name: string
          phone: string | null
          segment: string | null
          slug: string
          state: string
          status: Database["public"]["Enums"]["store_status"]
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address_line?: string | null
          city?: string
          courier_acceptance_required?: boolean
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          segment?: string | null
          slug: string
          state?: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address_line?: string | null
          city?: string
          courier_acceptance_required?: boolean
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          latitude?: number | null
          legal_name?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          segment?: string | null
          slug?: string
          state?: string
          status?: Database["public"]["Enums"]["store_status"]
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method_note: string | null
          notes: string | null
          paid_at: string | null
          reference_month: string
          registered_by: string | null
          status: Database["public"]["Enums"]["subscription_payment_status"]
          store_id: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method_note?: string | null
          notes?: string | null
          paid_at?: string | null
          reference_month: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["subscription_payment_status"]
          store_id: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method_note?: string | null
          notes?: string | null
          paid_at?: string | null
          reference_month?: string
          registered_by?: string | null
          status?: Database["public"]["Enums"]["subscription_payment_status"]
          store_id?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_same_store_fk"
            columns: ["subscription_id", "store_id"]
            isOneToOne: false
            referencedRelation: "store_subscriptions"
            referencedColumns: ["id", "store_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      courier_delivery_counts: {
        Row: {
          completed_deliveries: number | null
          courier_id: string | null
          store_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "couriers_store_fk"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_my_delivery_assignment: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
        }
        Returns: Json
      }
      accept_store_order: {
        Args: {
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _store_id: string
        }
        Returns: Json
      }
      activate_store_courier: {
        Args: {
          _courier_id: string
          _expected_version: number
          _store_id: string
        }
        Returns: Json
      }
      admin_reactivate_store: {
        Args: { _store_id: string }
        Returns: undefined
      }
      admin_suspend_store: {
        Args: { _reason: string; _store_id: string }
        Returns: undefined
      }
      archive_catalog_category: {
        Args: {
          _archived: boolean
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      archive_catalog_product: {
        Args: {
          _archived: boolean
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      archive_option_group: {
        Args: {
          _archived: boolean
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      archive_option_item: {
        Args: {
          _archived: boolean
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      archive_product_variant: {
        Args: {
          _archived: boolean
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      archive_store_neighborhood: {
        Args: { _archived: boolean; _id: string; _store_id: string }
        Returns: Json
      }
      assign_delivery_courier: {
        Args: {
          _courier_id: string
          _expected_delivery_version: number
          _internal_note?: string
          _order_id: string
          _store_id: string
        }
        Returns: Json
      }
      attach_option_group_to_product: {
        Args: {
          _option_group_id: string
          _product_id: string
          _store_id: string
        }
        Returns: Json
      }
      authorize_courier_reset: {
        Args: { _actor_user_id: string; _courier_id: string }
        Returns: {
          auth_user_id: string
          identity_id: string
          store_id: string
        }[]
      }
      calculate_product_configuration_preview: {
        Args: {
          _product_id: string
          _quantity?: number
          _selections?: Json
          _store_id: string
          _variant_id?: string
        }
        Returns: Json
      }
      cancel_store_order: {
        Args: {
          _customer_message?: string
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _reason_code: string
          _store_id: string
        }
        Returns: Json
      }
      check_public_store_slug: { Args: { _slug: string }; Returns: Json }
      check_store_slug_availability: {
        Args: { _slug: string; _store_id: string }
        Returns: Json
      }
      clear_store_asset: {
        Args: { _slot: string; _store_id: string }
        Returns: Json
      }
      complete_my_delivery: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
        }
        Returns: Json
      }
      complete_my_initial_password_change: { Args: never; Returns: boolean }
      complete_store_pickup_order: {
        Args: {
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _store_id: string
        }
        Returns: Json
      }
      confirm_my_arrival_at_store: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
        }
        Returns: Json
      }
      confirm_my_order_pickup: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
        }
        Returns: Json
      }
      courier_completed_deliveries_count: {
        Args: { _courier_id: string; _store_id: string }
        Returns: number
      }
      create_catalog_category: {
        Args: {
          _description?: string
          _is_active?: boolean
          _name: string
          _store_id: string
        }
        Returns: Json
      }
      create_option_group: {
        Args: {
          _description?: string
          _is_required?: boolean
          _max_selections?: number
          _min_selections?: number
          _name: string
          _portion_count?: number
          _price_effect?: string
          _pricing_strategy?: string
          _selection_type?: string
          _store_id: string
        }
        Returns: Json
      }
      create_option_item: {
        Args: {
          _additional_price?: number
          _description?: string
          _max_quantity?: number
          _name: string
          _option_group_id: string
          _store_id: string
        }
        Returns: Json
      }
      create_product_variant: {
        Args: {
          _is_default?: boolean
          _name: string
          _package_quantity?: number
          _package_unit?: string
          _price: number
          _product_id: string
          _store_id: string
        }
        Returns: Json
      }
      create_simple_product: {
        Args: {
          _allows_notes?: boolean
          _base_price?: number
          _category_id: string
          _description?: string
          _is_active?: boolean
          _is_featured?: boolean
          _is_sold_out?: boolean
          _name: string
          _store_id: string
        }
        Returns: Json
      }
      deactivate_store_courier: {
        Args: {
          _courier_id: string
          _expected_version: number
          _store_id: string
        }
        Returns: Json
      }
      decline_my_delivery_assignment: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
          _reason_code: string
        }
        Returns: Json
      }
      detach_option_group_from_product: {
        Args: {
          _option_group_id: string
          _product_id: string
          _store_id: string
        }
        Returns: Json
      }
      fail_courier_provisioning_admin: {
        Args: { _idempotency_key: string; _store_id: string }
        Returns: undefined
      }
      fail_store_provisioning: {
        Args: { _idempotency_key: string; _reason: string }
        Returns: undefined
      }
      get_courier_management_counts: {
        Args: { _store_id: string }
        Returns: Json
      }
      get_my_auth_context: { Args: never; Returns: Json }
      get_my_authorization_context: { Args: never; Returns: Json }
      get_my_catalog_overview: { Args: { _store_id?: string }; Returns: Json }
      get_my_catalog_product: {
        Args: { _id: string; _store_id: string }
        Returns: Json
      }
      get_my_courier_operational_context: { Args: never; Returns: Json }
      get_my_delivery_detail: { Args: { _delivery_id: string }; Returns: Json }
      get_my_store_configuration: {
        Args: { _store_id?: string }
        Returns: Json
      }
      get_my_store_courier_detail: {
        Args: { _courier_id: string; _store_id: string }
        Returns: Json
      }
      get_my_store_order_counts: { Args: { _store_id?: string }; Returns: Json }
      get_my_store_order_detail: {
        Args: { _order_id: string; _store_id: string }
        Returns: Json
      }
      get_my_store_order_history: {
        Args: { _order_id: string; _store_id: string }
        Returns: Json
      }
      get_option_group: {
        Args: { _id: string; _store_id: string }
        Returns: Json
      }
      get_platform_billing_summary: { Args: never; Returns: Json }
      get_platform_health_summary: { Args: never; Returns: Json }
      get_platform_recent_errors: { Args: { _limit?: number }; Returns: Json }
      get_product_advanced_builder: {
        Args: { _product_id: string; _store_id: string }
        Returns: Json
      }
      get_store_delivery_assignment: {
        Args: { _order_id: string; _store_id: string }
        Returns: Json
      }
      get_store_operational_preview: {
        Args: { _store_id?: string }
        Returns: Json
      }
      heartbeat_my_courier_presence: { Args: never; Returns: Json }
      list_eligible_couriers_for_delivery: {
        Args: { _order_id: string; _store_id: string }
        Returns: Json
      }
      list_my_catalog_categories: {
        Args: { _include_archived?: boolean; _store_id?: string }
        Returns: Json
      }
      list_my_catalog_products: {
        Args: {
          _category_id?: string
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
          _store_id?: string
        }
        Returns: Json
      }
      list_my_kitchen_orders: { Args: { _store_id?: string }; Returns: Json }
      list_my_store_couriers: {
        Args: {
          _account?: string
          _availability?: string
          _presence?: string
          _store_id: string
        }
        Returns: Json
      }
      list_my_store_orders: {
        Args: {
          _cursor?: string
          _cursor_id?: string
          _delayed_only?: boolean
          _from?: string
          _fulfillment?: string
          _limit?: number
          _search?: string
          _statuses?: string[]
          _store_id?: string
          _to?: string
        }
        Returns: Json
      }
      list_my_stores: {
        Args: never
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      list_option_groups: {
        Args: { _include_archived?: boolean; _store_id?: string }
        Returns: Json
      }
      list_platform_stores: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: Json
      }
      list_product_variants: {
        Args: { _product_id: string; _store_id: string }
        Returns: Json
      }
      list_store_delivery_occurrences: {
        Args: { _order_id: string; _store_id: string }
        Returns: Json
      }
      mark_store_order_ready: {
        Args: {
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _store_id: string
        }
        Returns: Json
      }
      move_product_to_category: {
        Args: {
          _category_id: string
          _expected_updated_at?: string
          _id: string
          _store_id: string
        }
        Returns: Json
      }
      normalize_label: { Args: { _value: string }; Returns: string }
      normalize_store_slug: { Args: { _value: string }; Returns: string }
      provision_store_courier_admin: {
        Args: {
          _actor_user_id: string
          _auth_user_id: string
          _can_accept_deliveries: boolean
          _full_name: string
          _idempotency_key: string
          _is_active: boolean
          _login_identifier: string
          _phone: string
          _request_hash: string
          _store_id: string
          _synthetic_email: string
        }
        Returns: Json
      }
      provision_store_with_owner: {
        Args: {
          _city: string
          _idempotency_key: string
          _origin?: string
          _owner_full_name: string
          _owner_user_id: string
          _phone: string
          _plan_code?: string
          _request_hash: string
          _requested_by?: string
          _segment: string
          _slug: string
          _state: string
          _store_name: string
        }
        Returns: Json
      }
      reassign_delivery_courier: {
        Args: {
          _courier_id: string
          _expected_delivery_version: number
          _internal_note?: string
          _order_id: string
          _reason_code: string
          _store_id: string
        }
        Returns: Json
      }
      reject_store_order: {
        Args: {
          _customer_message?: string
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _reason_code: string
          _store_id: string
        }
        Returns: Json
      }
      reorder_catalog_categories: {
        Args: { _ids: string[]; _store_id: string }
        Returns: Json
      }
      reorder_catalog_products: {
        Args: { _category_id: string; _ids: string[]; _store_id: string }
        Returns: Json
      }
      reorder_option_items: {
        Args: { _ids: string[]; _option_group_id: string; _store_id: string }
        Returns: Json
      }
      reorder_product_option_groups: {
        Args: { _ids: string[]; _product_id: string; _store_id: string }
        Returns: Json
      }
      reorder_product_variants: {
        Args: { _ids: string[]; _product_id: string; _store_id: string }
        Returns: Json
      }
      reorder_store_neighborhoods: {
        Args: { _ids: string[]; _store_id: string }
        Returns: Json
      }
      reorder_store_payment_methods: {
        Args: { _ids: string[]; _store_id: string }
        Returns: Json
      }
      replace_store_hours: {
        Args: { _expected_updated_at?: string; _hours: Json; _store_id: string }
        Returns: Json
      }
      replace_variant_option_prices: {
        Args: { _prices: Json; _product_id: string; _store_id: string }
        Returns: Json
      }
      report_my_delivery_occurrence: {
        Args: {
          _code: string
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
          _note: string
        }
        Returns: Json
      }
      resolve_courier_create_store_admin: {
        Args: { _actor_user_id: string; _store_id: string }
        Returns: string
      }
      resolve_store_delivery_occurrence: {
        Args: {
          _expected_version: number
          _occurrence_id: string
          _resolution_note?: string
          _store_id: string
        }
        Returns: Json
      }
      set_catalog_category_active: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_catalog_category_image: {
        Args: { _id: string; _image_path: string; _store_id: string }
        Returns: Json
      }
      set_default_product_variant: {
        Args: { _expected_updated_at?: string; _id: string; _store_id: string }
        Returns: Json
      }
      set_my_courier_offline: { Args: never; Returns: Json }
      set_my_courier_online: { Args: never; Returns: Json }
      set_option_group_active: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_option_item_active: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_product_active: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_product_featured: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_featured: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_product_image: {
        Args: { _id: string; _image_path: string; _store_id: string }
        Returns: Json
      }
      set_product_sold_out: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_sold_out: boolean
          _store_id: string
        }
        Returns: Json
      }
      set_product_variant_active: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _store_id: string
        }
        Returns: Json
      }
      start_my_delivery: {
        Args: {
          _delivery_id: string
          _expected_version: number
          _idempotency_key: string
        }
        Returns: Json
      }
      start_store_order_preparation: {
        Args: {
          _expected_version: number
          _internal_note?: string
          _order_id: string
          _store_id: string
        }
        Returns: Json
      }
      storefront_catalog: { Args: { _slug: string }; Returns: Json }
      storefront_fulfillment: { Args: { _slug: string }; Returns: Json }
      storefront_normalize_slug: { Args: { _slug: string }; Returns: string }
      storefront_order_tracking: {
        Args: { _known_version?: string; _token_hash: string }
        Returns: Json
      }
      storefront_payment_methods: {
        Args: { _fulfillment_type?: string; _slug: string }
        Returns: Json
      }
      storefront_price: {
        Args: {
          _product_id: string
          _quantity?: number
          _selections?: Json
          _slug: string
          _variant_id?: string
        }
        Returns: Json
      }
      storefront_product: {
        Args: { _product_id: string; _slug: string }
        Returns: Json
      }
      storefront_store: { Args: { _slug: string }; Returns: Json }
      storefront_submit_order: {
        Args: { _payload: Json; _slug: string }
        Returns: Json
      }
      storefront_validate_fulfillment: {
        Args: {
          _configuration_version?: string
          _delivery_area_id?: string
          _fulfillment_type: string
          _slug: string
        }
        Returns: Json
      }
      update_catalog_category: {
        Args: {
          _description: string
          _expected_updated_at?: string
          _id: string
          _is_active: boolean
          _name: string
          _store_id: string
        }
        Returns: Json
      }
      update_option_group: {
        Args: {
          _description?: string
          _expected_updated_at?: string
          _id: string
          _is_required?: boolean
          _max_selections?: number
          _min_selections?: number
          _name: string
          _portion_count?: number
          _price_effect?: string
          _pricing_strategy?: string
          _selection_type?: string
          _store_id: string
        }
        Returns: Json
      }
      update_option_item: {
        Args: {
          _additional_price?: number
          _description?: string
          _expected_updated_at?: string
          _id: string
          _max_quantity?: number
          _name: string
          _store_id: string
        }
        Returns: Json
      }
      update_product_sale_mode: {
        Args: {
          _expected_updated_at?: string
          _measurement_unit?: string
          _minimum_quantity?: number
          _product_id: string
          _quantity_step?: number
          _sale_mode: string
          _store_id: string
        }
        Returns: Json
      }
      update_product_variant: {
        Args: {
          _expected_updated_at?: string
          _id: string
          _name: string
          _package_quantity?: number
          _package_unit?: string
          _price: number
          _store_id: string
        }
        Returns: Json
      }
      update_simple_product: {
        Args: {
          _allows_notes: boolean
          _base_price: number
          _category_id: string
          _description: string
          _expected_updated_at?: string
          _id: string
          _name: string
          _store_id: string
        }
        Returns: Json
      }
      update_store_courier: {
        Args: {
          _can_accept_deliveries: boolean
          _courier_id: string
          _expected_version: number
          _full_name: string
          _phone: string
          _store_id: string
        }
        Returns: Json
      }
      update_store_payment_method: {
        Args: {
          _available_for_delivery: boolean
          _available_for_pickup: boolean
          _id: string
          _instructions: string
          _is_active: boolean
          _label: string
          _needs_change: boolean
          _store_id: string
        }
        Returns: Json
      }
      update_store_profile: {
        Args: {
          _closed_message: string
          _description: string
          _document: string
          _email: string
          _expected_updated_at?: string
          _legal_name: string
          _name: string
          _phone: string
          _store_id: string
          _timezone: string
          _welcome_message: string
          _whatsapp: string
        }
        Returns: Json
      }
      update_store_service_settings: {
        Args: {
          _accepts_delivery: boolean
          _accepts_pickup: boolean
          _auto_open_by_hours: boolean
          _default_prep_minutes: number
          _expected_updated_at?: string
          _min_order_amount: number
          _sound_alert_enabled: boolean
          _store_id: string
        }
        Returns: Json
      }
      update_store_slug: {
        Args: {
          _expected_updated_at?: string
          _slug: string
          _store_id: string
        }
        Returns: Json
      }
      update_store_theme: {
        Args: {
          _brand_accent: string
          _brand_primary: string
          _cover_path?: string
          _expected_updated_at?: string
          _logo_path?: string
          _store_id: string
        }
        Returns: Json
      }
      upsert_store_neighborhood: {
        Args: {
          _delivery_fee: number
          _eta_minutes: number
          _id: string
          _is_active: boolean
          _min_order_amount: number
          _name: string
          _notes: string
          _store_id: string
        }
        Returns: Json
      }
      validate_product_configuration: {
        Args: { _product_id: string; _store_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_permission:
        | "store.view_basic"
        | "store.update_profile"
        | "store.manage_settings"
        | "store.manage_hours"
        | "store.manage_neighborhoods"
        | "store.manage_payment_methods"
        | "catalog.view"
        | "catalog.create"
        | "catalog.update"
        | "catalog.archive"
        | "orders.view_queue"
        | "orders.view_customer_contact"
        | "orders.accept"
        | "orders.reject"
        | "orders.start_preparation"
        | "orders.mark_ready"
        | "orders.cancel"
        | "kitchen.view"
        | "kitchen.start_preparation"
        | "kitchen.mark_ready"
        | "team.view"
        | "team.invite"
        | "team.change_role"
        | "team.disable"
        | "couriers.view"
        | "couriers.create"
        | "couriers.update"
        | "couriers.assign"
        | "couriers.reset_access"
        | "courier.view_self"
        | "courier.view_offered_deliveries"
        | "courier.view_assigned_delivery"
        | "courier.update_delivery_status"
        | "courier.register_incident"
        | "reports.view_operational"
        | "subscription.view"
        | "platform.stores.view"
        | "platform.stores.create"
        | "platform.stores.update"
        | "platform.stores.suspend"
        | "platform.stores.reactivate"
        | "platform.plans.view"
        | "platform.plans.manage"
        | "platform.billing.view"
        | "platform.billing.register_payment"
        | "platform.audit.view"
        | "platform.support.open_context"
        | "orders.complete_pickup"
        | "orders.view_history"
      app_role:
        | "admin_plataforma"
        | "proprietario"
        | "gerente"
        | "atendente"
        | "cozinha"
        | "entregador"
      courier_status: "ativo" | "inativo"
      delivery_event_type:
        | "atribuida"
        | "aceita"
        | "chegada_loja"
        | "coleta"
        | "inicio_entrega"
        | "tentativa_falha"
        | "ocorrencia"
        | "concluida"
        | "cancelada"
      delivery_status:
        | "pendente"
        | "atribuida"
        | "aceita"
        | "coletada"
        | "em_rota"
        | "concluida"
        | "cancelada"
      fulfillment_type: "entrega" | "retirada"
      measurement_unit: "unit" | "kg" | "g" | "l" | "ml"
      option_group_price_effect: "additive" | "replace_base"
      option_group_pricing_strategy: "sum" | "highest_price" | "average_price"
      option_selection_type: "unica" | "multipla" | "quantidade"
      order_status:
        | "aguardando_confirmacao"
        | "aceito"
        | "em_preparo"
        | "pronto"
        | "aguardando_entregador"
        | "saiu_para_entrega"
        | "entregue"
        | "aguardando_retirada"
        | "retirado"
        | "recusado"
        | "cancelado"
      payment_method_kind:
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "vale_refeicao"
        | "outro"
      pricing_unit: "unidade" | "quantidade" | "peso"
      product_sale_mode: "unit" | "measured" | "fixed_package"
      promotion_type: "percentual" | "valor_fixo"
      store_status: "em_implantacao" | "ativa" | "suspensa" | "inativa"
      subscription_payment_status:
        | "pago"
        | "pendente"
        | "cortesia"
        | "estornado"
      subscription_status:
        | "ativa"
        | "inadimplente"
        | "suspensa"
        | "cortesia"
        | "cancelada"
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
        "store.view_basic",
        "store.update_profile",
        "store.manage_settings",
        "store.manage_hours",
        "store.manage_neighborhoods",
        "store.manage_payment_methods",
        "catalog.view",
        "catalog.create",
        "catalog.update",
        "catalog.archive",
        "orders.view_queue",
        "orders.view_customer_contact",
        "orders.accept",
        "orders.reject",
        "orders.start_preparation",
        "orders.mark_ready",
        "orders.cancel",
        "kitchen.view",
        "kitchen.start_preparation",
        "kitchen.mark_ready",
        "team.view",
        "team.invite",
        "team.change_role",
        "team.disable",
        "couriers.view",
        "couriers.create",
        "couriers.update",
        "couriers.assign",
        "couriers.reset_access",
        "courier.view_self",
        "courier.view_offered_deliveries",
        "courier.view_assigned_delivery",
        "courier.update_delivery_status",
        "courier.register_incident",
        "reports.view_operational",
        "subscription.view",
        "platform.stores.view",
        "platform.stores.create",
        "platform.stores.update",
        "platform.stores.suspend",
        "platform.stores.reactivate",
        "platform.plans.view",
        "platform.plans.manage",
        "platform.billing.view",
        "platform.billing.register_payment",
        "platform.audit.view",
        "platform.support.open_context",
        "orders.complete_pickup",
        "orders.view_history",
      ],
      app_role: [
        "admin_plataforma",
        "proprietario",
        "gerente",
        "atendente",
        "cozinha",
        "entregador",
      ],
      courier_status: ["ativo", "inativo"],
      delivery_event_type: [
        "atribuida",
        "aceita",
        "chegada_loja",
        "coleta",
        "inicio_entrega",
        "tentativa_falha",
        "ocorrencia",
        "concluida",
        "cancelada",
      ],
      delivery_status: [
        "pendente",
        "atribuida",
        "aceita",
        "coletada",
        "em_rota",
        "concluida",
        "cancelada",
      ],
      fulfillment_type: ["entrega", "retirada"],
      measurement_unit: ["unit", "kg", "g", "l", "ml"],
      option_group_price_effect: ["additive", "replace_base"],
      option_group_pricing_strategy: ["sum", "highest_price", "average_price"],
      option_selection_type: ["unica", "multipla", "quantidade"],
      order_status: [
        "aguardando_confirmacao",
        "aceito",
        "em_preparo",
        "pronto",
        "aguardando_entregador",
        "saiu_para_entrega",
        "entregue",
        "aguardando_retirada",
        "retirado",
        "recusado",
        "cancelado",
      ],
      payment_method_kind: [
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "pix",
        "vale_refeicao",
        "outro",
      ],
      pricing_unit: ["unidade", "quantidade", "peso"],
      product_sale_mode: ["unit", "measured", "fixed_package"],
      promotion_type: ["percentual", "valor_fixo"],
      store_status: ["em_implantacao", "ativa", "suspensa", "inativa"],
      subscription_payment_status: [
        "pago",
        "pendente",
        "cortesia",
        "estornado",
      ],
      subscription_status: [
        "ativa",
        "inadimplente",
        "suspensa",
        "cortesia",
        "cancelada",
      ],
    },
  },
} as const
