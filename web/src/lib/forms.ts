import { createClient } from "@/lib/supabase/server";
import type { Field } from "@/lib/permissions";

// Resolve database-backed select options so the form can render plain data.
export async function resolveFields(fields: Field[]): Promise<Field[]> {
  const supabase = await createClient();
  return Promise.all(
    fields.map(async (f) => {
      if (!f.optionsFrom) return f;
      const { table, value, label, order } = f.optionsFrom;
      const { data } = await supabase
        .from(table)
        .select(`${value},${label}`)
        .order(order ?? label);
      const options = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
        value: String(r[value]),
        label: String(r[label]),
      }));
      return { ...f, optionsFrom: undefined, options };
    }),
  );
}
