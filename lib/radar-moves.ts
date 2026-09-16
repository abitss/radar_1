import { sbInsert, sbSelect, sbUpdate } from "@/lib/radar-db";

const PATTERNS=[
  {type:"ENTERPRISE_EXPANSION",title:"Enterprise expansion appears to be forming",categories:["hiring_signal","partnership","customer_announcement","pricing_change","packaging_change","new_geography","feature_added"],words:["enterprise","salesforce","soc 2","soc2","fortune 500","vp sales","enterprise sales"]},
  {type:"AI_PRODUCT_PUSH",title:"AI product acceleration appears to be forming",categories:["feature_added","product_launch","hiring_signal","technology_signal","partnership"],words:[" ai ","artificial intelligence","machine learning","agent","llm","copilot"]},
  {type:"NEW_GEOGRAPHY",title:"Geographic expansion appears to be forming",categories:["new_geography","hiring_signal","partnership","customer_announcement"],words:["launch in","expansion","country","region","local team","market entry"]},
  {type:"PRICE_STRATEGY_SHIFT",title:"Pricing strategy is shifting",categories:["pricing_change","packaging_change","positioning_change"],words:["price","pricing","free plan","tier","package","discount"]},
  {type:"PRODUCT_EXPANSION",title:"Product expansion is accelerating",categories:["product_launch","feature_added","technology_signal","product_listing_change","partnership"],words:["launch","new product","new feature","integration","platform"]},
  {type:"GTM_ACCELERATION",title:"Go-to-market acceleration appears to be forming",categories:["hiring_signal","advertising_campaign","partnership","customer_announcement","positioning_change"],words:["sales","marketing","campaign","partner","customer","go-to-market","gtm"]},
];

function evidenceWeight(signals:any[],pattern:any){const categoryHits=new Set(signals.filter(s=>pattern.categories.includes(s.signal_type)).map(s=>s.signal_type)).size;const text=signals.map(s=>`${s.title||""} ${s.summary||""}`.toLowerCase()).join(" ");const wordHits=pattern.words.filter((w:string)=>text.includes(w.trim())).length;return{categoryHits,wordHits,score:categoryHits*22+wordHits*9}}

export async function detectMovesForWorkspace(workspaceId:string){
  const competitors=await sbSelect(`radar_competitors?workspace_id=eq.${workspaceId}&select=id,name,website&limit=200`);
  let changed=0;
  for(const company of competitors){
    const signals=await sbSelect(`radar_signals?workspace_id=eq.${workspaceId}&competitor_id=eq.${company.id}&select=*&order=observed_at.desc&limit=80`);
    if(signals.length<2)continue;
    for(const pattern of PATTERNS){
      const matching=signals.filter((s:any)=>pattern.categories.includes(s.signal_type)||pattern.words.some((w:string)=>`${s.title||""} ${s.summary||""}`.toLowerCase().includes(w.trim()))).slice(0,12);
      const weights=evidenceWeight(matching,pattern);
      if(matching.length<2||weights.categoryHits<2||weights.score<55)continue;
      const avgConfidence=Math.round(matching.reduce((a:number,s:any)=>a+Number(s.confidence||50),0)/matching.length);
      const avgImpact=Math.round(matching.reduce((a:number,s:any)=>a+Number(s.impact_score||50),0)/matching.length);
      const impact=Math.min(98,Math.round(avgImpact*.72+weights.score*.28));
      const confidence=Math.min(96,Math.round(avgConfidence*.72+Math.min(100,weights.score)*.28));
      const rationale=`${matching.length} related signals across ${weights.categoryHits} independent signal categories are moving in the same strategic direction.`;
      const summary=`${company.name} shows a clustered pattern consistent with ${pattern.title.toLowerCase()}. RADAR is combining weak signals instead of treating each event as an isolated alert.`;
      const status=confidence>=85&&weights.categoryHits>=3?"confirmed":"watching";
      const existing=await sbSelect(`radar_moves?workspace_id=eq.${workspaceId}&competitor_id=eq.${company.id}&move_type=eq.${pattern.type}&status=in.(watching,confirmed)&select=*&order=updated_at.desc&limit=1`);
      let move:any;
      if(existing[0]){const rows=await sbUpdate("radar_moves",`id=eq.${existing[0].id}`,{summary,rationale,confidence,impact_score:impact,status,last_evidence_at:matching[0]?.observed_at||new Date().toISOString(),updated_at:new Date().toISOString()});move=rows[0]||existing[0];}
      else{const rows=await sbInsert("radar_moves",{workspace_id:workspaceId,competitor_id:company.id,move_type:pattern.type,title:pattern.title,summary,rationale,confidence,impact_score:impact,status,recommended_action:"Review the supporting evidence, compare it with your current strategy, and increase monitoring around the strongest confirming indicators.",last_evidence_at:matching[0]?.observed_at||new Date().toISOString()});move=rows[0];}
      if(move?.id){
        const linked=await sbSelect(`radar_move_signals?move_id=eq.${move.id}&select=signal_id`);const linkedSet=new Set(linked.map((x:any)=>x.signal_id));
        const rows=matching.filter((s:any)=>!linkedSet.has(s.id)).map((s:any)=>({move_id:move.id,signal_id:s.id,contribution:Math.max(40,Math.min(100,Math.round((Number(s.impact_score||50)+Number(s.confidence||50))/2)))}));
        if(rows.length)await sbInsert("radar_move_signals",rows);
      }
      changed++;
    }
  }
  return{moves:changed};
}
