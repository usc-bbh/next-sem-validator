import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarRange, hasTime, toMin } from "./calendarRange.js";

const sec = (days, start_time, end_time) => ({ days, start_time, end_time });

test("no picks: Mon–Fri, 8 am to 9 pm", () => {
  assert.deepEqual(calendarRange([]), { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], dayStart: 480, dayEnd: 1260 });
});

// The calendar had a Saturday but no Sunday, so BUCO 537 (Sun 9–4) never showed.
test("a Sunday section adds Sunday", () => {
  assert.deepEqual(calendarRange([sec(["Sun"], "09:00", "16:00")]).days, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sun"]);
});

test("a Fri+Sat section adds Saturday, and Sat sits before Sun", () => {
  const { days } = calendarRange([sec(["Fri", "Sat"], "09:30", "14:30"), sec(["Sun"], "09:00", "16:00")]);
  assert.deepEqual(days, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});

test("early and late sections widen the hours to the whole hour", () => {
  const r = calendarRange([sec(["Mon"], "06:30", "07:50"), sec(["Tue"], "19:00", "22:20")]);
  assert.equal(r.dayStart, 6 * 60);
  assert.equal(r.dayEnd, 23 * 60);
});

// 100 catalog sections have "TBD" times, which used to come through as NaN.
test("TBA and TBD sections aren't placed and don't change the range", () => {
  for (const t of ["TBA", "TBD", null, ""]) {
    assert.equal(toMin(t), null);
    assert.equal(hasTime(sec(["Sat"], t, t)), false);
    assert.deepEqual(calendarRange([sec(["Sat"], t, t)]).days, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  }
});
