// Which days and hours the week calendar shows. Mon–Fri, 8 am–9 pm by default.
// A picked section on a Saturday or Sunday adds that day (the Spring 2027
// catalog has 18 Saturday and 3 Sunday sections), and one outside the hours
// widens them to the whole hour. Sections with no real time (TBA, TBD) aren't
// placed on the calendar at all.
export const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS = WEEK.slice(0, 5);
export const DEFAULT_START = 8 * 60;
export const DEFAULT_END = 21 * 60;

export const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const hasTime = (s) => toMin(s.start_time) != null && toMin(s.end_time) != null && s.days?.length > 0;

export function calendarRange(blocks) {
  const timed = blocks.filter(hasTime);
  const days = WEEK.filter((d) => WEEKDAYS.includes(d) || timed.some((b) => b.days.includes(d)));
  let dayStart = DEFAULT_START;
  let dayEnd = DEFAULT_END;
  for (const b of timed) {
    dayStart = Math.min(dayStart, Math.floor(toMin(b.start_time) / 60) * 60);
    dayEnd = Math.max(dayEnd, Math.ceil(toMin(b.end_time) / 60) * 60);
  }
  return { days, dayStart, dayEnd };
}
