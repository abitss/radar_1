import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MoveDetail, PageIntro } from "@/components/intelligence-ui";

export default function MoveDetailPage() {
  return <div className="content"><PageIntro eyebrow="RADAR MOVE · CONFIRMED" title="Enterprise expansion" description="A connected strategic pattern with evidence, interpretation, impact and a recommended response." action={<Link href="/moves" className="secondary-button"><ArrowLeft size={14} /> Back to Moves</Link>} /><MoveDetail /></div>;
}
