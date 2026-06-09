import Image from "next/image";

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <Image
        src="/logo-busani.svg"
        alt="Studio Notarile Busani &amp; Partners"
        width={587}
        height={567}
        priority
        className="h-auto w-[150px]"
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Atti di Mutuo</h1>
        {subtitle ? (
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
