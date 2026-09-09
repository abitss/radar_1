import { AskRadar, PageIntro } from "@/components/intelligence-ui";

export default function AskPage() {
  return <div className="content"><PageIntro eyebrow="CONVERSATIONAL INTELLIGENCE" title="Ask RADAR" description="Query the strategic memory of your company instead of starting from a blank chatbot." /><AskRadar /></div>;
}
