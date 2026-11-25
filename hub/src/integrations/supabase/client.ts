export const SUPABASE_URL = "https://lvynkeuceiqxafgpgdvs.supabase.co";
export const BRIDGE_URL = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge";
export const BRIDGE_KEY = "[REDACTED_SECRET]";

export async function carbonBridge<T = any>(payload: Record<string, any>): Promise<T> {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-key": BRIDGE_KEY,
      "Authorization": `Bearer ${BRIDGE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Carbon Bridge Error (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function carbonQuery<T = any>(sql: string): Promise<T[]> {
  const data = await carbonBridge<any>({ action: "run_sql", sql });
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function carbonInsert(table: string, row: Record<string, any>) {
  const cols = Object.keys(row).map(k => `"${k}"`).join(", ");
  const vals = Object.values(row).map(v => {
    if (v === null) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return v;
  }).join(", ");
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${vals}) RETURNING *`;
  return carbonQuery(sql);
}

export async function carbonUpdate(table: string, match: Record<string, any>, updates: Record<string, any>) {
  const sets = Object.entries(updates).map(([k, v]) => {
    let valStr = String(v);
    if (v === null) valStr = 'NULL';
    else if (typeof v === 'string') valStr = `'${v.replace(/'/g, "''")}'`;
    else if (typeof v === 'object') valStr = `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `"${k}" = ${valStr}`;
  }).join(", ");
  const wheres = Object.entries(match).map(([k, v]) => {
    let valStr = String(v);
    if (typeof v === 'string') valStr = `'${v.replace(/'/g, "''")}'`;
    return `"${k}" = ${valStr}`;
  }).join(" AND ");
  const sql = `UPDATE ${table} SET ${sets} WHERE ${wheres} RETURNING *`;
  return carbonQuery(sql);
}
