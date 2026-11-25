import { carbonQuery } from "../integrations/supabase/client";

export interface CrmSnapshot {
  customers: any[];
  vehicles: any[];
  packages: any[];
  contractors: any[];
  jobs: any[];
  blueprints: any[];
}

export async function fetchCrmSnapshot(): Promise<CrmSnapshot> {
  const safeQuery = async (sql: string) => {
    try {
      return await carbonQuery(sql);
    } catch {
      return [];
    }
  };

  const [customers, vehicles, packages, contractors, jobs, blueprints] = await Promise.all([
    safeQuery("SELECT * FROM public.ecmd_crm_customers LIMIT 100;"),
    safeQuery("SELECT * FROM public.ecmd_crm_vehicles LIMIT 200;"),
    safeQuery("SELECT * FROM public.ecmd_crm_packages LIMIT 50;"),
    safeQuery("SELECT * FROM public.ecmd_crm_contractors LIMIT 50;"),
    safeQuery("SELECT * FROM public.ecmd_crm_jobs ORDER BY created_at DESC LIMIT 100;"),
    safeQuery("SELECT page_name, updated_at FROM public.ecmd_page_blueprints LIMIT 25;"),
  ]);

  return { customers, vehicles, packages, contractors, jobs, blueprints };
}