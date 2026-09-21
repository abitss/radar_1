export function publicRadarError(error:unknown,fallback="RADAR could not complete this operation. Please retry.") {
  console.error("RADAR operation failed",error);
  const message=error instanceof Error?error.message:"";
  if(/rate.limit|credits|quota|429|timeout|model.*exist|fetch failed/i.test(message))return "A discovery or AI provider is temporarily unavailable. Please retry shortly.";
  return fallback;
}
