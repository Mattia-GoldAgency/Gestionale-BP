export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1">
      <div
        className="badge"
        style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
      >
        Studio Notarile Busani &amp; Partners
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mt-2">
        Atti di Mutuo
      </h1>
      {subtitle ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
