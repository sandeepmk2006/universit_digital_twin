import { MessageSquare } from "lucide-react";
import { Chat } from "@/components/chat";
import { SectionHeader } from "@/components/section";
import { getProfile } from "@/lib/data";

// Starter questions that the context for each role can actually answer.
const SUGGESTIONS: Record<string, string[]> = {
  student: [
    "When do I have classes tomorrow?",
    "Which course has my lowest attendance?",
    "How many marks do I have so far in each subject?",
    "When is my next exam?",
    "Do I have any fee dues?",
  ],
  faculty: [
    "What is my teaching timetable this week?",
    "Which of my students are at risk?",
    "Are there leave requests waiting for me?",
  ],
  hod: [
    "How is attendance across departments?",
    "How many students are at high risk?",
    "How many grievances are open for my office?",
  ],
  warden: ["How full are my residences?", "How many complaints are open?", "What are the hostel rules?"],
  accountant: ["How many invoices are unpaid or partial?", "Summarise the fee status."],
  placement_officer: ["List the recent placement drives.", "Which drives offered the highest package?"],
  librarian: ["How many books are on loan?", "What are the library rules?"],
  admin: [
    "Give me an overview of the institution today.",
    "Which department has the lowest attendance?",
    "How many students are at high risk?",
  ],
};

export default async function AssistantPage() {
  const profile = await getProfile();
  const role = String(profile?.role ?? "student");
  const first = String(profile?.full_name ?? "").replace(/^Dr\.\s*/, "").split(" ")[0];
  return (
    <>
      <SectionHeader
        icon={<MessageSquare size={22} />}
        title="Assistant"
        subtitle="Answers from your own records and the university handbook. It only sees what your login can see."
      />
      <Chat
        storageKey={`edubase-chat-${profile?.id ?? "anon"}`}
        greeting={`Hi ${first || "there"}, ask me about your timetable, attendance, marks, fees, hostel or campus rules.`}
        suggestions={SUGGESTIONS[role] ?? ["What can you help me with?", "What are the campus rules?"]}
      />
    </>
  );
}
