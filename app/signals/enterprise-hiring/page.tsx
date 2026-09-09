import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageIntro, SignalDetail } from "@/components/intelligence-ui";

export default function SignalDetailPage() {
  return <div className="content"><PageIntro eyebrow="SIGNAL DETAIL" title="Why this matters" description="Evidence, interpretation and connected strategic context for a single market change." action={<Link href="/signals" className="secondary-button"><ArrowLeft size={14} /> Back to Signals</Link>} /><SignalDetail /></div>;
}
