// Who may change what. Reads are governed by ACCESS (lib/roles) and the database's
// RLS; this adds write permission — create, edit, delete — per module, and the shape
// of the form used to add or edit a record. The database still has the final say.

import type { Role } from "@/lib/roles";

export type FieldType = "text" | "number" | "textarea" | "date" | "datetime" | "select" | "tags";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
};

export type WriteSpec = {
  table: string;
  label: string; // singular, e.g. "event"
  writers: Role[]; // admin is always allowed in addition to these
  titleField: string;
  fields: Field[];
};

export const WRITABLE: Record<string, WriteSpec> = {
  events: {
    table: "events",
    label: "event",
    writers: [],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "starts_at", label: "Starts", type: "datetime", required: true },
      { name: "ends_at", label: "Ends", type: "datetime", required: true },
      { name: "capacity", label: "Capacity", type: "number" },
    ],
  },
  clubs: {
    table: "clubs",
    label: "club",
    writers: [],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "category",
        label: "Category",
        type: "text",
        required: true,
        help: "technical, cultural, social…",
      },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
  sports: {
    table: "sports_facilities",
    label: "facility",
    writers: [],
    titleField: "name",
    fields: [
      { name: "name", label: "Facility", type: "text", required: true },
      { name: "sport", label: "Sport", type: "text", required: true },
      { name: "capacity", label: "Capacity", type: "number" },
    ],
  },
  library: {
    table: "books",
    label: "book",
    writers: ["librarian"],
    titleField: "title",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "authors", label: "Authors", type: "tags", required: true, help: "comma separated" },
      { name: "isbn", label: "ISBN", type: "text" },
      { name: "publisher", label: "Publisher", type: "text" },
      { name: "year", label: "Year", type: "number" },
      { name: "subjects", label: "Subjects", type: "tags", help: "comma separated" },
    ],
  },
  health: {
    table: "medicine_stock",
    label: "medicine",
    writers: ["doctor"],
    titleField: "name",
    fields: [
      { name: "name", label: "Medicine", type: "text", required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "reorder_at", label: "Reorder at", type: "number", required: true },
      { name: "expires_on", label: "Expires on", type: "date" },
    ],
  },
  transport: {
    table: "buses",
    label: "bus",
    writers: ["transport_manager"],
    titleField: "registration",
    fields: [
      { name: "registration", label: "Registration", type: "text", required: true },
      { name: "capacity", label: "Seats", type: "number", required: true },
      { name: "driver_name", label: "Driver", type: "text" },
      { name: "driver_phone", label: "Driver phone", type: "text" },
    ],
  },
  hostel: {
    table: "hostels",
    label: "hostel",
    writers: ["warden"],
    titleField: "name",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      {
        name: "gender",
        label: "Gender",
        type: "select",
        required: true,
        options: ["male", "female", "mixed"],
      },
      { name: "capacity", label: "Capacity", type: "number", required: true },
    ],
  },
};

export function canWrite(role: string | null | undefined, module: string): boolean {
  const spec = WRITABLE[module];
  if (!spec || !role) return false;
  return role === "admin" || spec.writers.includes(role as Role);
}
