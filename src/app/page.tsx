import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const phases = [
  { phase: "Phase 0", label: "Scaffold", state: "done" },
  { phase: "Phase 1", label: "Auth + RBAC", state: "next" },
  { phase: "Phase 2", label: "Editor + Templates", state: "todo" },
  { phase: "Phase 3", label: "Approval routing", state: "todo" },
  { phase: "Phase 4", label: "PDF + signatures", state: "todo" },
  { phase: "Phase 5", label: "Audit + escalation", state: "todo" },
  { phase: "Phase 6", label: "Chat + archive", state: "todo" },
  { phase: "Phase 7", label: "Polish + extras", state: "todo" },
];

const stateVariant: Record<string, "default" | "secondary" | "outline"> = {
  done: "default",
  next: "secondary",
  todo: "outline",
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">College of Computer Studies</p>
        <h1 className="text-4xl font-semibold tracking-tight">DocuTrail</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Digital document lifecycle, routing, and audit system. Every document, every approval,
          every action — traceable.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Project status</CardTitle>
          <CardDescription>
            Scaffold is live. Next: configure Supabase, then wire up authentication and RBAC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {phases.map((p) => (
              <li key={p.phase} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{p.phase}</div>
                  <div className="text-sm text-muted-foreground">{p.label}</div>
                </div>
                <Badge variant={stateVariant[p.state]}>{p.state}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
