import { carbonQuery } from "../integrations/supabase/client";

export interface CalendarSlot {
  time: string;
  label: string;
  available: boolean;
  bookedCount: number;
  capacity: number;
  jobs: any[];
}

export interface DaySchedule {
  date: string;
  dayName: string;
  dayNumber: string;
  isToday: boolean;
  slots: CalendarSlot[];
}

const STANDARD_SLOTS = [
  "08:00 AM",
  "10:00 AM",
  "12:30 PM",
  "03:00 PM",
  "05:00 PM",
];

export async function buildHqWeekMatrix(startDateStr?: string, activeContractors = 2): Promise<DaySchedule[]> {
  const base = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  let jobs: any[] = [];
  try {
    jobs = await carbonQuery("SELECT * FROM public.ecmd_crm_jobs ORDER BY created_at DESC LIMIT 250;");
  } catch {
    jobs = [];
  }

  const days: DaySchedule[] = [];
  const todayIso = new Date().toISOString().split("T")[0] || "";

  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dateIso = d.toISOString().split("T")[0] || "";
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const dayNumber = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const dayJobs = jobs.filter((j) => {
      const jDate = (j.scheduled_date || j.job_date || j.date || "").toString().slice(0, 10);
      return jDate === dateIso && (j.status || "").toLowerCase() !== "cancelled";
    });

    const slots: CalendarSlot[] = STANDARD_SLOTS.map((slotTime) => {
      const slotJobs = dayJobs.filter(
        (j) => (j.scheduled_time || j.time_slot || "08:00 AM") === slotTime
      );
      return {
        time: slotTime,
        label: slotTime,
        bookedCount: slotJobs.length,
        capacity: activeContractors,
        available: slotJobs.length < activeContractors,
        jobs: slotJobs,
      };
    });

    days.push({
      date: dateIso,
      dayName,
      dayNumber,
      isToday: dateIso === todayIso,
      slots,
    });
  }

  return days;
}