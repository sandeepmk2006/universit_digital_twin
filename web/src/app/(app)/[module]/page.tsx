import { createClient } from "@/lib/supabase/server";
import { DataTable, PageHeader } from "@/components/ui";
const config: Record<string,{table:string; title:string; columns:{key:string;label:string}[]}> = {
  courses:{table:"courses",title:"Courses",columns:[{key:"code",label:"Code"},{key:"title",label:"Title"},{key:"credits",label:"Credits"},{key:"semester",label:"Semester"}]},
  examinations:{table:"exams",title:"Examinations",columns:[{key:"kind",label:"Kind"},{key:"max_marks",label:"Max marks"},{key:"weightage",label:"Weightage"},{key:"held_on",label:"Held on"}]},
  hostel:{table:"hostels",title:"Hostel",columns:[{key:"name",label:"Hostel"},{key:"gender",label:"Gender"},{key:"capacity",label:"Capacity"}]},
  library:{table:"books",title:"Library",columns:[{key:"title",label:"Title"},{key:"isbn",label:"ISBN"},{key:"publisher",label:"Publisher"},{key:"year",label:"Year"}]},
  transport:{table:"buses",title:"Transport",columns:[{key:"registration",label:"Registration"},{key:"capacity",label:"Capacity"},{key:"driver_name",label:"Driver"}]},
  events:{table:"events",title:"Events",columns:[{key:"title",label:"Event"},{key:"starts_at",label:"Starts"},{key:"ends_at",label:"Ends"},{key:"capacity",label:"Capacity"}]},
  clubs:{table:"clubs",title:"Clubs",columns:[{key:"name",label:"Name"},{key:"category",label:"Category"},{key:"description",label:"Description"}]},
  sports:{table:"sports_facilities",title:"Sports",columns:[{key:"name",label:"Facility"},{key:"sport",label:"Sport"},{key:"capacity",label:"Capacity"}]},
  health:{table:"medicine_stock",title:"Health Centre",columns:[{key:"name",label:"Medicine"},{key:"quantity",label:"Quantity"},{key:"reorder_at",label:"Reorder at"},{key:"expires_on",label:"Expires"}]},
  visitors:{table:"visitors",title:"Visitors",columns:[{key:"full_name",label:"Visitor"},{key:"purpose",label:"Purpose"},{key:"checked_in_at",label:"Checked in"},{key:"checked_out_at",label:"Checked out"}]},
  admissions:{table:"applicants",title:"Admissions",columns:[{key:"full_name",label:"Applicant"},{key:"email",label:"Email"},{key:"status",label:"Status"},{key:"applied_at",label:"Applied"}]},
  research:{table:"research_projects",title:"Research",columns:[{key:"title",label:"Project"},{key:"funding_agency",label:"Agency"},{key:"status",label:"Status"},{key:"starts_on",label:"Starts"}]},
  alumni:{table:"alumni",title:"Alumni",columns:[{key:"full_name",label:"Name"},{key:"graduation_year",label:"Graduated"},{key:"current_company",label:"Company"},{key:"city",label:"City"}]},
  finance:{table:"invoices",title:"Finance",columns:[{key:"student_id",label:"Student"},{key:"amount",label:"Amount"},{key:"due_on",label:"Due"},{key:"status",label:"Status"}]},
  inventory:{table:"inventory_items",title:"Inventory",columns:[{key:"sku",label:"SKU"},{key:"name",label:"Item"},{key:"category",label:"Category"},{key:"quantity",label:"Quantity"}]},
  feedback:{table:"feedback_forms",title:"Feedback",columns:[{key:"title",label:"Form"},{key:"opens_at",label:"Opens"},{key:"closes_at",label:"Closes"}]},
  attendance:{table:"attendance_sessions",title:"Attendance",columns:[{key:"held_on",label:"Date"},{key:"starts_at",label:"Starts"},{key:"section_id",label:"Section"},{key:"taken_by",label:"Taken by"}]}
};
export default async function ModulePage({params}:{params:Promise<{module:string}>}) { const {module}=await params; const item=config[module] ?? {table:"departments",title:"Departments",columns:[{key:"code",label:"Code"},{key:"name",label:"Name"}]}; const {data}=await (await createClient()).from(item.table).select("*").limit(100); return <><PageHeader title={item.title} description="Operational records from the university system."/><DataTable rows={(data ?? []) as unknown as Record<string,unknown>[]} columns={item.columns} empty={`No ${item.title.toLowerCase()} records are available.`}/></>; }
