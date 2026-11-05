// What the result banner shows. Every schedule-wide warning goes in one list
// under it: the validator's own (unit overload, courses not in the catalog)
// plus the low unit count, which only the page computes. A warning there means
// the banner can't read "looks good".
export const lowUnitsMessage = (units) =>
  `${units} units is below the typical full-time minimum of 12. Most students take 12–18 units. Check with your advisor if this is intentional.`;

export const isLowUnits = (units, courseCount) => courseCount > 0 && units > 0 && units < 12;

export function resultSummary(result, units, courseCount) {
  if (!result) return { status: null, warnings: [] };
  const warnings = [
    ...(isLowUnits(units, courseCount) ? [`Low unit count: ${lowUnitsMessage(units)}`] : []),
    ...result.summary.warnings,
  ];
  const status = result.overall_status === "valid" && warnings.length > 0 ? "warning" : result.overall_status;
  return { status, warnings };
}
