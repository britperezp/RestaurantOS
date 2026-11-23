import WorkspacePageShell from "../workspace-page-shell";
import PurchasingModule from "./purchasing-module";

export default function PurchasingPage() {
  return (
    <WorkspacePageShell activeRoute="purchasing" title="Suppliers & purchasing">
      <PurchasingModule />
    </WorkspacePageShell>
  );
}
