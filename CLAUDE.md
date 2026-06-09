# Atti di Mutuo — Frontend Web (Studio Notarile Busani & Partners)

Web app per la generazione assistita degli atti di mutuo da **RNP + minuta banca**.
Repo **separato** dal motore Python `atto_core` (che sta nel progetto OneDrive
`MutuiB&P`). Questo è il layer utente: login, upload, raccolta dati mancanti,
download `.docx`, area admin.

- **Live**: https://mutui-web.vercel.app
- **Repo**: github.com/Mattia-GoldAgency/MutuiB-P (auto-deploy su push a `main`)
- **Path locale**: `C:\Users\pc42\mutui-web` (fuori da OneDrive e dal path con `&`)

## Stack
Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind v4 ·
Supabase (Auth/Postgres/Storage) · Vercel · jszip (mock .docx).

## Struttura & file chiave
```
app/
  login/            login + server action signIn (audit login)
  cambia-password/  cambio password obbligatorio al 1° accesso
  dashboard/        upload pratica (RNP+minuta+notaio+data) -> creaPratica
  pratica/[id]/     dettaglio, generazione, eliminazione (oblio); dati-mancanti/
  admin/            gestione utenti (CRUD) + impostazioni + registro audit
  privacy/          informativa pubblica
  api/pratica/[id]/download/  download .docx (auth + audit)
  api/cron/retention/         cron retention (protetto da CRON_SECRET)
lib/
  supabase/{client,server,admin,middleware}.ts  client browser/server/service-role
  backend.ts        contratto verso atto_core (POST /api/estrai, /api/genera) + MOCK
  docx.ts           costruzione .docx OOXML (mock)
  notai.ts          i 3 notai (Busani, Mannella, Ridella)
  data-stipula.ts   data in lettere "L'anno ..., il giorno ... del mese di ..."
  roles.ts          ruoli admin/collaboratore + ADMIN_EMAILS
  audit.ts          logAudit (service-role, server-only)
  password.ts       generatore password
  types.ts          Pratica, bucket, mimePerFile
proxy.ts            ex-middleware: refresh sessione + guardia rotte
supabase/migrations/  0001 pratiche+storage · 0002 app_settings · 0003 audit_log
```

## Servizi (riferimenti)
- **Supabase**: progetto `mutui-bp`, ref `npcigqtbemtboxbbnovp`, region eu-west-1.
  Tabelle: `pratiche` (RLS per-utente), `app_settings`, `audit_log` (solo service_role).
  Bucket privati: `documenti`, `atti`.
- **Vercel**: progetto `mutui-web`, team `mattia-goldagencys-projects`. Env: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET. Cron giornaliero 03:00 UTC.
- **Utenti**: 1 admin (mattia.bottoni@notaio-busani.it) + 15 collaboratori @notaio-busani.it, tutti con cambio password al 1° accesso.

## Contratto col backend Python
Unico punto di accoppiamento: `lib/backend.ts`. Se `BACKEND_URL` è vuoto → MOCK
(simula campi mancanti tasso+durata, genera .docx fittizio). Endpoint attesi:
`POST /api/estrai` → `{campiMancanti[],bancaRiconosciuta,semaforoPreliminare}`;
`POST /api/genera` → `{docBase64,nomeFile,coverage,semaforo,reportValidazione}`.

## TODO / Prossimi passi
- [ ] **Utente**: revocare i vecchi token Vercel (vcp_) e Supabase (sbp_) — ancora attivi.
- [ ] **DPO**: firmare DPA con Vercel, Supabase, Anthropic (zero-retention); validare testo `/privacy`; registro trattamenti.
- [ ] Integrare backend reale: impostare `BACKEND_URL` (+`BACKEND_API_KEY`) su Vercel.
- [ ] Verificare trascrizione email da screenshot (es. `dania.veluti`, `fabiana.longobucco`).
- [ ] (Opz.) Email-tipo di primo accesso per i collaboratori.
- [ ] (Opz.) Pagina elenco pratiche completa; rifinire convenzione data (1° = "primo" vs "uno", definita dal backend).

## Auto-correzioni (lezioni da non ripetere)
- **Path con `&`** (`MutuiB&P`) rompe gli script Node/Next su Windows (cmd.exe tratta `&` come separatore) → tenere il progetto in un path senza `&` e fuori da OneDrive (node_modules non va su OneDrive).
- **Next 16**: `middleware.ts` è deprecato → usare `proxy.ts` con funzione `proxy`.
- **Le rotte `/api/*` NON devono passare dal proxy auth** (altrimenti 307→/login prima del handler) → escluse dal matcher; gestiscono l'auth da sole (download→401, cron→CRON_SECRET).
- **`NEXT_PUBLIC_*` sono inlined al build** → impostarle su Vercel PRIMA del deploy.
- **Creare un nuovo token Vercel/Supabase NON revoca il vecchio** → va eliminato esplicitamente.
- **Azioni con parametri inferiti** (es. lista email da screenshot, creazione account reali) → confermare SEMPRE con l'utente prima di eseguire.
- **SVG via `next/image`** richiede `images.dangerouslyAllowSVG=true` in next.config.
- Le **server action** sono richiamabili direttamente da client component (usato in `users-manager.tsx`) — utile per ottenere valori di ritorno (es. password generate).
- Le **chiavi di progetto** Supabase (anon publishable, service_role) sono diverse dagli **access token** account: revocare gli access token non rompe l'app.
