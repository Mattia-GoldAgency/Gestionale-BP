import Link from "next/link";

export const metadata = {
  title: "Informativa Privacy — Gestionale Busani & Partners",
};

// NB: testo base. Da far validare al DPO/referente privacy dello Studio prima
// della pubblicazione definitiva.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link href="/login" className="text-sm" style={{ color: "var(--muted)" }}>
        ← Torna al login
      </Link>
      <h1 className="text-2xl mt-4 mb-2">Informativa sul trattamento dei dati</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Studio Notarile Busani &amp; Partners — applicazione interna “Gestionale Busani &amp; Partners”.
      </p>

      <div className="card p-6 flex flex-col gap-4 text-sm leading-relaxed">
        <Sezione titolo="Titolare del trattamento">
          Studio Notarile Busani &amp; Partners. Per l&apos;esercizio dei diritti:
          contattare il referente privacy/DPO dello Studio.
        </Sezione>
        <Sezione titolo="Dati trattati e finalità">
          L&apos;applicazione tratta i dati personali contenuti nella Relazione
          Notarile Preliminare (RNP) e nella minuta della banca (anagrafiche,
          codici fiscali, dati patrimoniali e contrattuali) al solo fine di
          assistere la redazione dell&apos;atto di mutuo. La base giuridica è
          l&apos;esecuzione del mandato professionale e gli obblighi di legge in
          capo al notaio.
        </Sezione>
        <Sezione titolo="Responsabili e sub-responsabili">
          I dati sono ospitati su infrastrutture cloud in Unione Europea:
          <ul className="list-disc ml-5 mt-1">
            <li>Supabase (database, autenticazione, archiviazione file) — region UE;</li>
            <li>Vercel (hosting dell&apos;applicazione);</li>
            <li>
              Anthropic (estrazione strutturata dei dati tramite Claude), con
              opzione zero-retention: i dati non vengono conservati né usati per
              l&apos;addestramento.
            </li>
          </ul>
          Con ciascun fornitore è (o sarà) stipulato un accordo sul trattamento
          dei dati (DPA) ai sensi dell&apos;art. 28 GDPR.
        </Sezione>
        <Sezione titolo="Conservazione (retention)">
          I documenti caricati e l&apos;atto generato sono cancellati
          automaticamente dai sistemi dopo il periodo impostato dallo Studio
          (predefinito: 15 giorni). I metadati della pratica e il registro di
          audit sono conservati per finalità di conformità.
        </Sezione>
        <Sezione titolo="Misure di sicurezza">
          Accesso riservato ai soli collaboratori autorizzati con credenziali
          individuali e cambio password obbligatorio al primo accesso;
          segregazione dei dati per utente; registro permanente degli accessi e
          delle operazioni; cifratura at-rest e in transito a livello di
          infrastruttura.
        </Sezione>
        <Sezione titolo="Diritti dell'interessato">
          Gli interessati possono esercitare i diritti di accesso, rettifica,
          cancellazione, limitazione e opposizione (artt. 15-22 GDPR)
          rivolgendosi allo Studio. L&apos;applicazione consente la cancellazione
          puntuale di una pratica e dei relativi file.
        </Sezione>
      </div>
    </main>
  );
}

function Sezione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base mb-1">{titolo}</h2>
      <div style={{ color: "var(--foreground)" }}>{children}</div>
    </div>
  );
}
