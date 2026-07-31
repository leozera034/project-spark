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
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
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
          parent_id?: string | null
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
      couriers: {
        Row: {
          completed_deliveries_count: number
          created_at: string
          full_name: string
          id: string
          is_online: boolean
          phone: string
          plate: string | null
          status: Database["public"]["Enums"]["courier_status"]
          store_id: string
          updated_at: string
          user_id: string | null
          vehicle: string | null
        }
        Insert: {
          completed_deliveries_count?: number
          created_at?: string
          full_name: string
          id?: string
          is_online?: boolean
          phone: string
          plate?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          store_id: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
        }
        Update: {
          completed_deliveries_count?: number
          created_at?: string
          full_name?: string
          id?: string
          is_online?: boolean
          phone?: string
          plate?: string | null
          status?: Database["public"]["Enums"]["courier_status"]
          store_id?: string
          updated_at?: string
          user_id?: string | null
          vehicle?: string | null
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
          complement: string | null
          created_at: string
          customer_id: string
          has_no_number: boolean
          id: string
          is_default: boolean
          label: string | null
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
          complement?: string | null
          created_at?: string
          customer_id: string
          has_no_number?: boolean
          id?: string
          is_default?: boolean
          label?: string | null
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
          complement?: string | null
          created_at?: string
          customer_id?: string
          has_no_number?: boolean
          id?: string
          is_default?: boolean
          label?: string | null
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
          assigned_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          courier_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          picked_up_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          courier_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
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
          courier_id: string | null
          created_at: string
          delivery_id: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["delivery_event_type"]
          latitude: number | null
          longitude: number | null
          store_id: string
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          delivery_id: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["delivery_event_type"]
          latitude?: number | null
          longitude?: number | null
          store_id: string
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          delivery_id?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["delivery_event_type"]
          latitude?: number | null
          longitude?: number | null
          store_id?: string
        }
        Relationships: [
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
          min_order_amount: number
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
          min_order_amount?: number
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
          min_order_amount?: number
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
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          max_selections: number
          min_selections: number
          name: string
          selection_type: Database["public"]["Enums"]["option_selection_type"]
          store_id: string
          updated_at: string
        }
        Insert: {
          allow_quantity?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          selection_type?: Database["public"]["Enums"]["option_selection_type"]
          store_id: string
          updated_at?: string
        }
        Update: {
          allow_quantity?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          selection_type?: Database["public"]["Enums"]["option_selection_type"]
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
          created_at: string
          description: string | null
          id: string
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
          created_at?: string
          description?: string | null
          id?: string
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
          created_at?: string
          description?: string | null
          id?: string
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
          actor_courier_id: string | null
          actor_kind: string
          actor_user_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          reason: string | null
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_courier_id?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          reason?: string | null
          store_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_courier_id?: string | null
          actor_kind?: string
          actor_user_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          reason?: string | null
          store_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
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
          delivery_fee: number
          discount_total: number
          eta_minutes: number | null
          finished_at: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          idempotency_key: string | null
          items_subtotal: number
          neighborhood_id: string | null
          neighborhood_snapshot: string | null
          order_number: number
          payment_method_id: string | null
          payment_method_label: string | null
          public_tracking_token: string
          ready_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_amount: number
          updated_at: string
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
          delivery_fee?: number
          discount_total?: number
          eta_minutes?: number | null
          finished_at?: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          idempotency_key?: string | null
          items_subtotal?: number
          neighborhood_id?: string | null
          neighborhood_snapshot?: string | null
          order_number: number
          payment_method_id?: string | null
          payment_method_label?: string | null
          public_tracking_token?: string
          ready_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          total_amount?: number
          updated_at?: string
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
          delivery_fee?: number
          discount_total?: number
          eta_minutes?: number | null
          finished_at?: string | null
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          idempotency_key?: string | null
          items_subtotal?: number
          neighborhood_id?: string | null
          neighborhood_snapshot?: string | null
          order_number?: number
          payment_method_id?: string | null
          payment_method_label?: string | null
          public_tracking_token?: string
          ready_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          total_amount?: number
          updated_at?: string
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
          created_at: string
          id: string
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
          created_at?: string
          id?: string
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
          created_at?: string
          id?: string
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
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_available: boolean
          is_default: boolean
          name: string
          price: number
          product_id: string
          sku: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_available?: boolean
          is_default?: boolean
          name: string
          price: number
          product_id: string
          sku?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_available?: boolean
          is_default?: boolean
          name?: string
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
          available_from: string | null
          available_to: string | null
          available_weekdays: number[] | null
          base_price: number
          category_id: string
          created_at: string
          description: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          is_sold_out: boolean
          max_quantity: number | null
          name: string
          pricing_unit: Database["public"]["Enums"]["pricing_unit"]
          sort_order: number
          store_id: string
          unit_label: string | null
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          available_weekdays?: number[] | null
          base_price?: number
          category_id: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          max_quantity?: number | null
          name: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
          sort_order?: number
          store_id: string
          unit_label?: string | null
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          available_weekdays?: number[] | null
          base_price?: number
          category_id?: string
          created_at?: string
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          is_sold_out?: boolean
          max_quantity?: number | null
          name?: string
          pricing_unit?: Database["public"]["Enums"]["pricing_unit"]
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
      store_settings: {
        Row: {
          auto_open_by_hours: boolean
          brand_accent: string
          brand_primary: string
          closed_message: string | null
          courier_can_accept: boolean
          cover_url: string | null
          created_at: string
          default_prep_minutes: number
          description: string | null
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
          cover_url?: string | null
          created_at?: string
          default_prep_minutes?: number
          description?: string | null
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
          cover_url?: string | null
          created_at?: string
          default_prep_minutes?: number
          description?: string | null
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
      option_selection_type: "unica" | "multipla"
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
      option_selection_type: ["unica", "multipla"],
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
