
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "adventure_contacts": {
                  Row: {
                    "added_at": string,"adventure_id": string,"contact_id": string,"trail_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"adventure_id": string,"contact_id": string,"trail_token"?: string
                  }
                  Update: {
                    "added_at"?: string,"adventure_id"?: string,"contact_id"?: string,"trail_token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adventure_contacts_adventure_id_fkey"
      columns: ["adventure_id"]
isOneToOne: false
      referencedRelation: "adventures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adventure_contacts_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "emergency_contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"adventurer_profiles": {
                  Row: {
                    "car_colour": string | null,"car_make": string | null,"car_plate": string | null,"id": string,"medical_notes": string | null,"message_language": string,"name": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "car_colour"?: string | null,"car_make"?: string | null,"car_plate"?: string | null,"id": string,"medical_notes"?: string | null,"message_language"?: string,"name": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "car_colour"?: string | null,"car_make"?: string | null,"car_plate"?: string | null,"id"?: string,"medical_notes"?: string | null,"message_language"?: string,"name"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"adventures": {
                  Row: {
                    "adventurer_id": string,"alert_at": string | null,"alerts_sent": number,"checked_in_at": string | null,"created_at": string,"deadline": string | null,"destination": string | null,"destination_latitude": number | null,"destination_longitude": number | null,"earlier_alerts": number,"ended_at": string | null,"id": string,"last_alert_at": string | null,"plan_revision": number,"stage": Database["public"]['Enums']["adventure_stage"],"started_at": string | null,"time_zone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adventurer_id": string,"alert_at"?: never,"alerts_sent"?: number,"checked_in_at"?: string | null,"created_at"?: string,"deadline"?: string | null,"destination"?: string | null,"destination_latitude"?: number | null,"destination_longitude"?: number | null,"earlier_alerts"?: number,"ended_at"?: string | null,"id"?: string,"last_alert_at"?: string | null,"plan_revision"?: number,"stage"?: Database["public"]['Enums']["adventure_stage"],"started_at"?: string | null,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "adventurer_id"?: string,"alert_at"?: never,"alerts_sent"?: number,"checked_in_at"?: string | null,"created_at"?: string,"deadline"?: string | null,"destination"?: string | null,"destination_latitude"?: number | null,"destination_longitude"?: number | null,"earlier_alerts"?: number,"ended_at"?: string | null,"id"?: string,"last_alert_at"?: string | null,"plan_revision"?: number,"stage"?: Database["public"]['Enums']["adventure_stage"],"started_at"?: string | null,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"emergency_contacts": {
                  Row: {
                    "adventurer_id": string,"created_at": string,"email": string | null,"email_enabled": boolean,"id": string,"name": string,"phone": string | null,"phone_enabled": boolean,"removed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adventurer_id"?: string,"created_at"?: string,"email"?: string | null,"email_enabled"?: boolean,"id"?: string,"name": string,"phone"?: string | null,"phone_enabled"?: boolean,"removed_at"?: string | null
                  }
                  Update: {
                    "adventurer_id"?: string,"created_at"?: string,"email"?: string | null,"email_enabled"?: boolean,"id"?: string,"name"?: string,"phone"?: string | null,"phone_enabled"?: boolean,"removed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "adventure_id": string,"attempts": number,"channel": Database["public"]['Enums']["channel"],"contact_id": string | null,"created_at": string,"delivered_at": string | null,"failure_reason": string | null,"for_deadline": string | null,"id": number,"kind": Database["public"]['Enums']["message_kind"],"lease_until": string | null,"next_attempt_at": string,"plan_revision": number | null,"previous_deadline": string | null,"provider_ref": string | null,"round": number | null,"sent_at": string | null,"settled_at": string | null,"status": Database["public"]['Enums']["message_status"],"to_address": string,"undelivered_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adventure_id": string,"attempts"?: number,"channel": Database["public"]['Enums']["channel"],"contact_id"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"failure_reason"?: string | null,"for_deadline"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["message_kind"],"lease_until"?: string | null,"next_attempt_at"?: string,"plan_revision"?: number | null,"previous_deadline"?: string | null,"provider_ref"?: string | null,"round"?: number | null,"sent_at"?: string | null,"settled_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"to_address": string,"undelivered_at"?: string | null
                  }
                  Update: {
                    "adventure_id"?: string,"attempts"?: number,"channel"?: Database["public"]['Enums']["channel"],"contact_id"?: string | null,"created_at"?: string,"delivered_at"?: string | null,"failure_reason"?: string | null,"for_deadline"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["message_kind"],"lease_until"?: string | null,"next_attempt_at"?: string,"plan_revision"?: number | null,"previous_deadline"?: string | null,"provider_ref"?: string | null,"round"?: number | null,"sent_at"?: string | null,"settled_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"to_address"?: string,"undelivered_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_adventure_id_fkey"
      columns: ["adventure_id"]
isOneToOne: false
      referencedRelation: "adventures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "emergency_contacts"
      referencedColumns: ["id"]
    }
                  ]
                },"position_readings": {
                  Row: {
                    "accuracy_m": number | null,"adventure_id": string,"id": number,"latitude": number,"longitude": number,"reason": string,"slot": string | null,"taken_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"adventure_id": string,"id"?: never,"latitude": number,"longitude": number,"reason": string,"slot"?: never,"taken_at": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"adventure_id"?: string,"id"?: never,"latitude"?: number,"longitude"?: number,"reason"?: string,"slot"?: never,"taken_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "position_readings_adventure_id_fkey"
      columns: ["adventure_id"]
isOneToOne: false
      referencedRelation: "adventures"
      referencedColumns: ["id"]
    }
                  ]
                },"push_devices": {
                  Row: {
                    "adventurer_id": string,"expo_push_token": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adventurer_id"?: string,"expo_push_token": string,"updated_at"?: string
                  }
                  Update: {
                    "adventurer_id"?: string,"expo_push_token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "adventure_messages": {
                  Row: {
                    "adventure_id": string,"channel": Database["public"]['Enums']["channel"],"contacts": Json | null,"delivered": boolean | null,"failure_reason": string | null,"id": number,"kind": Database["public"]['Enums']["message_kind"],"outcome_at": string | null,"round": number | null,"status": Database["public"]['Enums']["message_status"],"to_address": string,"undelivered": boolean | null
                  }
                  ComputedFields: never
                  Insert: {
                           "adventure_id"?: string | null,"channel"?: Database["public"]['Enums']["channel"] | null,"contacts"?: never,"delivered"?: never,"failure_reason"?: string | null,"id"?: number | null,"kind"?: Database["public"]['Enums']["message_kind"] | null,"outcome_at"?: never,"round"?: number | null,"status"?: Database["public"]['Enums']["message_status"] | null,"to_address"?: string | null,"undelivered"?: never
                         }
                        Update: {
                           "adventure_id"?: string | null,"channel"?: Database["public"]['Enums']["channel"] | null,"contacts"?: never,"delivered"?: never,"failure_reason"?: string | null,"id"?: number | null,"kind"?: Database["public"]['Enums']["message_kind"] | null,"outcome_at"?: never,"round"?: number | null,"status"?: Database["public"]['Enums']["message_status"] | null,"to_address"?: string | null,"undelivered"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "messages_adventure_id_fkey"
      columns: ["adventure_id"]
isOneToOne: false
      referencedRelation: "adventures"
      referencedColumns: ["id"]
    }
                  ]
                },"delivery_failures": {
                  Row: {
                    "adventure_id": string,"channel": Database["public"]['Enums']["channel"],"contact_id": string | null,"contact_name": string | null,"created_at": string,"failure_reason": string | null,"id": number,"kind": Database["public"]['Enums']["message_kind"],"round": number | null,"to_address": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "messages_adventure_id_fkey"
      columns: ["adventure_id"]
isOneToOne: false
      referencedRelation: "adventures"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_contact_id_fkey"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "emergency_contacts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "check_in":
{ Args: { "p_checked_in_at": string,"p_id": string }; Returns: Database["public"]['Enums']["refusal"]
                           },
"claim_messages":
{ Args: { "p_lease"?: string,"p_limit": number }; Returns: {
              "adventure_id": string,
"attempts": number,
"channel": Database["public"]['Enums']["channel"],
"contact_id": string | null,
"created_at": string,
"delivered_at": string | null,
"failure_reason": string | null,
"for_deadline": string | null,
"id": number,
"kind": Database["public"]['Enums']["message_kind"],
"lease_until": string | null,
"next_attempt_at": string,
"plan_revision": number | null,
"previous_deadline": string | null,
"provider_ref": string | null,
"round": number | null,
"sent_at": string | null,
"settled_at": string | null,
"status": Database["public"]['Enums']["message_status"],
"to_address": string,
"undelivered_at": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "messages"
        isOneToOne: false
        isSetofReturn: true
      } },
"delete_account":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["refusal"]
                           },
"delete_adventure":
{ Args: { "p_id": string }; Returns: Database["public"]['Enums']["refusal"]
                           },
"enabled_channels":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["channel"][]
                           },
"health":
{ Args: Record<PropertyKey, never>; Returns: {
              "adventures_ok": boolean,"clock_ok": boolean,"delivery_ok": boolean,"outbox_ok": boolean
            }[]
                           },
"message_facts":
{ Args: { "p_message_id": number }; Returns: Json
                           },
"move_deadline":
{ Args: { "p_accuracy_m"?: number,"p_deadline": string,"p_id": string,"p_latitude"?: number,"p_longitude"?: number,"p_position_taken_at"?: string }; Returns: Database["public"]['Enums']["refusal"]
                           },
"record_trail":
{ Args: { "p_id": string,"p_readings": Json }; Returns: Database["public"]['Enums']["refusal"]
                           },
"report_delivery":
{ Args: { "p_id": number,"p_provider_ref": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"save_adventure":
{ Args: { "p_contact_ids": (string)[],"p_deadline": string,"p_destination": string,"p_destination_point"?: Json,"p_id": string }; Returns: {
              "adventure_id": string,"refusal": Database["public"]['Enums']["refusal"]
            }[]
                           } |
{ Args: { "p_contact_ids": (string)[],"p_deadline": string,"p_destination": string,"p_destination_point"?: Json,"p_id": string,"p_route": string }; Returns: {
              "adventure_id": string,"refusal": Database["public"]['Enums']["refusal"]
            }[]
                           } |
{ Args: { "p_contact_ids": (string)[],"p_deadline": string,"p_destination": string,"p_id": string,"p_notes": string,"p_route": string,"p_starting_point": string }; Returns: {
              "adventure_id": string,"refusal": Database["public"]['Enums']["refusal"]
            }[]
                           },
"save_and_start_adventure":
{ Args: { "p_accuracy_m"?: number,"p_contact_ids": (string)[],"p_deadline": string,"p_destination": string,"p_destination_point"?: Json,"p_id": string,"p_latitude"?: number,"p_longitude"?: number,"p_position_taken_at"?: string,"p_time_zone": string }; Returns: {
              "adventure_id": string,"refusal": Database["public"]['Enums']["refusal"]
            }[]
                           },
"settle_message":
{ Args: { "p_attempt": number,"p_id": number,"p_outcome": string,"p_provider_ref"?: string,"p_reason"?: string,"p_retry_after"?: string }; Returns: undefined
                           },
"start_adventure":
{ Args: { "p_accuracy_m"?: number,"p_id": string,"p_latitude"?: number,"p_longitude"?: number,"p_position_taken_at"?: string,"p_time_zone": string }; Returns: Database["public"]['Enums']["refusal"]
                           },
"trail_map":
{ Args: { "p_after"?: string,"p_token": string }; Returns: Json
                           }
          }
          Enums: {
            "adventure_stage": "planned"|"active"|"overdue"|"alerted"|"ended","channel": "email"|"sms"|"push","message_kind": "heads_up"|"alert"|"all_clear"|"plan_update"|"deadline_update","message_status": "pending"|"sending"|"sent"|"failed"|"cancelled","refusal": "not_found"|"profile_incomplete"|"destination_missing"|"deadline_missing"|"deadline_not_in_future"|"deadline_not_later"|"no_contacts"|"unknown_contact"|"another_adventure_in_progress"|"wrong_stage"|"invalid_time_zone"|"messages_pending"|"adventure_in_progress"|"too_many_contacts"|"too_many_starts"|"too_many_alerts"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "adventure_stage": ["planned", "active", "overdue", "alerted", "ended"],"channel": ["email", "sms", "push"],"message_kind": ["heads_up", "alert", "all_clear", "plan_update", "deadline_update"],"message_status": ["pending", "sending", "sent", "failed", "cancelled"],"refusal": ["not_found", "profile_incomplete", "destination_missing", "deadline_missing", "deadline_not_in_future", "deadline_not_later", "no_contacts", "unknown_contact", "another_adventure_in_progress", "wrong_stage", "invalid_time_zone", "messages_pending", "adventure_in_progress", "too_many_contacts", "too_many_starts", "too_many_alerts"]
          }
        }
} as const
