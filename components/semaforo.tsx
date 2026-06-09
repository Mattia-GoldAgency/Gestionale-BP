import type { Semaforo } from "@/lib/backend";

const MAP: Record<Semaforo, { color: string; label: string }> = {
  verde: { color: "var(--verde)", label: "Verde" },
  giallo: { color: "var(--giallo)", label: "Giallo" },
  rosso: { color: "var(--rosso)", label: "Rosso" },
};

export function SemaforoBadge({ value }: { value: Semaforo | null }) {
  if (!value) return null;
  const m = MAP[value];
  return (
    <span
      className="badge"
      style={{ background: `color-mix(in srgb, ${m.color} 14%, white)`, color: m.color }}
    >
      <span className="dot" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
