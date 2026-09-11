"use client";

import Link from "next/link";
import { ArrowRight, CircleAlert, Radar, ShieldCheck, Users, WalletCards } from "lucide-react";
import { motion } from "framer-motion";

const priorities = [
  { rank:"01", title:"Talk to the 5 users who stopped using the product", reason:"Retention weakened in the newest cohort. This is more important than adding another acquisition channel.", href:"/customers" },
  { rank:"02", title:"Review competitor enterprise move", reason:"Three independent signals suggest a direct competitor is moving toward larger institutional buyers.", href:"/market" },
  { rank:"03", title:"Choose a runway plan before next hiring decision", reason:"Current burn leaves enough time to act, but not enough time to ignore capital planning.", href:"/money" },
];

export default function Home(){
  return <div className="content founder-today">
    <motion.div className="founder-today-head" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
      <div><span>FOUNDER BRIEF · TODAY</span><h1>Here’s what can change your company.</h1><p>RADAR removes everything that does not deserve founder attention.</p></div>
      <div className="founder-status"><ShieldCheck size={18}/><span><strong>Company pulse</strong><small>3 things need attention</small></span></div>
    </motion.div>

    <section className="founder-survival-grid">
      <Link href="/customers" className="panel survival-card"><Users/><span>CUSTOMER TRUTH</span><strong>Needs proof</strong><small>4-week retention: 62%</small></Link>
      <Link href="/market" className="panel survival-card"><Radar/><span>MARKET</span><strong>1 major move</strong><small>12 new signals</small></Link>
      <Link href="/money" className="panel survival-card"><WalletCards/><span>RUNWAY</span><strong>11.4 months</strong><small>Plan raise in ~5 months</small></Link>
      <Link href="/decisions" className="panel survival-card"><CircleAlert/><span>DECISIONS</span><strong>3 open</strong><small>1 should be made this week</small></Link>
    </section>

    <section className="founder-command-grid">
      <article className="panel founder-priorities">
        <div className="founder-panel-head"><div><span>WHAT TO DO NEXT</span><h2>Founder priorities</h2></div><small>Ranked by survival impact</small></div>
        <div className="founder-priority-list">{priorities.map((p)=><Link href={p.href} key={p.rank}><span>{p.rank}</span><div><strong>{p.title}</strong><small>{p.reason}</small></div><ArrowRight size={15}/></Link>)}</div>
      </article>

      <article className="panel founder-dark-panel founder-why-now">
        <span>WHY THIS MATTERS</span>
        <h2>Don’t let the loudest problem become the strategy.</h2>
        <p>RADAR should keep founders focused on leading indicators: customer pull, runway, market movement and the decisions that compound.</p>
        <Link href="/ask">Ask RADAR what I should do today <ArrowRight size={14}/></Link>
      </article>
    </section>

    <section className="panel founder-weekly-score">
      <div><span>THIS WEEK</span><h2>Company health</h2></div>
      <div className="founder-health-item"><span>Customer pull</span><strong>58</strong><i style={{width:"58%"}}/></div>
      <div className="founder-health-item"><span>Market position</span><strong>74</strong><i style={{width:"74%"}}/></div>
      <div className="founder-health-item"><span>Financial survival</span><strong>68</strong><i style={{width:"68%"}}/></div>
      <div className="founder-health-item"><span>Execution</span><strong>81</strong><i style={{width:"81%"}}/></div>
    </section>
  </div>
}
