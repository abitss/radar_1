import { PageIntro, SimpleCollection } from "@/components/intelligence-ui";
import { StartupProfileForm } from "@/components/startup-profile-form";

export default function SettingsPage(){
  return <div className="content">
    <PageIntro eyebrow="WORKSPACE CONTROL" title="Settings" description="Define your startup, then manage workspace preferences, alerts and integrations."/>
    <StartupProfileForm/>
    <div style={{height:13}}/>
    <SimpleCollection kind="settings"/>
  </div>
}
