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
