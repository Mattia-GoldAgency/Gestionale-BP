"use client";

import { usePathname } from "next/navigation";

export function PageTitle() {
  const pathname = usePathname() || "";
  
  let title = "Area di Lavoro";
  if (pathname.startsWith("/mutui")) title = "Mutui";
  else if (pathname.startsWith("/scrittura-atti")) title = "Scrittura atti";
  else if (pathname.startsWith("/storico")) title = "Storico pratiche";
  else if (pathname.startsWith("/admin")) title = "Amministrazione";
  else if (pathname.startsWith("/pratica")) title = "Dettaglio Pratica";
  else if (pathname.startsWith("/traduzioni")) title = "Traduzioni e Trascrizioni testo";

  return <h1 className="font-title font-bold text-2xl text-[var(--brand-blue)]">{title}</h1>;
}
