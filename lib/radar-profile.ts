export const COMPANY_BRAIN_FIELDS = [
  "name","description","industry","sub_category","problem_statement","target_customers","buyer",
  "product_keywords","major_features","capability_keywords","technology_keywords","geography","business_model",
  "pricing_context","positioning","public_team_facts","founder_goal"
] as const;

function words(value:unknown){
  if(Array.isArray(value))return value.map(String).map(x=>x.trim()).filter(Boolean);
  return String(value||"").split(/[,;|\n]/).map(x=>x.trim()).filter(Boolean);
}

export function companyBrainReadiness(workspace:any){
  const name=String(workspace?.name||"").trim();
  const description=String(workspace?.description||"").trim();
  const problem=String(workspace?.problem_statement||"").trim();
  const customers=String(workspace?.target_customers||"").trim();
  const industry=String(workspace?.industry||workspace?.sub_category||"").trim();
  const products=words(workspace?.product_keywords);
  const capabilities=[...words(workspace?.major_features),...words(workspace?.capability_keywords)];

  const checks={
    name:Boolean(name&&name.toLowerCase()!=="my startup"),
    description:Boolean(description.length>=20),
    problem:Boolean(problem.length>=20),
    customers:Boolean(customers.length>=3),
    market:Boolean(industry.length>=2),
    product:Boolean(products.length||capabilities.length),
  };
  const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return{ready:missing.length===0,missing,checks};
}

export function companyBrainChanged(previous:any,next:any){
  return COMPANY_BRAIN_FIELDS.some(key=>JSON.stringify(previous?.[key]??null)!==JSON.stringify(next?.[key]??null));
}

export function companyBrainSummary(workspace:any){
  return{
    name:workspace?.name||null,
    website:workspace?.website||null,
    description:workspace?.description||null,
    industry:workspace?.industry||null,
    sub_category:workspace?.sub_category||null,
    problem_statement:workspace?.problem_statement||null,
    target_customers:workspace?.target_customers||null,
    buyer:workspace?.buyer||null,
    product_keywords:words(workspace?.product_keywords).slice(0,40),
    major_features:words(workspace?.major_features).slice(0,40),
    capability_keywords:words(workspace?.capability_keywords).slice(0,40),
    technology_keywords:words(workspace?.technology_keywords).slice(0,40),
    geography:workspace?.geography||null,
    business_model:workspace?.business_model||null,
    pricing_context:workspace?.pricing_context||null,
    positioning:workspace?.positioning||null,
    founder_goal:workspace?.founder_goal||null,
  };
}
