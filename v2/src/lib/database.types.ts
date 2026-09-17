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
      auditoria: {
        Row: {
          antes: Json | null
          despues: Json | null
          en: string
          id: number
          operacion: string
          registro: string | null
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          antes?: Json | null
          despues?: Json | null
          en?: string
          id?: never
          operacion: string
          registro?: string | null
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          antes?: Json | null
          despues?: Json | null
          en?: string
          id?: never
          operacion?: string
          registro?: string | null
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      configuracion: {
        Row: {
          clave: string
          valor: Json
        }
        Insert: {
          clave: string
          valor: Json
        }
        Update: {
          clave?: string
          valor?: Json
        }
        Relationships: []
      }
      correo_destinatarios: {
        Row: {
          activo: boolean
          cierre: boolean
          creado_en: string
          diario: boolean
          email: string
          id: string
          mensual: boolean
          nombre: string | null
          semanal: boolean
          usuario_id: string | null
        }
        Insert: {
          activo?: boolean
          cierre?: boolean
          creado_en?: string
          diario?: boolean
          email: string
          id?: string
          mensual?: boolean
          nombre?: string | null
          semanal?: boolean
          usuario_id?: string | null
        }
        Update: {
          activo?: boolean
          cierre?: boolean
          creado_en?: string
          diario?: boolean
          email?: string
          id?: string
          mensual?: boolean
          nombre?: string | null
          semanal?: boolean
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correo_destinatarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      correos_enviados: {
        Row: {
          enviado_en: string
          periodo: string
          tipo: string
        }
        Insert: {
          enviado_en?: string
          periodo: string
          tipo: string
        }
        Update: {
          enviado_en?: string
          periodo?: string
          tipo?: string
        }
        Relationships: []
      }
      jornadas: {
        Row: {
          cerrado: boolean
          cerrado_en: string | null
          cerrado_por: string | null
          creado_en: string
          es_turno_unico: boolean
          fecha: string
          id: string
          motivo_cierre: string | null
        }
        Insert: {
          cerrado?: boolean
          cerrado_en?: string | null
          cerrado_por?: string | null
          creado_en?: string
          es_turno_unico?: boolean
          fecha: string
          id?: string
          motivo_cierre?: string | null
        }
        Update: {
          cerrado?: boolean
          cerrado_en?: string | null
          cerrado_por?: string | null
          creado_en?: string
          es_turno_unico?: boolean
          fecha?: string
          id?: string
          motivo_cierre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_error: {
        Row: {
          contexto: string | null
          created_at: string
          detalle: Json | null
          id: string
          mensaje: string
          ruta: string | null
          usuario_id: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          detalle?: Json | null
          id?: string
          mensaje: string
          ruta?: string | null
          usuario_id?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          detalle?: Json | null
          id?: string
          mensaje?: string
          ruta?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_error_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      metodos_pago: {
        Row: {
          activo: boolean
          acumulado_diario: boolean
          color: string
          key: string
          label: string
          logo: string | null
          orden: number
          sub: string | null
        }
        Insert: {
          activo?: boolean
          acumulado_diario?: boolean
          color: string
          key: string
          label: string
          logo?: string | null
          orden?: number
          sub?: string | null
        }
        Update: {
          activo?: boolean
          acumulado_diario?: boolean
          color?: string
          key?: string
          label?: string
          logo?: string | null
          orden?: number
          sub?: string | null
        }
        Relationships: []
      }
      proveedores_frecuentes: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          imagen_url: string | null
          nombre: string
          nombre_norm: string | null
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          imagen_url?: string | null
          nombre: string
          nombre_norm?: string | null
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          imagen_url?: string | null
          nombre?: string
          nombre_norm?: string | null
        }
        Relationships: []
      }
      proveedores_turno: {
        Row: {
          creado_en: string
          forma_pago: string
          id: string
          monto: number
          nombre: string
          proveedor_id: string | null
          turno_id: string
          updated_at: string
        }
        Insert: {
          creado_en?: string
          forma_pago: string
          id?: string
          monto: number
          nombre: string
          proveedor_id?: string | null
          turno_id: string
          updated_at?: string
        }
        Update: {
          creado_en?: string
          forma_pago?: string
          id?: string
          monto?: number
          nombre?: string
          proveedor_id?: string | null
          turno_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_turno_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores_frecuentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_turno_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_turno_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "v_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      trabajadores: {
        Row: {
          activo: boolean
          creado_en: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          creado_en?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      turno_cierres: {
        Row: {
          cerrado_en: string
          cerrado_por: string
          cierre_anterior_id: string | null
          diferencia_efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          es_correccion: boolean
          id: string
          proveedores_snapshot: Json
          total_proveedores: number
          total_ventas: number
          turno_id: string
          ventas_snapshot: Json
        }
        Insert: {
          cerrado_en?: string
          cerrado_por: string
          cierre_anterior_id?: string | null
          diferencia_efectivo?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          es_correccion?: boolean
          id?: string
          proveedores_snapshot: Json
          total_proveedores: number
          total_ventas: number
          turno_id: string
          ventas_snapshot: Json
        }
        Update: {
          cerrado_en?: string
          cerrado_por?: string
          cierre_anterior_id?: string | null
          diferencia_efectivo?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          es_correccion?: boolean
          id?: string
          proveedores_snapshot?: Json
          total_proveedores?: number
          total_ventas?: number
          turno_id?: string
          ventas_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "turno_cierres_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_cierres_cierre_anterior_id_fkey"
            columns: ["cierre_anterior_id"]
            isOneToOne: false
            referencedRelation: "turno_cierres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_cierres_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turno_cierres_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "v_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      turnos: {
        Row: {
          creado_en: string
          deleted_at: string | null
          fondo_inicial: number
          id: string
          is_draft: boolean
          jornada_id: string
          tipo: string
          trabajador_id: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          deleted_at?: string | null
          fondo_inicial?: number
          id?: string
          is_draft?: boolean
          jornada_id: string
          tipo: string
          trabajador_id?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          deleted_at?: string | null
          fondo_inicial?: number
          id?: string
          is_draft?: boolean
          jornada_id?: string
          tipo?: string
          trabajador_id?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turnos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "v_resumen_dia"
            referencedColumns: ["jornada_id"]
          },
          {
            foreignKeyName: "turnos_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          creado_en: string
          email: string
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          creado_en?: string
          email: string
          id: string
          nombre: string
          rol: string
        }
        Update: {
          activo?: boolean
          creado_en?: string
          email?: string
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
      ventas_turno: {
        Row: {
          amipass: number
          creado_en: string
          edenred: number
          efectivo: number
          getnet: number
          id: string
          mercadopago: number
          transferencia: number
          turno_id: string
          updated_at: string
        }
        Insert: {
          amipass?: number
          creado_en?: string
          edenred?: number
          efectivo?: number
          getnet?: number
          id?: string
          mercadopago?: number
          transferencia?: number
          turno_id: string
          updated_at?: string
        }
        Update: {
          amipass?: number
          creado_en?: string
          edenred?: number
          efectivo?: number
          getnet?: number
          id?: string
          mercadopago?: number
          transferencia?: number
          turno_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_turno_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: true
            referencedRelation: "turnos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_turno_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: true
            referencedRelation: "v_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_resumen_dia: {
        Row: {
          amipass: number | null
          cerrado: boolean | null
          cerrado_en: string | null
          cerrado_por: string | null
          con_conteo: boolean | null
          con_descuadre: boolean | null
          corregido: boolean | null
          dia_unico_config: boolean | null
          edenred: number | null
          efectivo: number | null
          efectivo_esperado: number | null
          efectivo_neto: number | null
          es_dia_unico: boolean | null
          es_turno_unico: boolean | null
          estado: string | null
          fecha: string | null
          getnet: number | null
          jornada_id: string | null
          mercadopago: number | null
          motivo_cierre: string | null
          neto: number | null
          prov_efectivo: number | null
          prov_transferencia: number | null
          tiene_borrador: boolean | null
          tiene_manana: boolean | null
          tiene_tarde: boolean | null
          total_proveedores: number | null
          total_ventas: number | null
          transferencia: number | null
          turnos: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_cerrado_por_fkey"
            columns: ["cerrado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      v_turnos: {
        Row: {
          amipass: number | null
          cantidad_cierres: number | null
          corregido: boolean | null
          creado_en: string | null
          diferencia_efectivo: number | null
          edenred: number | null
          efectivo: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          efectivo_neto: number | null
          es_turno_unico: boolean | null
          fecha: string | null
          fondo_inicial: number | null
          getnet: number | null
          id: string | null
          is_draft: boolean | null
          jornada_id: string | null
          mercadopago: number | null
          modo: string | null
          neto: number | null
          prov_efectivo: number | null
          prov_transferencia: number | null
          tipo: string | null
          total_proveedores: number | null
          total_ventas: number | null
          trabajador_id: string | null
          trabajador_nombre: string | null
          transferencia: number | null
          ultimo_cierre_en: string | null
          updated_at: string | null
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "v_resumen_dia"
            referencedColumns: ["jornada_id"]
          },
          {
            foreignKeyName: "turnos_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "trabajadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _snapshot_turno: {
        Args: { p_turno_id: string }
        Returns: {
          proveedores_snapshot: Json
          ventas_snapshot: Json
        }[]
      }
      cerrar_turno: {
        Args: { p_efectivo_contado?: number; p_turno_id: string }
        Returns: string
      }
      corregir_turno: {
        Args: { p_efectivo_contado?: number; p_turno_id: string }
        Returns: string
      }
      enviar_correo_prueba: { Args: { p_tipo: string }; Returns: undefined }
      enviar_resumen_periodico: { Args: { p_tipo: string }; Returns: undefined }
      es_dueno: { Args: never; Returns: boolean }
      fusionar_proveedores: {
        Args: { p_destino: string; p_origen: string }
        Returns: undefined
      }
      get_my_rol: { Args: never; Returns: string }
      guardar_turno: { Args: { p: Json }; Returns: Json }
      invocar_edge_function: {
        Args: { p_body: Json; p_nombre: string }
        Returns: undefined
      }
      marcar_dia_cerrado: {
        Args: { p_cerrado?: boolean; p_fecha: string; p_motivo?: string }
        Returns: Json
      }
      norm_nombre: { Args: { p: string }; Returns: string }
      programar_resumenes: { Args: { p_ahora?: string }; Returns: string[] }
      resumen_periodo: {
        Args: { p_desde: string; p_hasta: string }
        Returns: Json
      }
      turno_totales: {
        Args: { p_turno_id: string }
        Returns: {
          efectivo_esperado: number
          efectivo_neto: number
          neto: number
          prov_efectivo: number
          prov_transferencia: number
          total_proveedores: number
          total_ventas: number
        }[]
      }
      verificar_integridad: {
        Args: never
        Returns: {
          cantidad: number
          chequeo: string
          ejemplo: string
          severidad: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
