export type Profile = { id: string; full_name: string; email: string; role: string };
export type Student = {
  id: string;
  roll_no: string;
  full_name: string;
  email: string;
  batch_year: number;
  current_semester: number;
  cgpa: number | null;
  status: string;
  program_id: string;
};
export type Faculty = {
  id: string;
  employee_no: string;
  full_name: string;
  email: string;
  designation: string;
  max_weekly_hours: number;
  department_id: string;
  is_active: boolean;
};
export type Prediction = {
  student_id: string;
  predicted_gpa: number;
  risk_level: "low" | "medium" | "high";
  factors: Record<string, unknown>;
  created_at: string;
};
export type Row = Record<string, unknown>;
