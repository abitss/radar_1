// Drive the existing recurring-task API while this Render process is awake.
// A sleeping free service still requires an external authenticated wake-up call.
export async function register() {
  if(process.env.NEXT_RUNTIME!=="nodejs"||process.env.NEXT_PHASE==="phase-production-build")return;
  if(process.env.RADAR_MAINTENANCE_ENABLED?.toLowerCase()==="false"||!process.env.RADAR_API_SECRET)return;
  const state=globalThis as typeof globalThis & {radarMaintenanceTimer?:ReturnType<typeof setInterval>};
  if(state.radarMaintenanceTimer)return;
  let running=false;
  const tick=async()=>{
    if(running)return;running=true;
    try{
      const response=await fetch(`http://127.0.0.1:${process.env.PORT||3000}/api/radar/system-maintenance`,{
        method:"POST",headers:{"x-radar-cron-secret":process.env.RADAR_CRON_SECRET||process.env.RADAR_API_SECRET||""},
        signal:AbortSignal.timeout(25*60*1000),cache:"no-store"
      });
      if(!response.ok||!response.headers.get("content-type")?.includes("application/json"))console.error("RADAR maintenance returned",response.status);
    }catch(error){console.error("RADAR maintenance could not complete",error instanceof Error?error.message:"request failed");}
    finally{running=false;}
  };
  state.radarMaintenanceTimer=setInterval(()=>{void tick();},5*60*1000);
  state.radarMaintenanceTimer.unref();
  const first=setTimeout(()=>{void tick();},30000);first.unref();
}
