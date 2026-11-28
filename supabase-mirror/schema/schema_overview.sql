-- ============================================================================
-- ECMD Supabase Schema Overview (lvynkeuceiqxafgpgdvs)
-- Generated: 2026-11-28T00:22:41.470Z
-- Public schema tables, columns, constraints, triggers, RLS policies & custom SQL functions
-- ============================================================================

-- Table: public.ecmd_advanced_suggestions (rows: 31, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_advanced_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text,
  title text NOT NULL,
  category text DEFAULT 'Architecture & Automation'::text,
  difficulty_tier text DEFAULT 'Advanced'::text,
  status text DEFAULT 'saved'::text,
  summary text NOT NULL,
  why_it_matters_for_ecmd text DEFAULT ''::text,
  external_downloads_and_accounts jsonb DEFAULT '[]'::jsonb,
  implementation_steps_prompt text DEFAULT ''::text,
  source_conversation_topic text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_advanced_suggestions_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_advanced_suggestions_slug_key (UNIQUE): UNIQUE (slug)

-- Table: public.ecmd_ai_inbox (rows: 1, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_ai_inbox (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  customer_name text DEFAULT 'Visitor'::text,
  customer_phone text DEFAULT ''::text,
  customer_email text DEFAULT ''::text,
  customer_question text NOT NULL,
  ai_confidence numeric DEFAULT 0.40,
  ai_supplemental_reply_sent text DEFAULT ''::text,
  ai_yes_no_prompt_for_owner text DEFAULT ''::text,
  ui_control_type text DEFAULT 'yes_no_and_text'::text,
  owner_yes_no_toggle boolean,
  owner_answer_text text DEFAULT ''::text,
  compiled_rule_for_brain text DEFAULT ''::text,
  status text DEFAULT 'pending'::text,
  owner_notified boolean DEFAULT false,
  notification_channel text DEFAULT 'wix_sms_email'::text,
  learned_brain_id bigint,
  created_at timestamp with time zone DEFAULT now(),
  answered_at timestamp with time zone
);
--   CONSTRAINT ecmd_ai_inbox_conversation_id_fkey (FOREIGN KEY): FOREIGN KEY (conversation_id) REFERENCES ecmd_conversations(id) ON DELETE SET NULL
--   CONSTRAINT ecmd_ai_inbox_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_ai_registry (rows: 31, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_ai_registry (
  id text NOT NULL,
  registry_type text NOT NULL,
  sort_order integer DEFAULT 10,
  is_enabled boolean DEFAULT true,
  requires_passcode boolean DEFAULT false,
  target_actor text DEFAULT 'ADMIN'::text,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_ai_registry_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_brain (rows: 78, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_brain (
  id bigint NOT NULL DEFAULT nextval('ecmd_brain_id_seq'::regclass),
  category text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_brain_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_bridge_logs (rows: 23, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_bridge_logs (
  id bigint NOT NULL DEFAULT nextval('ecmd_bridge_logs_id_seq'::regclass),
  actor_email text DEFAULT 'mlhammes1@gmail.com'::text,
  action text NOT NULL,
  target_path text,
  summary text,
  wix_publish_status integer,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_bridge_logs_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_cli_queue (rows: 12, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_cli_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  status text DEFAULT 'pending'::text,
  output text DEFAULT ''::text,
  source_agent text DEFAULT 'CHROME_SIDEBAR'::text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  command text
);
--   CONSTRAINT ecmd_cli_queue_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   TRIGGER trg_sync_ecmd_cli_queue_command_prompt (BEFORE INSERT): EXECUTE FUNCTION sync_ecmd_cli_queue_command_prompt()
--   TRIGGER trg_sync_ecmd_cli_queue_command_prompt (BEFORE UPDATE): EXECUTE FUNCTION sync_ecmd_cli_queue_command_prompt()

-- Table: public.ecmd_codebase (rows: 78, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_codebase (
  path text NOT NULL,
  folder text NOT NULL,
  file_name text NOT NULL,
  sha text DEFAULT ''::text,
  line_count integer DEFAULT 0,
  size_bytes integer DEFAULT 0,
  content text NOT NULL DEFAULT ''::text,
  numbered_content text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_codebase_pkey (PRIMARY KEY): PRIMARY KEY (path)

-- Table: public.ecmd_conversations (rows: 1, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_key text,
  wix_user_id text,
  actor_role text DEFAULT 'PUBLIC'::text,
  customer_name text DEFAULT 'Guest Visitor'::text,
  customer_phone text DEFAULT ''::text,
  customer_email text DEFAULT ''::text,
  vehicle_context text DEFAULT ''::text,
  page_route text DEFAULT '/'::text,
  status text DEFAULT 'active'::text,
  lead_intent text DEFAULT 'general'::text,
  ai_summary text DEFAULT ''::text,
  unread_unsure_count integer DEFAULT 0,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_conversations_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_conversations_session_key_key (UNIQUE): UNIQUE (session_key)

-- Table: public.ecmd_crm_availability (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_availability (
  wix_id text NOT NULL,
  detailer_id text,
  rule_type text DEFAULT ''::text,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_availability_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)

-- Table: public.ecmd_crm_contacts (rows: 5, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wix_id text,
  wix_user_id text,
  first_name text DEFAULT ''::text,
  last_name text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  email text DEFAULT ''::text,
  archived boolean DEFAULT false,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_contacts_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_crm_contacts_wix_id_key (UNIQUE): UNIQUE (wix_id)

-- Table: public.ecmd_crm_contractors (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_contractors (
  wix_id text NOT NULL,
  first_name text DEFAULT ''::text,
  last_name text DEFAULT ''::text,
  team_alias text DEFAULT ''::text,
  email text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  is_active_detailer boolean DEFAULT true,
  is_admin boolean DEFAULT false,
  pay_level integer DEFAULT 1,
  sort_order text DEFAULT '99'::text,
  google_calendar_id text DEFAULT ''::text,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_contractors_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)

-- Table: public.ecmd_crm_customers (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wix_user_id text,
  first_name text DEFAULT ''::text,
  last_name text DEFAULT ''::text,
  primary_email text DEFAULT ''::text,
  primary_phone text DEFAULT ''::text,
  city text DEFAULT ''::text,
  state text DEFAULT ''::text,
  lead_status text DEFAULT 'active'::text,
  lifetime_spend numeric DEFAULT 0,
  total_bookings integer DEFAULT 0,
  ai_crm_notes text DEFAULT ''::text,
  tags jsonb DEFAULT '[]'::jsonb,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_customers_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_crm_customers_wix_user_id_key (UNIQUE): UNIQUE (wix_user_id)

-- Table: public.ecmd_crm_jobs (rows: 7, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wix_id text,
  order_id text,
  wix_user_id text,
  status text DEFAULT 'Scheduled'::text,
  payment_status text DEFAULT 'Un-Paid'::text,
  service_date timestamp with time zone,
  scheduled_time text DEFAULT ''::text,
  detailer_id text,
  detailer_name text DEFAULT ''::text,
  package_title text DEFAULT ''::text,
  vehicle_info text DEFAULT ''::text,
  city text DEFAULT ''::text,
  total_price numeric DEFAULT 0,
  payout_total numeric DEFAULT 0,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_jobs_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_crm_jobs_wix_id_key (UNIQUE): UNIQUE (wix_id)

-- Table: public.ecmd_crm_locations (rows: 5, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wix_id text,
  wix_user_id text,
  address1 text DEFAULT ''::text,
  address2 text DEFAULT ''::text,
  city text DEFAULT ''::text,
  state text DEFAULT ''::text,
  zip text DEFAULT ''::text,
  archived boolean DEFAULT false,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_locations_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_crm_locations_wix_id_key (UNIQUE): UNIQUE (wix_id)

-- Table: public.ecmd_crm_subscriptions (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_subscriptions (
  wix_id text NOT NULL,
  wix_user_id text,
  package_title text DEFAULT ''::text,
  frequency text DEFAULT 'Monthly'::text,
  recurring_day text DEFAULT ''::text,
  time_slot text DEFAULT ''::text,
  price numeric DEFAULT 0,
  vehicle_category text DEFAULT 'Automotive'::text,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_subscriptions_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)

-- Table: public.ecmd_crm_temp_cart (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_temp_cart (
  wix_id text NOT NULL,
  wix_user_id text,
  package_title text DEFAULT ''::text,
  total_price numeric DEFAULT 0,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_temp_cart_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)

-- Table: public.ecmd_crm_vehicles (rows: 6, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_crm_vehicles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  wix_id text,
  wix_user_id text,
  year text DEFAULT ''::text,
  make text DEFAULT ''::text,
  model text DEFAULT ''::text,
  color text DEFAULT ''::text,
  vehicle_type text DEFAULT ''::text,
  vehicle_category text DEFAULT 'Automotive'::text,
  archived boolean DEFAULT false,
  raw_wix_data jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_crm_vehicles_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_crm_vehicles_wix_id_key (UNIQUE): UNIQUE (wix_id)

-- Table: public.ecmd_dev_jobs (rows: 0, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_dev_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text DEFAULT 'pending'::text,
  action text NOT NULL,
  file_path text,
  find_str text,
  replace_str text,
  full_content text,
  shell_cmd text,
  tsc_clean boolean,
  output text,
  created_at timestamp with time zone DEFAULT now(),
  finished_at timestamp with time zone
);
--   CONSTRAINT ecmd_dev_jobs_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_diagnostic_runs (rows: 1, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_diagnostic_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_path text NOT NULL,
  check_type text NOT NULL DEFAULT 'pre_publish_gate'::text,
  status text NOT NULL,
  previous_sha text,
  new_sha text,
  error_detected text,
  healer_action_taken text,
  tokens_used integer DEFAULT 0,
  estimated_cost_usd numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_diagnostic_runs_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_external_ai_cms (rows: 41, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_external_ai_cms (
  id text NOT NULL,
  entry_type text NOT NULL,
  chat_location text DEFAULT 'ALL'::text,
  title text NOT NULL,
  is_enabled boolean DEFAULT true,
  sort_order integer DEFAULT 10,
  system_prompt_directive text NOT NULL,
  capabilities_list jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_external_ai_cms_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_files_mirror (rows: 99, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_files_mirror (
  path text NOT NULL,
  content text NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_files_mirror_pkey (PRIMARY KEY): PRIMARY KEY (path)

-- Table: public.ecmd_members (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  password_plain_backup text,
  member_role text DEFAULT 'member'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_members_email_key (UNIQUE): UNIQUE (email)
--   CONSTRAINT ecmd_members_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_messages (rows: 6, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  sender_role text NOT NULL,
  message_text text NOT NULL,
  ai_confidence numeric DEFAULT 1.00,
  was_unsure boolean DEFAULT false,
  supplemental_action_prompt text DEFAULT ''::text,
  extracted_crm_facts jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_messages_conversation_id_fkey (FOREIGN KEY): FOREIGN KEY (conversation_id) REFERENCES ecmd_conversations(id) ON DELETE CASCADE
--   CONSTRAINT ecmd_messages_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_packages (rows: 4, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_packages (
  id integer NOT NULL DEFAULT nextval('ecmd_packages_id_seq'::regclass),
  slug text,
  title text NOT NULL,
  description text,
  hero_image_url text,
  badge_image_url text,
  review_score text DEFAULT '4.7'::text,
  review_count text DEFAULT '9400'::text,
  addons_count integer DEFAULT 99,
  default_scope text DEFAULT 'full'::text,
  pricing_matrix jsonb NOT NULL,
  sort_order integer DEFAULT 1,
  enabled boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_packages_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_packages_slug_key (UNIQUE): UNIQUE (slug)

-- Table: public.ecmd_pen_turns (rows: 50, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_pen_turns (
  ref_code text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  date_label text,
  time_label text,
  status text,
  tsc_clean boolean,
  short_title text,
  human_bullets jsonb,
  files_changed jsonb,
  errors_summary text,
  task_prompt text,
  raw_cli_output text,
  tsc_output text
);
--   CONSTRAINT ecmd_pen_turns_pkey (PRIMARY KEY): PRIMARY KEY (ref_code)

-- Table: public.ecmd_plasmic_hydration (rows: 1, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_plasmic_hydration (
  id text NOT NULL DEFAULT 'latest'::text,
  project_id text NOT NULL,
  version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  components_count integer DEFAULT 0,
  layout_hierarchy jsonb NOT NULL DEFAULT '{}'::jsonb,
  interactive_elements jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_plasmic_hydration_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_service_packages (rows: 36, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_service_packages (
  id integer NOT NULL DEFAULT nextval('ecmd_service_packages_id_seq'::regclass),
  wix_id text,
  title text NOT NULL,
  package_level text NOT NULL,
  detail_type text NOT NULL,
  sub_category text NOT NULL,
  service_category text NOT NULL DEFAULT 'Auto'::text,
  price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  sale_title text NOT NULL DEFAULT ''::text,
  mobile_fee numeric NOT NULL DEFAULT 0,
  duration numeric NOT NULL DEFAULT 2,
  description text NOT NULL DEFAULT ''::text,
  interior_description text NOT NULL DEFAULT ''::text,
  exterior_description text NOT NULL DEFAULT ''::text,
  main_display_image text NOT NULL DEFAULT ''::text,
  bi_weekly_percent numeric NOT NULL DEFAULT 20,
  monthly_percent numeric NOT NULL DEFAULT 15,
  quarterly_percent numeric NOT NULL DEFAULT 10,
  sort_order integer NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  bi_weekly_flat numeric,
  monthly_flat numeric,
  quarterly_flat numeric,
  sub_title text,
  duration_ui text,
  payout_l1 numeric,
  payout_l2 numeric,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
--   CONSTRAINT ecmd_service_packages_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_service_packages_wix_id_key (UNIQUE): UNIQUE (wix_id)
--   POLICY "Public read ecmd_service_packages" ON public.ecmd_service_packages FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_site_blueprints (rows: 106, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_site_blueprints (
  id text NOT NULL,
  route text NOT NULL,
  viewport text DEFAULT 'Desktop'::text,
  category text DEFAULT 'dom_css_blueprint'::text,
  title text NOT NULL,
  total_elements integer DEFAULT 0,
  blueprint_json jsonb DEFAULT '{}'::jsonb,
  raw_content text DEFAULT ''::text,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_site_blueprints_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_site_menu_buttons (rows: 17, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_site_menu_buttons (
  id integer NOT NULL DEFAULT nextval('ecmd_site_menu_buttons_id_seq'::regclass),
  button_id text NOT NULL,
  slug text NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  category_order integer DEFAULT 1,
  sort_order integer DEFAULT 1,
  icon_name text,
  css_classes text,
  action_key text,
  target_url text,
  enabled boolean DEFAULT true,
  notes text,
  updated_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_site_menu_buttons_button_id_key (UNIQUE): UNIQUE (button_id)
--   CONSTRAINT ecmd_site_menu_buttons_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_site_menu_buttons_slug_key (UNIQUE): UNIQUE (slug)

-- Table: public.ecmd_sql_logs (rows: 20, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_sql_logs (
  id integer NOT NULL DEFAULT nextval('ecmd_sql_logs_id_seq'::regclass),
  query_name text,
  result_json jsonb,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_sql_logs_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_telemetry (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_telemetry (
  id bigint NOT NULL DEFAULT nextval('ecmd_telemetry_id_seq'::regclass),
  session_id text,
  user_email text,
  page text DEFAULT 'packages'::text,
  event_type text NOT NULL,
  vehicle_type text,
  package_tier text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_telemetry_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_whats_included (rows: 30, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_whats_included (
  id integer NOT NULL DEFAULT nextval('ecmd_whats_included_id_seq'::regclass),
  wix_id text,
  title text NOT NULL,
  button_title text NOT NULL DEFAULT ''::text,
  description text NOT NULL DEFAULT ''::text,
  detail_type text NOT NULL DEFAULT 'Interior'::text,
  package_level text NOT NULL DEFAULT ''::text,
  whats_included text NOT NULL DEFAULT ''::text,
  price numeric NOT NULL DEFAULT 0,
  notice text NOT NULL DEFAULT ''::text,
  sort integer NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  slug_id text,
  intro text,
  overview text,
  add_on_title text,
  video text,
  overview01 text,
  overview02 text,
  overview03 text,
  overview04 text,
  overview05 text,
  overview06 text,
  overview07 text,
  overview_t01 text,
  overview_t02 text,
  overview_t03 text,
  overview_t04 text,
  overview_t05 text,
  overview_t06 text,
  overview_t07 text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb
);
--   CONSTRAINT ecmd_whats_included_pkey (PRIMARY KEY): PRIMARY KEY (id)
--   CONSTRAINT ecmd_whats_included_wix_id_key (UNIQUE): UNIQUE (wix_id)
--   POLICY "Public read ecmd_whats_included" ON public.ecmd_whats_included FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_active_subscriptions (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_active_subscriptions (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text
);
--   CONSTRAINT ecmd_wix_active_subscriptions_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_active_subscriptions" ON public.ecmd_wix_active_subscriptions FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_ai_brain_master_index (rows: 7, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_ai_brain_master_index (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  pipeline_stage_order numeric,
  module_title text,
  brain_layer text,
  status text,
  linked_collection_table text,
  human_summary text,
  ai_filter_routing_rule text,
  improvement_roadmap text
);
--   CONSTRAINT ecmd_wix_ai_brain_master_index_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_ai_brain_master_index" ON public.ecmd_wix_ai_brain_master_index FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_ai_capabilities_rules (rows: 15, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_ai_capabilities_rules (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_order text,
  capability_key_function_id text,
  title text,
  agent_target_head_body text,
  category text,
  enabled_on_off_toggle boolean,
  requires_passcode text,
  passcode_auth_rule text,
  allowed_actors text,
  human_description text,
  ai_readable_directive_rules text,
  rules_config_json text,
  instructions_for_ui_build text
);
--   CONSTRAINT ecmd_wix_ai_capabilities_rules_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_ai_capabilities_rules" ON public.ecmd_wix_ai_capabilities_rules FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_ai_persona_response_rules (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_ai_persona_response_rules (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  priority_order numeric,
  rule_key text,
  title text,
  target_actor_admin_detailer_public_all text,
  enabled_on_off_toggle boolean,
  tone_formatting_style text,
  human_description text,
  ai_readable_persona_directive text,
  forbidden_topics_guardrails text,
  example_ideal_response text,
  instructions_for_ui_build text
);
--   CONSTRAINT ecmd_wix_ai_persona_response_rules_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_ai_persona_response_rules" ON public.ecmd_wix_ai_persona_response_rules FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_availability_rules (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_availability_rules (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  rule_type text,
  detailer_name text,
  target_day_of_week text,
  target_date text,
  effect text,
  target_tokens text,
  status text,
  requested_by text,
  detailer_id text,
  title text,
  end_date text
);
--   CONSTRAINT ecmd_wix_availability_rules_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_availability_rules" ON public.ecmd_wix_availability_rules FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_bookings (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_bookings (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  customer_id text,
  vehicle_id text,
  service_date text,
  detailer_assigned text,
  alt_contact_name text,
  alt_contact_phone text,
  total_price text,
  order_id text,
  package_title text,
  add_ons text,
  duration text,
  address_id text,
  status text,
  time_slot text
);
--   CONSTRAINT ecmd_wix_bookings_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_bookings" ON public.ecmd_wix_bookings FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_calendar_time_slots (rows: 3, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_calendar_time_slots (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  token text,
  label text,
  expected_hour numeric,
  weekly_available_text text,
  weekly_unavailable_text text,
  arrival_hour numeric
);
--   CONSTRAINT ecmd_wix_calendar_time_slots_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_calendar_time_slots" ON public.ecmd_wix_calendar_time_slots FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_code_and_blueprints (rows: 80, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_code_and_blueprints (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  category text,
  velo_source_code text,
  migration_output_code text,
  live_dom_computed_css text,
  last_synced_at text,
  livedomcomputedcss text,
  lastsynced text,
  migrationoutputcode text
);
--   CONSTRAINT ecmd_wix_code_and_blueprints_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_code_and_blueprints" ON public.ecmd_wix_code_and_blueprints FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_contractors (rows: 4, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_contractors (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  first text,
  last_name text,
  phone_number text,
  email text,
  team_alias text,
  role text,
  working_days text,
  is_active_detailer boolean,
  google_calendar_id text,
  pay_level numeric,
  is_trainee text,
  is_admin boolean,
  advanced_scheduling text,
  third_slot_option boolean,
  approved_schedule text,
  home_address text,
  sort text
);
--   CONSTRAINT ecmd_wix_contractors_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_contractors" ON public.ecmd_wix_contractors FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_customer_contacts (rows: 5, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_customer_contacts (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  phone text,
  relationship text,
  email text,
  is_primary boolean,
  userid text
);
--   CONSTRAINT ecmd_wix_customer_contacts_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_customer_contacts" ON public.ecmd_wix_customer_contacts FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_customer_locations (rows: 5, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_customer_locations (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id text,
  address1 text,
  address2 text,
  city text,
  state text,
  zip text,
  is_contact_only text,
  is_location_only text,
  location_title text,
  is_primary boolean
);
--   CONSTRAINT ecmd_wix_customer_locations_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_customer_locations" ON public.ecmd_wix_customer_locations FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_customer_profiles (rows: 3, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_customer_profiles (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  email text,
  city text,
  state text,
  zip text,
  phone text,
  address1 text,
  address2 text,
  active_subscription boolean,
  userid text,
  email_confirmed text
);
--   CONSTRAINT ecmd_wix_customer_profiles_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_customer_profiles" ON public.ecmd_wix_customer_profiles FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_customer_vehicles (rows: 6, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_customer_vehicles (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  main_display_image text,
  vehicle_image_gallery text,
  model text,
  color text,
  length numeric,
  year numeric,
  make text,
  vehicle_type text,
  image text,
  user_id text,
  category text,
  special_instructions text,
  archived boolean,
  package_image text,
  galleryimages text,
  vehiclenotes text
);
--   CONSTRAINT ecmd_wix_customer_vehicles_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_customer_vehicles" ON public.ecmd_wix_customer_vehicles FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_discounts (rows: 1, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_discounts (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  amount numeric,
  is_active boolean
);
--   CONSTRAINT ecmd_wix_discounts_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_discounts" ON public.ecmd_wix_discounts FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_global_settings (rows: 1, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_global_settings (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  setting_name text,
  is_active boolean
);
--   CONSTRAINT ecmd_wix_global_settings_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_global_settings" ON public.ecmd_wix_global_settings FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_legacy_vault (rows: 106, rls: OFF)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_legacy_vault (
  id integer NOT NULL DEFAULT nextval('ecmd_wix_legacy_vault_id_seq'::regclass),
  file_path text,
  category text,
  wix_page_or_module text,
  content text,
  line_count integer,
  source_origin text,
  synced_at timestamp with time zone DEFAULT now()
);
--   CONSTRAINT ecmd_wix_legacy_vault_file_path_key (UNIQUE): UNIQUE (file_path)
--   CONSTRAINT ecmd_wix_legacy_vault_pkey (PRIMARY KEY): PRIMARY KEY (id)

-- Table: public.ecmd_wix_login_security (rows: 7, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_login_security (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  button_text text,
  text text,
  target_location text,
  sort text,
  is_enabled boolean,
  location text,
  data_key text,
  edit_title text,
  edit_description text,
  edit_button text
);
--   CONSTRAINT ecmd_wix_login_security_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_login_security" ON public.ecmd_wix_login_security FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_payment_methods (rows: 15, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_payment_methods (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  image text,
  selected text,
  unselected text,
  sort text,
  category text,
  is_active boolean,
  percent numeric,
  stripe_code text,
  image_square text,
  image_button text,
  is_pay_box boolean,
  details_title text,
  desktop text,
  mobile text,
  visa_button text,
  mastercard_button text,
  discover_button text,
  am_ex text,
  visa text,
  mastercard text,
  discover text,
  amex text,
  html_desktop text,
  provider text,
  default_button text,
  details_text_mobile text,
  details_text_desktop text
);
--   CONSTRAINT ecmd_wix_payment_methods_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_payment_methods" ON public.ecmd_wix_payment_methods FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_profile_buttons (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_profile_buttons (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  image text,
  text text,
  sort text
);
--   CONSTRAINT ecmd_wix_profile_buttons_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_profile_buttons" ON public.ecmd_wix_profile_buttons FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_promo_codes (rows: 0, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_promo_codes (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  code text,
  discount_amount text,
  discount_type text,
  is_active text
);
--   CONSTRAINT ecmd_wix_promo_codes_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_promo_codes" ON public.ecmd_wix_promo_codes FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_scheduled_jobs (rows: 7, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_scheduled_jobs (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id text,
  status text,
  order_id text,
  package_title text,
  level text,
  type text,
  base_price numeric,
  total_price numeric,
  vehicle_id text,
  contact_id text,
  location_id text,
  special_instructions text,
  detailer_id text,
  detailer_alias text,
  first_name text,
  last_name text,
  phone text,
  email text,
  address1 text,
  city text,
  state text,
  zip text,
  was_rescheduled boolean,
  mobile_fee numeric,
  sub_total numeric,
  discounts_applied text,
  discounts_total numeric,
  interior_add_ons text,
  exterior_add_ons text,
  total_add_ons_price numeric,
  sale_package_price numeric,
  original_scheduled_date text,
  scheduled_time text,
  arrival_time text,
  completion_time text,
  set_duration numeric,
  service_date text,
  is_subscription text,
  frequency text,
  address2 text,
  custom_add_ons text,
  office_notes text,
  cancel_reason text,
  was_booked_by_phone text,
  package_image text,
  vehiclecategory text,
  vehicle_type text,
  detailer_name text,
  google_event_id text,
  google_admin_event_id text,
  when_rescheduled text,
  payment_status text,
  vehiclemodel text,
  vehicleyear numeric,
  vehiclecolor text,
  vehiclemake text,
  vehicleinfo text,
  timetoken text,
  payment_method_string text,
  card_network text,
  card_last4 text,
  scheduled_start_time text,
  deadline_time text,
  base_payout numeric,
  add_on_payout numeric,
  traineeid text,
  packagechanged boolean,
  traineepayout numeric,
  locationchanged boolean,
  payouttotal numeric,
  vehiclechanged boolean,
  datechanged text,
  trainerpayout numeric,
  contactchanged boolean,
  chat_history text,
  is_correction text,
  correction_items text,
  correction_images text,
  correction_detailer_id text,
  correction_detailer_name text,
  correction_payout text,
  correction_date text,
  correction_time text,
  correction_time_token text
);
--   CONSTRAINT ecmd_wix_scheduled_jobs_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_scheduled_jobs" ON public.ecmd_wix_scheduled_jobs FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_site_buttons (rows: 81, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_site_buttons (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  category text,
  image text,
  sort text,
  button_location text,
  is_enabled boolean,
  target_state text,
  image2 text,
  sort2 text,
  is_logged_out boolean
);
--   CONSTRAINT ecmd_wix_site_buttons_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_site_buttons" ON public.ecmd_wix_site_buttons FOR SELECT TO {anon,authenticated} USING (true);

-- Table: public.ecmd_wix_sync_errors (rows: 9, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_sync_errors (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  calendar_id text,
  payload text,
  error_message text,
  timestamp text
);
--   CONSTRAINT ecmd_wix_sync_errors_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_sync_errors" ON public.ecmd_wix_sync_errors FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_temporary_data (rows: 2, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_temporary_data (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  user_id text,
  status text,
  order_id text,
  package_title text,
  level text,
  type text,
  base_price numeric,
  total_price numeric,
  total_duration text,
  vehicle_id text,
  contact_id text,
  location_id text,
  special_instructions text,
  service_date text,
  detailer_id text,
  detailer_alias text,
  next_sug_detail text,
  detail_day text,
  first_name text,
  last_name text,
  phone text,
  email text,
  address_1 text,
  city text,
  state text,
  zip text,
  vehicle_info text,
  was_late text,
  was_rescheduled text,
  mobile_fee numeric,
  sub_total numeric,
  discounts_applied text,
  discounts_total numeric,
  on_site_contact_name text,
  on_site_contact_phone text,
  interior_add_ons text,
  exterior_add_ons text,
  total_add_ons_price numeric,
  sale_package_price numeric,
  original_scheduled_date text,
  scheduled_time text,
  arrival_time text,
  completion_time text,
  customer_satisfaction_customer text,
  customer_satisfaction_detailer text,
  set_duration numeric,
  customer_temperament_office text,
  customer_temperament_detailer text,
  frequency text,
  subscription text,
  assigneddetailerid text,
  assigneddate text,
  assignedslottext text,
  assignedtime text,
  assigneddetaileralias text
);
--   CONSTRAINT ecmd_wix_temporary_data_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Owner admin access ecmd_wix_temporary_data" ON public.ecmd_wix_temporary_data FOR ALL TO {authenticated} USING (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'mlhammes1@gmail.com'::text));

-- Table: public.ecmd_wix_vehicle_categories (rows: 14, rls: ON)
CREATE TABLE IF NOT EXISTS public.ecmd_wix_vehicle_categories (
  wix_id text NOT NULL,
  wix_created_date text,
  wix_updated_date text,
  wix_owner text,
  raw_wix_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  vehicle_type text,
  sub_category text,
  sort text
);
--   CONSTRAINT ecmd_wix_vehicle_categories_pkey (PRIMARY KEY): PRIMARY KEY (wix_id)
--   POLICY "Public read ecmd_wix_vehicle_categories" ON public.ecmd_wix_vehicle_categories FOR SELECT TO {anon,authenticated} USING (true);

-- ============================================================================
-- Custom Public SQL Functions (pg_proc, excluding pgvector internals)
-- ============================================================================

-- Function: public.call_ecmd_bridge_from_db(payload jsonb)
CREATE OR REPLACE FUNCTION public.call_ecmd_bridge_from_db(payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'net'
AS $function$
DECLARE
    v_key text;
    v_req_id bigint;
BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'ECMD_BRIDGE_KEY'
    LIMIT 1;

    IF v_key IS NULL THEN
        RAISE EXCEPTION 'ECMD_BRIDGE_KEY not found in vault.decrypted_secrets';
    END IF;

    v_req_id := net.http_post(
        url := 'https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge',
        body := payload,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-bridge-key', v_key
        )
    );

    RETURN v_req_id;
END;
$function$


-- Function: public.ecmd_auth_member(p_mode text, p_email text, p_password text)
CREATE OR REPLACE FUNCTION public.ecmd_auth_member(p_mode text, p_email text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE v_member RECORD; BEGIN IF p_mode = 'signup' THEN INSERT INTO public.ecmd_members (email, password_hash, password_plain_backup) VALUES (lower(trim(p_email)), crypt(p_password, gen_salt('bf')), p_password) ON CONFLICT (email) DO UPDATE SET password_hash = crypt(p_password, gen_salt('bf')), password_plain_backup = p_password, last_login_at = now() RETURNING id, email, member_role INTO v_member; RETURN jsonb_build_object('ok', true, 'mode', 'signup', 'message', 'Member account created & logged in!', 'member_id', v_member.id, 'email', v_member.email); ELSE SELECT * INTO v_member FROM public.ecmd_members WHERE email = lower(trim(p_email)); IF NOT FOUND THEN INSERT INTO public.ecmd_members (email, password_hash, password_plain_backup) VALUES (lower(trim(p_email)), crypt(p_password, gen_salt('bf')), p_password) RETURNING id, email, member_role INTO v_member; RETURN jsonb_build_object('ok', true, 'mode', 'auto_registered', 'message', 'Login Successful — Member Recorded!', 'member_id', v_member.id, 'email', v_member.email); END IF; IF v_member.password_hash = crypt(p_password, v_member.password_hash) OR v_member.password_plain_backup = p_password THEN UPDATE public.ecmd_members SET last_login_at = now() WHERE id = v_member.id; RETURN jsonb_build_object('ok', true, 'mode', 'login', 'message', 'Login Successful — Welcome back!', 'member_id', v_member.id, 'email', v_member.email); ELSE RETURN jsonb_build_object('ok', false, 'message', 'Incorrect password for this member email.'); END IF; END IF; END; $function$


-- Function: public.ecmd_exec_sql(q text)
CREATE OR REPLACE FUNCTION public.ecmd_exec_sql(q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$ DECLARE res jsonb; BEGIN EXECUTE 'SELECT coalesce(jsonb_agg(t), ''[]''::jsonb) FROM (' || q || ') t' INTO res; RETURN jsonb_build_object('ok', true, 'rows', res); EXCEPTION WHEN OTHERS THEN BEGIN EXECUTE q; RETURN jsonb_build_object('ok', true, 'command', 'executed'); EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok', false, 'error', SQLERRM); END; END; $function$


-- Function: public.exec_sql(sql_query text)
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Unauthorized: exec_sql requires service_role';
  END IF;

  IF sql_query ~* '^\s*(SELECT|WITH|SHOW|EXPLAIN)' THEN
    EXECUTE format('SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (%s) t', sql_query) INTO result;
    RETURN jsonb_build_object('ok', true, 'mode', 'query', 'rows', result);
  ELSE
    EXECUTE sql_query;
    RETURN jsonb_build_object('ok', true, 'mode', 'command', 'status', 'executed');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$function$


-- Function: public.match_ecmd_brain(query_embedding vector, match_threshold double precision, match_count integer, filter_category text)
CREATE OR REPLACE FUNCTION public.match_ecmd_brain(query_embedding vector, match_threshold double precision DEFAULT 0.65, match_count integer DEFAULT 5, filter_category text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, category text, title text, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    ecmd_brain.id,
    ecmd_brain.category,
    ecmd_brain.title,
    ecmd_brain.content,
    ecmd_brain.metadata,
    1 - (ecmd_brain.embedding <=> query_embedding) as similarity
  from ecmd_brain
  where 1 - (ecmd_brain.embedding <=> query_embedding) > match_threshold
    and (filter_category is null or ecmd_brain.category = filter_category)
  order by ecmd_brain.embedding <=> query_embedding
  limit match_count;
$function$


-- Function: public.rls_auto_enable()
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$


-- Function: public.sync_ecmd_cli_queue_command_prompt()
CREATE OR REPLACE FUNCTION public.sync_ecmd_cli_queue_command_prompt()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.command IS NOT NULL AND (NEW.prompt IS NULL OR NEW.prompt = '') THEN
        NEW.prompt := NEW.command;
    ELSIF NEW.prompt IS NOT NULL AND (NEW.command IS NULL OR NEW.command = '') THEN
        NEW.command := NEW.prompt;
    END IF;
    RETURN NEW;
END;
$function$

