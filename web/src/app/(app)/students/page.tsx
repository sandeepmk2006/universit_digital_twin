import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DataTable, PageHeader, Pagination, SearchBox, Badge } from "@/components/ui";
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams; const page = Math.max(1, Number(params.page ?? 1)); const search = params.search ?? ""; const supabase = await createClient();
  let query = supabase.from("students").select("id,roll_no,full_name,email,batch_year,current_semester,cgpa,status,programs(name)", {count:"exact"}).order("full_name").range((page-1)*15,page*15-1); if (search) query = query.or(`full_name.ilike.%${search}%,roll_no.ilike.%${search}%`);
  const {data,count} = await query;
  return <><PageHeader title="Students" description="Search and review the student registry."/><form className="mb-4 flex max-w-md gap-2"><SearchBox placeholder="Name or roll number"/><button className="rounded bg-indigo-600 px-4 text-sm font-medium text-white">Search</button></form><DataTable rows={(data ?? []) as unknown as Record<string,unknown>[]} columns={[{key:"roll_no",label:"Roll no.",render:r=><Link className="font-medium text-indigo-600" href={`/students/${r.id}`}>{String(r.roll_no)}</Link>},{key:"full_name",label:"Student"},{key:"programs",label:"Program",render:r=>String((r.programs as {name?:string})?.name ?? "—")},{key:"batch_year",label:"Batch"},{key:"cgpa",label:"CGPA",render:r=><span className="tabular">{String(r.cgpa ?? "—")}</span>},{key:"status",label:"Status",render:r=><Badge tone={r.status === "active" ? "good" : "neutral"}>{String(r.status)}</Badge>}]} empty="No students match this search."/><Pagination page={page} total={count ?? 0} pageSize={15} basePath="/students"/></>;
}
