// Loader "leggero" con penna animata + barra indeterminata, riusato dove un
// lavoro sincrono (es. generazione atto) non espone una percentuale reale.
// Stessa estetica del modulo Traduzioni (animazione penna che scrive).

export function PennaLoader({
  label = "Elaborazione in corso…",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-4 py-4 max-w-md">
      <div className="flex items-center gap-3">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pen"
          style={{ color: "var(--brand-blue, #1d4ed8)" }}
        >
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="1.5" />
        </svg>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {label}
        </span>
      </div>

      <style>{`
        @keyframes pen-write {
          0%, 100% { transform: rotate(-15deg) translateY(0); }
          50% { transform: rotate(-3deg) translateY(-2px); }
        }
        .animate-pen { animation: pen-write 0.45s ease-in-out infinite; transform-origin: bottom left; }
        @keyframes bar-indef {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        .bar-indef { animation: bar-indef 1.1s ease-in-out infinite; }
      `}</style>

      <div className="w-full h-2 bg-gray-100 rounded relative overflow-hidden">
        <div
          className="bar-indef absolute top-0 h-full w-2/5 rounded"
          style={{ background: "var(--brand-blue, #1d4ed8)" }}
        />
      </div>
    </div>
  );
}
