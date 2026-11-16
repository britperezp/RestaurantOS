import WorkspacePageShell from "../workspace-page-shell";
import WasteAlertsModule from "./waste-alerts-module";

export default function WastePage() {
  return (
    <WorkspacePageShell activeRoute="waste" title="Waste alerts">
      <section className="welcome-row" aria-labelledby="page-title">
        <div><p className="eyebrow">BAR SIENA <span className="eyebrow-dot">·</span> WASTE CONTROL</p><h1 id="page-title">Waste alerts<span className="title-period">.</span></h1><p className="welcome-subtitle">Potential loss to review today.</p></div>
      </section>
      <WasteAlertsModule />
    </WorkspacePageShell>
  );
}