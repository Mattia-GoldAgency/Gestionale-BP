# Atti di Mutuo — Web App (Studio Notarile Busani & Partners)

Interfaccia web per la generazione assistita degli atti di mutuo a partire da
**RNP** e **minuta della banca**. Frontend Next.js (App Router) + Supabase
(auth, DB, storage), deploy su Vercel. Il motore di generazione vero e proprio
(`atto_core`, Python on-premise) è collegato via HTTP attraverso un contratto
ben definito (vedi [`lib/backend.ts`](lib/backend.ts)).

> ⚠️ **GDPR**: l'app tratta dati personali sensibili di terzi. Vercel e Supabase
> sono servizi cloud (region EU): prima della produzione vanno firmati i DPA con
> entrambi i fornitori e va coinvolto il DPO dello Studio.

## Flusso utente

1. **Login** (`/login`) — accesso riservato ai collaboratori (Supabase Auth).
2. **Dashboard** (`/dashboard`) — upload di RNP e minuta + scelta del **notaio**
   (Angelo Busani, Giuseppe Ottavio Mannella, Giacomo Ridella) e **data di
   stipula** (con anteprima nel formato dell'atto: _"L'anno duemilaventisei, il
   giorno venti del mese di maggio"_).
3. **Dati mancanti** (`/pratica/[id]/dati-mancanti`) — se la RNP/minuta non
   contengono dati necessari (es. il **tasso**), vengono richiesti qui prima
   della generazione.
4. **Atto** (`/pratica/[id]`) — generazione e **download del file `.doc`** pronto
   alla stipula.

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind v4
- Supabase: Auth, Postgres (RLS), Storage (bucket privati `documenti`, `atti`)
- Deploy: Vercel

## Setup locale

```bash
npm install
cp .env.example .env.local   # compila i valori Supabase
npm run dev                  # http://localhost:3000
```

### Variabili d'ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chiave pubblica (publishable/anon) |
| `BACKEND_URL` | (opz.) Endpoint del motore Python. **Vuoto = MOCK** |
| `BACKEND_API_KEY` | (opz.) Bearer token per il backend |

Se `BACKEND_URL` è vuoto, l'app usa un **mock**: simula due campi mancanti
(tasso e durata) e produce un `.doc` fittizio, così l'intero flusso UI è
provabile senza il backend.

## Database

Lo schema è in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql):
tabella `pratiche` con RLS per-utente e due bucket storage privati. Applicalo
dallo SQL Editor di Supabase o via `supabase db push`.

## Contratto col backend Python

Il backend deve esporre due endpoint POST (auth Bearer opzionale):

- `POST /api/estrai` → `{ campiMancanti[], bancaRiconosciuta, semaforoPreliminare }`
- `POST /api/genera` → `{ docBase64, nomeFile, coverage, semaforo, reportValidazione }`

I tipi esatti sono in [`lib/backend.ts`](lib/backend.ts). È l'unico punto di
accoppiamento tra questo frontend e `atto_core`.

## Gestione collaboratori

Gli account si creano dalla dashboard Supabase (Authentication → Users) oppure
via Admin API. Non c'è auto-registrazione: l'accesso è solo su invito.
