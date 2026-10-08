# ImagActif Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Application PLAI avec compte qui génère des images via BFL (FLUX) à partir d'un gabarit JSON réutilisable, conserve l'historique (JSON sans limite, image 30 jours) et respecte le RGPD.

**Architecture:** React 18 + Vite 5 (front) ; fonctions Vercel `/api/*` (appel BFL, chiffrement des clés, quotas, nettoyage) ; Supabase partagé (auth, tables `img_*`, bucket privé) en Europe. Les handlers sont des fabriques `createXHandler(deps)` testées avec des dépendances simulées ; le JSON est la source de vérité, `composePrompt(json)` produit le texte envoyé à FLUX.

**Tech Stack:** React 18, Vite 5, Tailwind v3, vitest, @supabase/supabase-js v2, jszip, @fontsource (polices hébergées), Node `crypto` (AES-256-GCM).

**Spec :** `docs/superpowers/specs/2026-10-08-imagactif-design.md`

**Conventions de ce plan**
- Dossier de l'app : `C:\Users\jfbeg\OneDrive\claude-workspace\ImagActif\` (appelé `$APP` ci-dessous). Toutes les commandes se lancent depuis ce dossier.
- Chaque message de commit se termine par `-m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"` (second `-m`).
- Branche `main` uniquement (branche Vercel). Aucun push sans `npx vite build` réussi.
- Aucune référence scientifique n'est affichée dans l'app. Les textes d'aide décrivent uniquement l'effet d'un champ sur l'image, sans affirmation sur l'apprentissage (règle RISS).
- Écarts assumés par rapport au spec (à reporter dans le spec à la Task 0) :
  1. L'acceptation des règles est enregistrée à la **première connexion** (écran « Règlement »), pas dans le formulaire d'inscription : `signUp` ne donne pas de session avant confirmation de l'e-mail. L'écran d'inscription affiche déjà le résumé des règles et le serveur refuse de générer sans acceptation.
  2. « Suppression du compte » = suppression de **toutes les données ImagActif** (lignes, fichiers, clé). L'identifiant de connexion (`auth.users`) est partagé entre toutes les apps PLAI : il n'est pas supprimé. La ligne `img_accounts` est conservée avec `terms_version = ''` et sans clé : seule la date de début d'essai reste (sinon la suppression renouvellerait l'essai gratuit), et le texte de « Mes données » le dit.
  3. Ajout de `img_accounts.has_own_key` (booléen lisible par le client) car `img_user_keys` est illisible côté client.
  4. Suppression d'une image/génération par l'API `DELETE /api/generation` (le fichier doit être supprimé avant la ligne), pas par le client.

## Structure des fichiers

```
ImagActif/
  package.json, vite.config.js, tailwind.config.js, postcss.config.js, vercel.json, index.html
  .env.example, .gitignore, README.md
  public/plai-logo.jpg
  scripts/gen-secret.mjs        génère IMG_KEY_SECRETS / CRON_SECRET
  scripts/bfl-smoke.mjs         essai réel BFL (seed, domaine, type de contenu)
  supabase/migrations/20261008_imagactif_init.sql
  tests/db.integration.mjs      RLS + fonctions SQL sur la vraie base (comptes jetables)
  tests/helpers.js              faux res/repo/bfl pour les tests de handlers
  src/
    main.jsx, App.jsx, plai-style.css, imagactif.css
    contexts/AuthContext.jsx
    lib/ ratios.js gabarit.js composePrompt.js regime.js dates.js terms.js limits.js
         messages.js path.js champs.js supabaseClient.js api.js data.js useCompte.js
    components/ GabaritForm.jsx BandeauRegime.jsx JsonPanel.jsx EnregistrerModele.jsx CarteImage.jsx
    pages/ Login.jsx Reglement.jsx Creer.jsx Historique.jsx Modeles.jsx MesDonnees.jsx
  api/
    terms.js key.js generate.js status.js generation.js account.js cron/cleanup.js   (fonctions Vercel, 7)
    _lib/ auth.js admin.js repo.js crypto.js cronAuth.js resolveKey.js
          providers/bfl.js
          handlers/ terms.js key.js generate.js status.js generation.js account.js cleanup.js
```

Les fichiers de `src/lib/` sans JSX sont aussi importés par les handlers (même règles côté client et serveur). Extension `.js` obligatoire dans tous les imports relatifs (sinon `FUNCTION_INVOCATION_FAILED` sur Vercel).

---

### Task 0: Dépôt, workspace et squelette du projet

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.gitignore`, `.env.example`, `README.md`, `src/main.jsx`, `src/plai-style.css`, `src/imagactif.css`, `public/plai-logo.jpg`
- Create: `C:\Users\jfbeg\OneDrive\claude-workspace\memory\imagactif-session-prompt.md`
- Modify: `docs/superpowers/specs/2026-10-08-imagactif-design.md` (écarts)

- [ ] **Step 1: Initialiser git et demander la création du dépôt GitHub**

Pas de `gh` ni de jeton : JF crée le dépôt vide à la main.

Demander à JF : « Créez le dépôt vide `jfb4plai/ImagActif` sur github.com (sans README ni licence), puis dites-moi quand c'est fait. »

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace/ImagActif"
git init -b main
git remote add origin https://github.com/jfb4plai/ImagActif.git
```

- [ ] **Step 2: Écrire `package.json`**

```json
{
  "name": "imagactif",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20.6" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:db": "node --env-file=.env.local tests/db.integration.mjs",
    "smoke:bfl": "node --env-file=.env.local scripts/bfl-smoke.mjs",
    "secret": "node scripts/gen-secret.mjs"
  },
  "dependencies": {
    "@fontsource/dm-sans": "^5.1.0",
    "@fontsource/dm-serif-display": "^5.1.0",
    "@supabase/supabase-js": "^2.45.0",
    "jszip": "^3.10.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "vite": "^5.4.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Fichiers de configuration**

`vite.config.js` :
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
```

`tailwind.config.js` (fix critique : `import.meta.url`) :
```js
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
  content: [join(__dirname, 'index.html'), join(__dirname, 'src/**/*.{js,jsx}')],
  theme: { extend: {} },
  plugins: [],
}
```

`postcss.config.js` :
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`index.html` (aucune police chargée depuis Google : RGPD) :
```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/jpeg" href="/plai-logo.jpg" />
    <title>ImagActif — PLAI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`.gitignore` :
```
node_modules
dist
.env
.env.*
!.env.example
.vercel
```

`.env.example` :
```
# Front (publiques)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_TRIAL_DAILY_LIMIT=10

# Serveur uniquement (Vercel, jamais dans le code)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BFL_API_KEY=
BFL_BASE_URL=https://api.eu.bfl.ai
BFL_MODEL=flux-2-pro
IMG_KEY_SECRETS=
IMG_KEY_CURRENT=1
CRON_SECRET=
IMG_TRIAL_DAILY_LIMIT=10
IMG_GLOBAL_DAILY_LIMIT=100
```

`README.md` :
```markdown
# ImagActif

Génération d'images pour enseignants FWB (outil PLAI) : gabarit JSON réutilisable, historique 30 jours pour les images, JSON conservé.

Spec : docs/superpowers/specs/2026-10-08-imagactif-design.md
Plan : docs/superpowers/plans/2026-10-08-imagactif-plan.md

Développement : `vercel dev` (pas `vite` seul : il ne sert pas `/api/*`). Tests : `npm test`.
```

`src/main.jsx` :
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-serif-display/400.css'
import App from './App.jsx'
import './plai-style.css'
import './imagactif.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`src/imagactif.css` :
```css
body { font-size: 16px; }
.plai-help { font-size: 0.95rem; color: var(--text2); margin-top: 0.25rem; }
textarea.plai-input { min-height: 4.5rem; resize: vertical; }
.img-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.img-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.img-card img { width: 100%; height: auto; border-radius: var(--radius-sm); display: block; }
.img-urgent { color: #b45309; font-weight: 700; }
.img-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem; }
.img-split { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
@media (min-width: 900px) { .img-split { grid-template-columns: 1fr 1fr; } }
.img-warn { border-left: 4px solid #f97316; padding-left: 0.75rem; }
```

- [ ] **Step 4: Copier le CSS PLAI et le logo**

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace/ImagActif"
mkdir -p src public scripts tests supabase/migrations
cp ../shared/css/plai-style.css src/plai-style.css
cp ../projets/portail-plai/public/plai-logo.jpg public/plai-logo.jpg
ls src/plai-style.css public/plai-logo.jpg
```
Expected : les deux chemins sont listés.

- [ ] **Step 5: Installer et vérifier**

```bash
npm install
npx vitest --version
```
Expected : installation sans erreur, version de vitest affichée.

- [ ] **Step 6: Fil conducteur de session**

Créer `C:\Users\jfbeg\OneDrive\claude-workspace\memory\imagactif-session-prompt.md` :
```markdown
# ImagActif : session prompt

Objectif : générer des images (BFL/FLUX, endpoint UE) depuis un gabarit JSON réutilisable ; compte enseignant ; image conservée 30 jours, JSON conservé.
Stack : React/Vite, fonctions Vercel, Supabase partagé (Europe), tables img_*.
Spec : ImagActif/docs/superpowers/specs/2026-10-08-imagactif-design.md
Plan : ImagActif/docs/superpowers/plans/2026-10-08-imagactif-plan.md
Règles : essai 3 jours sur la clé de JF (10 img/jour, 100/jour global) puis clé BFL personnelle chiffrée côté serveur ; aucune réf scientifique sans RISS ; polices hébergées ; pas de données élèves.
Reste à faire de JF : DPA BFL + durée de conservation chez BFL, registre RGPD, sauvegarde Supabase sans images au-delà de 30 jours, ajout de l'URL aux redirections Auth Supabase.
```

- [ ] **Step 7: Reporter les écarts dans le spec**

Dans `docs/superpowers/specs/2026-10-08-imagactif-design.md`, section 4, remplacer la phrase « Suppression du compte : cascade sur toutes les lignes, fichiers et clé. » par :
`Suppression « du compte » : suppression de toutes les données ImagActif (lignes, fichiers, clé). L'identifiant de connexion est partagé entre les apps PLAI et n'est pas supprimé.`
Dans la section 6, remplacer « Inscription : règles en clair » par « Inscription (résumé) et première connexion (acceptation obligatoire) : règles en clair ». Dans la section 4, ajouter à `img_accounts` le champ `has_own_key`, et préciser que la suppression d'une image passe par `DELETE /api/generation`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: squelette ImagActif (Vite, Tailwind, CSS PLAI, spec et plan)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Migration SQL et test d'intégration de la base

**Files:**
- Create: `supabase/migrations/20261008_imagactif_init.sql`
- Create: `tests/db.integration.mjs`

- [ ] **Step 1: Vérifier l'absence de conflit de noms**

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace"
grep -rIn "create table" --include=*.sql --exclude-dir=node_modules . | grep -i "img_" | grep -v "ImagActif/"
```
Expected : aucune ligne.

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/20261008_imagactif_init.sql` :
```sql
-- ImagActif : tables, droits, RLS, stockage, fonctions de quota.
-- À exécuter à la main dans le SQL Editor du projet partagé (région Europe). Idempotent.
-- Tables préfixées img_. Ne pas recréer profiles ni le trigger updated_at.

begin;

create table if not exists img_accounts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  terms_version    text not null,
  terms_accepted_at timestamptz not null default now(),
  has_own_key      boolean not null default false
);

create table if not exists img_generations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  json             jsonb not null,
  prompt_text      text not null,
  seed             bigint not null,
  model            text not null,
  key_mode         text not null check (key_mode in ('trial', 'own')),
  status           text not null default 'pending' check (status in ('pending', 'done', 'failed', 'refused')),
  quota_day        date,
  image_path       text,
  image_expires_at timestamptz,
  image_deleted_at timestamptz,
  parent_id        uuid references img_generations(id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index if not exists img_generations_one_pending on img_generations (user_id) where status = 'pending';
create index if not exists img_generations_user_created on img_generations (user_id, created_at desc);
create index if not exists img_generations_expiry on img_generations (image_expires_at)
  where image_path is not null and image_deleted_at is null;

create table if not exists img_jobs (
  generation_id uuid primary key references img_generations(id) on delete cascade,
  polling_url   text not null,
  created_at    timestamptz not null default now()
);

create table if not exists img_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  json          jsonb not null,
  locked_fields text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists img_templates_user on img_templates (user_id, created_at desc);

create table if not exists img_user_keys (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  ciphertext     text not null,
  iv             text not null,
  secret_version text not null,
  created_at     timestamptz not null default now()
);

create table if not exists img_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

-- ── RLS ──
alter table img_accounts    enable row level security;
alter table img_generations enable row level security;
alter table img_jobs        enable row level security;
alter table img_templates   enable row level security;
alter table img_user_keys   enable row level security;
alter table img_usage       enable row level security;

drop policy if exists img_accounts_select on img_accounts;
create policy img_accounts_select on img_accounts for select to authenticated using (auth.uid() = user_id);

drop policy if exists img_generations_select on img_generations;
create policy img_generations_select on img_generations for select to authenticated using (auth.uid() = user_id);

drop policy if exists img_templates_select on img_templates;
drop policy if exists img_templates_insert on img_templates;
drop policy if exists img_templates_update on img_templates;
drop policy if exists img_templates_delete on img_templates;
create policy img_templates_select on img_templates for select to authenticated using (auth.uid() = user_id);
create policy img_templates_insert on img_templates for insert to authenticated with check (auth.uid() = user_id);
create policy img_templates_update on img_templates for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy img_templates_delete on img_templates for delete to authenticated using (auth.uid() = user_id);

drop policy if exists img_usage_select on img_usage;
create policy img_usage_select on img_usage for select to authenticated using (auth.uid() = user_id);

-- img_jobs et img_user_keys : RLS active, aucune politique, aucun droit client.

-- ── Droits (Data API) ──
revoke all on table img_accounts, img_generations, img_jobs, img_templates, img_user_keys, img_usage from public, anon, authenticated;

grant select on img_accounts to authenticated;
grant select on img_generations to authenticated;
grant select, insert, update, delete on img_templates to authenticated;
grant select on img_usage to authenticated;

grant select, insert, update, delete on img_accounts, img_generations, img_jobs, img_templates, img_user_keys, img_usage to service_role;

-- ── Stockage : bucket privé, lecture de ses propres fichiers uniquement ──
insert into storage.buckets (id, name, public) values ('img-generations', 'img-generations', false)
  on conflict (id) do nothing;

drop policy if exists img_select_own_files on storage.objects;
create policy img_select_own_files on storage.objects for select to authenticated
  using (bucket_id = 'img-generations' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Quota : réservation atomique (essai) ──
create or replace function img_reserve_quota(p_user uuid, p_day date, p_user_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_global integer;
  v_user   integer;
begin
  perform pg_advisory_xact_lock(hashtext('img_quota_' || p_day::text));
  select coalesce(sum(count), 0) into v_global from img_usage where day = p_day;
  if v_global >= p_global_limit then return 'global_limit'; end if;
  v_user := coalesce((select count from img_usage where user_id = p_user and day = p_day), 0);
  if v_user >= p_user_limit then return 'user_limit'; end if;
  insert into img_usage (user_id, day, count) values (p_user, p_day, 1)
    on conflict (user_id, day) do update set count = img_usage.count + 1;
  return 'ok';
end $$;

create or replace function img_refund_quota(p_user uuid, p_day date)
returns void language sql security definer set search_path = public as $$
  update img_usage set count = greatest(count - 1, 0) where user_id = p_user and day = p_day;
$$;

revoke all on function img_reserve_quota(uuid, date, integer, integer) from public, anon, authenticated;
revoke all on function img_refund_quota(uuid, date) from public, anon, authenticated;
grant execute on function img_reserve_quota(uuid, date, integer, integer) to service_role;
grant execute on function img_refund_quota(uuid, date) to service_role;

commit;
```

- [ ] **Step 3: Écrire le test d'intégration (comptes jetables, nettoyage final)**

`tests/db.integration.mjs` (nécessite `.env.local` avec `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) :
```js
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !anon || !service) throw new Error('Variables Supabase manquantes (.env.local).')

const admin = createClient(url, service, { auth: { persistSession: false } })
const suffixe = Math.random().toString(36).slice(2, 8)
const motDePasse = `Test-${suffixe}-Aa1!xyz`
const comptes = []

async function creerCompte(nom) {
  const email = `imagactif-test-${nom}-${suffixe}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password: motDePasse, email_confirm: true })
  if (error) throw error
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: motDePasse })
  if (e2) throw e2
  comptes.push(data.user.id)
  return { id: data.user.id, client }
}

let ok = 0
async function cas(nom, fn) {
  try { await fn(); ok++; console.log(`  ok  ${nom}`) } catch (e) { console.error(`  ECHEC ${nom}\n    ${e.message}`); process.exitCode = 1 }
}

try {
  const u1 = await creerCompte('u1')
  const u2 = await creerCompte('u2')

  await admin.from('img_accounts').insert([
    { user_id: u1.id, terms_version: 't' }, { user_id: u2.id, terms_version: 't' },
  ])

  await cas('u1 ne lit que son img_accounts', async () => {
    const { data, error } = await u1.client.from('img_accounts').select('user_id')
    assert.equal(error, null)
    assert.deepEqual(data.map((r) => r.user_id), [u1.id])
  })
  await cas('u1 ne peut pas insérer dans img_accounts', async () => {
    const { error } = await u1.client.from('img_accounts').insert({ user_id: u1.id, terms_version: 'x' })
    assert.ok(error)
  })
  await cas('u1 ne peut pas modifier trial_started_at', async () => {
    const { data } = await u1.client.from('img_accounts').update({ trial_started_at: '2030-01-01' }).eq('user_id', u1.id).select()
    assert.ok(!data || data.length === 0)
  })
  await cas('img_user_keys illisible pour authenticated', async () => {
    await admin.from('img_user_keys').insert({ user_id: u1.id, ciphertext: 'c', iv: 'i', secret_version: '1' })
    const { data, error } = await u1.client.from('img_user_keys').select('*')
    assert.ok(error || (data ?? []).length === 0)
    assert.ok(error, 'une erreur de droits est attendue')
  })
  await cas('img_jobs illisible pour authenticated', async () => {
    const { error } = await u1.client.from('img_jobs').select('*')
    assert.ok(error)
  })
  await cas('modèles : propres lignes seulement', async () => {
    const { error } = await u1.client.from('img_templates').insert({ user_id: u1.id, name: 'm1', json: {} })
    assert.equal(error, null)
    const { error: e2 } = await u1.client.from('img_templates').insert({ user_id: u2.id, name: 'x', json: {} })
    assert.ok(e2)
    const { data } = await u2.client.from('img_templates').select('id')
    assert.equal(data.length, 0)
  })
  await cas('génération : pas de suppression ni d\'écriture côté client', async () => {
    const { error } = await u1.client.from('img_generations').insert({ user_id: u1.id, json: {}, prompt_text: 'p', seed: 1, model: 'm', key_mode: 'own' })
    assert.ok(error)
  })
  await cas('une seule génération en cours par compte', async () => {
    const ligne = { user_id: u1.id, json: {}, prompt_text: 'p', seed: 1, model: 'm', key_mode: 'own', status: 'pending' }
    const a = await admin.from('img_generations').insert(ligne)
    assert.equal(a.error, null)
    const b = await admin.from('img_generations').insert(ligne)
    assert.equal(b.error?.code, '23505')
  })
  await cas('quota : limites utilisateur, global et remboursement', async () => {
    const jour = '2099-01-01'
    const r = (u, ul, gl) => admin.rpc('img_reserve_quota', { p_user: u, p_day: jour, p_user_limit: ul, p_global_limit: gl })
    assert.equal((await r(u1.id, 2, 3)).data, 'ok')
    assert.equal((await r(u1.id, 2, 3)).data, 'ok')
    assert.equal((await r(u1.id, 2, 3)).data, 'user_limit')
    assert.equal((await r(u2.id, 2, 3)).data, 'ok')
    assert.equal((await r(u2.id, 2, 3)).data, 'global_limit')
    await admin.rpc('img_refund_quota', { p_user: u1.id, p_day: jour })
    assert.equal((await r(u1.id, 2, 4)).data, 'ok')
  })
  await cas('un client ne peut pas appeler les fonctions de quota', async () => {
    const { error } = await u1.client.rpc('img_reserve_quota', { p_user: u1.id, p_day: '2099-01-02', p_user_limit: 99, p_global_limit: 99 })
    assert.ok(error)
  })
  await cas('stockage : lecture de ses fichiers seulement', async () => {
    const octets = new Uint8Array([1, 2, 3])
    await admin.storage.from('img-generations').upload(`${u1.id}/a.png`, octets, { contentType: 'image/png', upsert: true })
    await admin.storage.from('img-generations').upload(`${u2.id}/b.png`, octets, { contentType: 'image/png', upsert: true })
    const propre = await u1.client.storage.from('img-generations').createSignedUrl(`${u1.id}/a.png`, 60)
    assert.equal(propre.error, null)
    const autre = await u1.client.storage.from('img-generations').createSignedUrl(`${u2.id}/b.png`, 60)
    assert.ok(autre.error)
  })
} finally {
  for (const id of comptes) {
    const { data: fichiers } = await admin.storage.from('img-generations').list(id)
    if (fichiers?.length) await admin.storage.from('img-generations').remove(fichiers.map((f) => `${id}/${f.name}`))
    await admin.from('img_usage').delete().eq('user_id', id)
    await admin.auth.admin.deleteUser(id)
  }
  console.log(`${ok} cas réussis. Comptes jetables supprimés.`)
}
```

- [ ] **Step 4: Demander l'accord de JF avant d'appliquer la migration**

Dire à JF : « La migration `supabase/migrations/20261008_imagactif_init.sql` crée 6 tables `img_*`, un bucket privé et 2 fonctions dans la base partagée. Elle n'altère aucune table existante. Puis-je vous la remettre pour l'exécuter dans le SQL Editor ? » Attendre un oui explicite. Ne rien appliquer sans cet accord.

- [ ] **Step 5: JF exécute la migration, puis créer `.env.local`**

JF colle le fichier dans le SQL Editor du projet `dfoaumjleqtxjeaplnna` et l'exécute (Expected : « Success »). Puis créer `.env.local` (non versionné) avec les trois variables Supabase, la clé service role venant du tableau de bord Supabase (jamais écrite dans le code ni dans un message).

- [ ] **Step 6: Lancer le test d'intégration**

```bash
npm run test:db
```
Expected : 11 lignes `ok`, puis `11 cas réussis. Comptes jetables supprimés.`. En cas d'échec, corriger la migration (pas le test) sauf si le test est faux, et ré-exécuter la migration (idempotente).

- [ ] **Step 7: Commit**

```bash
git add supabase tests/db.integration.mjs
git commit -m "feat(db): tables img_*, RLS, bucket privé, quota atomique + test d'intégration" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Formats d'image et gabarit JSON (lib partagée)

**Files:**
- Create: `src/lib/ratios.js`, `src/lib/gabarit.js`, `src/lib/path.js`
- Test: `src/lib/gabarit.test.js`, `src/lib/path.test.js`

- [ ] **Step 1: Écrire les tests**

`src/lib/gabarit.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { gabaritVide, normaliserGabarit, validerPourGeneration, EXCLUSION_DEFAUT } from './gabarit.js'
import { dimensions, RATIO_IDS } from './ratios.js'

describe('ratios', () => {
  it('toutes les dimensions sont des multiples de 16', () => {
    for (const id of RATIO_IDS) {
      const { width, height } = dimensions(id)
      expect(width % 16).toBe(0)
      expect(height % 16).toBe(0)
    }
  })
  it('refuse un format inconnu', () => {
    expect(() => dimensions('2:1')).toThrow('Format inconnu')
  })
})

describe('gabaritVide', () => {
  it('contient l\'exclusion par défaut et le format carré', () => {
    const g = gabaritVide()
    expect(g.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(g.format.ratio).toBe('1:1')
    expect(g.generation.seed).toBeNull()
  })
  it('est invalide sans sujet', () => {
    expect(validerPourGeneration(gabaritVide())).toEqual(["Décrivez le sujet de l'image."])
  })
})

describe('normaliserGabarit', () => {
  it('rejette ce qui n\'est pas un objet', () => {
    expect(() => normaliserGabarit(null)).toThrow('objet')
    expect(() => normaliserGabarit([])).toThrow('objet')
    expect(() => normaliserGabarit('x')).toThrow('objet')
  })
  it('remplit les valeurs par défaut', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'Un chat' } })
    expect(gabarit.sujet.description).toBe('Un chat')
    expect(gabarit.exclusions).toEqual([EXCLUSION_DEFAUT])
    expect(gabarit.format.ratio).toBe('1:1')
  })
  it('respecte une liste d\'exclusions vide fournie par l\'enseignant', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, exclusions: [] })
    expect(gabarit.exclusions).toEqual([])
  })
  it('range les clés inconnues dans personnalise avec un avertissement', () => {
    const { gabarit, avertissements } = normaliserGabarit({ sujet: { description: 'a' }, humeur: 'joyeuse', cadre: { x: 1 } })
    expect(gabarit.personnalise).toEqual([
      { nom: 'humeur', valeur: 'joyeuse' },
      { nom: 'cadre', valeur: '{"x":1}' },
    ])
    expect(avertissements).toHaveLength(2)
  })
  it('tronque les textes trop longs et nettoie les espaces', () => {
    const { gabarit } = normaliserGabarit({ sujet: { description: `  ${'a'.repeat(900)}  ` } })
    expect(gabarit.sujet.description).toHaveLength(500)
  })
  it('valide la graine et le format', () => {
    const a = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: 42 }, format: { ratio: '16:9' } })
    expect(a.gabarit.generation.seed).toBe(42)
    expect(a.gabarit.format.ratio).toBe('16:9')
    const b = normaliserGabarit({ sujet: { description: 'a' }, generation: { seed: -3 }, format: { ratio: '5:1' } })
    expect(b.gabarit.generation.seed).toBeNull()
    expect(b.gabarit.format.ratio).toBe('1:1')
    expect(b.avertissements).toHaveLength(2)
  })
  it('limite et nettoie personnalise', () => {
    const perso = Array.from({ length: 15 }, (_, i) => ({ nom: `n${i}`, valeur: `v${i}` }))
    perso.push({ nom: '', valeur: 'x' })
    const { gabarit } = normaliserGabarit({ sujet: { description: 'a' }, personnalise: perso })
    expect(gabarit.personnalise).toHaveLength(10)
  })
  it('ne contient jamais de clé dangereuse héritée', () => {
    const { gabarit } = normaliserGabarit(JSON.parse('{"sujet":{"description":"a"},"__proto__":{"x":1}}'))
    expect(Object.prototype.hasOwnProperty.call(gabarit, 'x')).toBe(false)
    expect({}.x).toBeUndefined()
  })
})
```

`src/lib/path.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { getIn, setIn } from './path.js'

describe('path', () => {
  it('lit un chemin imbriqué', () => {
    expect(getIn({ a: { b: 3 } }, 'a.b')).toBe(3)
    expect(getIn({ a: null }, 'a.b')).toBeUndefined()
  })
  it('écrit sans muter l\'original', () => {
    const o = { a: { b: 1, c: 2 } }
    const n = setIn(o, 'a.b', 9)
    expect(n).toEqual({ a: { b: 9, c: 2 } })
    expect(o.a.b).toBe(1)
  })
  it('crée les niveaux manquants', () => {
    expect(setIn({}, 'x.y', 1)).toEqual({ x: { y: 1 } })
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

```bash
npx vitest run src/lib/gabarit.test.js src/lib/path.test.js
```
Expected : FAIL (modules introuvables).

- [ ] **Step 3: Implémenter**

`src/lib/ratios.js` :
```js
// Dimensions ~1 mégapixel, multiples de 16.
export const RATIOS = {
  '1:1': { width: 1024, height: 1024, label: 'Carré (1:1)' },
  '4:3': { width: 1152, height: 864, label: 'Paysage classique (4:3)' },
  '3:4': { width: 864, height: 1152, label: 'Portrait (3:4)' },
  '16:9': { width: 1344, height: 768, label: 'Écran large (16:9)' },
  '9:16': { width: 768, height: 1344, label: 'Vertical (9:16)' },
}

export const RATIO_IDS = Object.keys(RATIOS)

export function dimensions(ratio) {
  const r = RATIOS[ratio]
  if (!r) throw new Error(`Format inconnu : ${ratio}`)
  return { width: r.width, height: r.height }
}
```

`src/lib/path.js` :
```js
export function getIn(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

export function setIn(obj, path, value) {
  const [k, ...rest] = path.split('.')
  if (!rest.length) return { ...obj, [k]: value }
  return { ...obj, [k]: setIn(obj?.[k] ?? {}, rest.join('.'), value) }
}
```

`src/lib/gabarit.js` :
```js
import { RATIO_IDS } from './ratios.js'

export const SCHEMA_VERSION = 1
export const EXCLUSION_DEFAUT = "pas de texte dans l'image"

const MAX_TEXTE = 500
const MAX_LISTE = 10
const SEED_MAX = 4294967295
const CLES_CONNUES = ['schema_version', 'sujet', 'style', 'composition', 'lumiere', 'exclusions', 'format', 'generation', 'personnalise']

export function gabaritVide() {
  return {
    schema_version: SCHEMA_VERSION,
    sujet: { description: '', details: '' },
    style: { type: '', palette: '' },
    composition: { cadrage: '', point_de_vue: '', arriere_plan: '' },
    lumiere: '',
    exclusions: [EXCLUSION_DEFAUT],
    format: { ratio: '1:1' },
    generation: { seed: null },
    personnalise: [],
  }
}

const txt = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXTE) : '')
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// Transforme n'importe quel objet (import collé, ancien JSON) en gabarit valide.
// Ne lève une erreur que si l'entrée n'est pas un objet. Rien n'est exécuté.
export function normaliserGabarit(entree) {
  if (!estObjet(entree)) throw new Error('JSON invalide : un objet est attendu.')
  const avertissements = []

  let ratio = '1:1'
  if (entree.format?.ratio !== undefined) {
    if (RATIO_IDS.includes(entree.format.ratio)) ratio = entree.format.ratio
    else avertissements.push(`Format « ${String(entree.format.ratio)} » inconnu : carré 1:1 utilisé.`)
  }

  let seed = null
  const s = entree.generation?.seed
  if (s !== undefined && s !== null) {
    if (Number.isInteger(s) && s >= 0 && s <= SEED_MAX) seed = s
    else avertissements.push('Graine invalide : ignorée.')
  }

  const personnalise = []
  if (Array.isArray(entree.personnalise)) {
    for (const p of entree.personnalise) {
      const nom = txt(p?.nom)
      const valeur = txt(p?.valeur)
      if (nom && valeur) personnalise.push({ nom, valeur })
    }
  }
  for (const [cle, valeur] of Object.entries(entree)) {
    if (CLES_CONNUES.includes(cle) || cle === '__proto__') continue
    const v = txt(typeof valeur === 'string' ? valeur : JSON.stringify(valeur))
    const nom = txt(cle)
    if (nom && v) {
      personnalise.push({ nom, valeur: v })
      avertissements.push(`Champ inconnu « ${nom} » déplacé dans les champs personnalisés.`)
    }
  }

  const gabarit = {
    schema_version: SCHEMA_VERSION,
    sujet: { description: txt(entree.sujet?.description), details: txt(entree.sujet?.details) },
    style: { type: txt(entree.style?.type), palette: txt(entree.style?.palette) },
    composition: {
      cadrage: txt(entree.composition?.cadrage),
      point_de_vue: txt(entree.composition?.point_de_vue),
      arriere_plan: txt(entree.composition?.arriere_plan),
    },
    lumiere: txt(entree.lumiere),
    exclusions: Array.isArray(entree.exclusions)
      ? entree.exclusions.map(txt).filter(Boolean).slice(0, MAX_LISTE)
      : [EXCLUSION_DEFAUT],
    format: { ratio },
    generation: { seed },
    personnalise: personnalise.slice(0, MAX_LISTE),
  }
  return { gabarit, avertissements }
}

export function validerPourGeneration(gabarit) {
  const erreurs = []
  if (!gabarit.sujet.description) erreurs.push("Décrivez le sujet de l'image.")
  return erreurs
}
```

- [ ] **Step 4: Relancer les tests**

```bash
npx vitest run src/lib/gabarit.test.js src/lib/path.test.js
```
Expected : tous PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat: formats d'image, gabarit JSON normalisé, helpers de chemin" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: composePrompt (JSON vers texte FLUX)

**Files:**
- Create: `src/lib/composePrompt.js`
- Test: `src/lib/composePrompt.test.js`

- [ ] **Step 1: Écrire le test**

```js
import { describe, it, expect } from 'vitest'
import { composePrompt } from './composePrompt.js'
import { gabaritVide } from './gabarit.js'

function base() {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux qui dort sur un rebord de fenêtre'
  return g
}

describe('composePrompt', () => {
  it('compose uniquement les champs renseignés', () => {
    const g = base()
    g.style.type = 'aquarelle'
    g.style.palette = 'tons chauds'
    g.lumiere = 'lumière douce du matin'
    expect(composePrompt(g)).toBe(
      "Un chat roux qui dort sur un rebord de fenêtre. Style : aquarelle. Palette : tons chauds. Lumière : lumière douce du matin. À éviter : pas de texte dans l'image."
    )
  })

  it('ne double pas la ponctuation finale', () => {
    const g = base()
    g.sujet.description = 'Un chat !'
    g.sujet.details = 'Pelage tigré.'
    expect(composePrompt(g)).toBe("Un chat ! Pelage tigré. À éviter : pas de texte dans l'image.")
  })

  it('ajoute les champs personnalisés dans l\'ordre, avant les exclusions', () => {
    const g = base()
    g.personnalise = [{ nom: 'Ambiance', valeur: 'calme' }, { nom: 'Saison', valeur: 'automne' }]
    g.exclusions = ['visages réalistes', 'ombres dures']
    expect(composePrompt(g)).toBe(
      'Un chat roux qui dort sur un rebord de fenêtre. Ambiance : calme. Saison : automne. À éviter : visages réalistes, ombres dures.'
    )
  })

  it('omet la ligne d\'exclusions quand la liste est vide', () => {
    const g = base()
    g.exclusions = []
    expect(composePrompt(g)).toBe('Un chat roux qui dort sur un rebord de fenêtre.')
  })

  it('est déterministe', () => {
    const g = base()
    expect(composePrompt(g)).toBe(composePrompt(structuredClone(g)))
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

```bash
npx vitest run src/lib/composePrompt.test.js
```
Expected : FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

`src/lib/composePrompt.js` :
```js
// FLUX n'a pas de prompt négatif : « À éviter » est une consigne textuelle, pas une garantie.
const fin = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)
const ligne = (etiquette, valeur) => (valeur ? fin(`${etiquette} : ${valeur}`) : '')

export function composePrompt(g) {
  const parties = [
    g.sujet.description && fin(g.sujet.description),
    g.sujet.details && fin(g.sujet.details),
    ligne('Style', g.style.type),
    ligne('Palette', g.style.palette),
    ligne('Cadrage', g.composition.cadrage),
    ligne('Point de vue', g.composition.point_de_vue),
    ligne('Arrière-plan', g.composition.arriere_plan),
    ligne('Lumière', g.lumiere),
    ...g.personnalise.map((p) => ligne(p.nom, p.valeur)),
    g.exclusions.length ? fin(`À éviter : ${g.exclusions.join(', ')}`) : '',
  ]
  return parties.filter(Boolean).join(' ')
}
```

- [ ] **Step 4: Relancer le test**

```bash
npx vitest run src/lib/composePrompt.test.js
```
Expected : 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/composePrompt.js src/lib/composePrompt.test.js
git commit -m "feat: composePrompt (JSON vers texte FLUX)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Régime, dates, règles, limites, messages

**Files:**
- Create: `src/lib/regime.js`, `src/lib/dates.js`, `src/lib/terms.js`, `src/lib/limits.js`, `src/lib/messages.js`
- Test: `src/lib/regime.test.js`, `src/lib/dates.test.js`, `src/lib/limits.test.js`

- [ ] **Step 1: Écrire les tests**

`src/lib/regime.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { determineRegime, trialEnd } from './regime.js'

const debut = '2026-10-05T10:00:00Z'

describe('determineRegime', () => {
  it('essai pendant 3 jours', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: false, now: new Date('2026-10-08T09:59:59Z') })).toBe('trial')
  })
  it('plus d\'essai après 3 jours sans clé', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: false, now: new Date('2026-10-08T10:00:00Z') })).toBe('none')
  })
  it('la clé personnelle l\'emporte, même pendant l\'essai', () => {
    expect(determineRegime({ trialStartedAt: debut, hasOwnKey: true, now: new Date('2026-10-06T10:00:00Z') })).toBe('own')
  })
  it('sans date d\'essai ni clé : aucun régime', () => {
    expect(determineRegime({ trialStartedAt: null, hasOwnKey: false })).toBe('none')
  })
  it('trialEnd ajoute 72 h', () => {
    expect(trialEnd(debut).toISOString()).toBe('2026-10-08T10:00:00.000Z')
  })
})
```

`src/lib/dates.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { imageExpiry, joursRestants, niveauUrgence, jourBruxelles } from './dates.js'

describe('dates', () => {
  it('l\'image expire 30 jours plus tard', () => {
    expect(imageExpiry(new Date('2026-10-08T10:00:00Z')).toISOString()).toBe('2026-11-07T10:00:00.000Z')
  })
  it('compte les jours restants en arrondissant au-dessus', () => {
    const now = new Date('2026-10-08T10:00:00Z')
    expect(joursRestants(new Date('2026-10-20T10:00:00Z'), now)).toBe(12)
    expect(joursRestants(new Date('2026-10-09T22:00:00Z'), now)).toBe(2)
    expect(joursRestants(new Date('2026-10-01T10:00:00Z'), now)).toBe(0)
  })
  it('niveaux d\'urgence', () => {
    expect(niveauUrgence(12)).toBe('ok')
    expect(niveauUrgence(5)).toBe('bientot')
    expect(niveauUrgence(1)).toBe('bientot')
    expect(niveauUrgence(0)).toBe('expire')
  })
  it('le jour de quota suit l\'heure de Bruxelles', () => {
    expect(jourBruxelles(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09')
    expect(jourBruxelles(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-08')
  })
})
```

`src/lib/limits.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { limitsFromEnv } from './limits.js'
import { messageErreur } from './messages.js'

describe('limitsFromEnv', () => {
  it('valeurs par défaut', () => {
    expect(limitsFromEnv({})).toEqual({ user: 10, global: 100 })
  })
  it('lit l\'environnement et ignore les valeurs invalides', () => {
    expect(limitsFromEnv({ IMG_TRIAL_DAILY_LIMIT: '5', IMG_GLOBAL_DAILY_LIMIT: '40' })).toEqual({ user: 5, global: 40 })
    expect(limitsFromEnv({ IMG_TRIAL_DAILY_LIMIT: 'abc', IMG_GLOBAL_DAILY_LIMIT: '-3' })).toEqual({ user: 10, global: 100 })
  })
})

describe('messageErreur', () => {
  it('traduit un code connu et retombe sur un message neutre sinon', () => {
    expect(messageErreur('busy')).toContain('en cours')
    expect(messageErreur('inconnu')).toBe('Une erreur est survenue. Réessayez.')
    expect(messageErreur('inconnu', 'Détail')).toBe('Détail')
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

```bash
npx vitest run src/lib/regime.test.js src/lib/dates.test.js src/lib/limits.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`src/lib/regime.js` :
```js
export const TRIAL_DAYS = 3

export function trialEnd(trialStartedAt) {
  return new Date(new Date(trialStartedAt).getTime() + TRIAL_DAYS * 86400000)
}

// 'own' : clé personnelle ; 'trial' : essai sur la clé de JF ; 'none' : génération impossible.
export function determineRegime({ trialStartedAt, hasOwnKey, now = new Date() }) {
  if (hasOwnKey) return 'own'
  if (trialStartedAt && now < trialEnd(trialStartedAt)) return 'trial'
  return 'none'
}
```

`src/lib/dates.js` :
```js
export const IMAGE_RETENTION_DAYS = 30
const JOUR_MS = 86400000

export function imageExpiry(depuis = new Date()) {
  return new Date(depuis.getTime() + IMAGE_RETENTION_DAYS * JOUR_MS)
}

export function joursRestants(expiration, now = new Date()) {
  const ms = new Date(expiration).getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / JOUR_MS))
}

export function niveauUrgence(jours) {
  if (jours <= 0) return 'expire'
  if (jours <= 5) return 'bientot'
  return 'ok'
}

// Jour calendaire de Bruxelles, au format YYYY-MM-DD (clé du quota quotidien).
export function jourBruxelles(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(date)
}
```

`src/lib/terms.js` :
```js
export const TERMS_VERSION = '2026-10-08'

// Source unique : affiché à l'inscription, à la première connexion et dans « Mes données ».
export const TERMS_POINTS = [
  'Vos images sont supprimées automatiquement 30 jours après leur création. Téléchargez celles que vous voulez garder.',
  'Le JSON de chaque image (sa description structurée) est conservé tant que vous ne le supprimez pas, pour pouvoir refaire une image ou en créer une variante.',
  'Le texte de votre description est envoyé à Black Forest Labs (BFL, Allemagne) via son serveur européen pour fabriquer l\'image. N\'y écrivez jamais le nom ou la photo d\'un élève, ni aucune donnée personnelle.',
  'Pendant 3 jours après l\'inscription, vous pouvez essayer l\'outil gratuitement (quota limité). Ensuite, vous ajoutez votre propre clé BFL ; elle est stockée chiffrée sur nos serveurs, et vous pouvez la supprimer à tout moment.',
  'Les images sont générées par une IA : relisez-les avant de les utiliser en classe.',
  'Vous pouvez exporter toutes vos données et les supprimer à tout moment depuis « Mes données ».',
]
```

`src/lib/limits.js` :
```js
export function limitsFromEnv(env = process.env) {
  const n = (v, defaut) => {
    const x = Number.parseInt(v, 10)
    return Number.isFinite(x) && x > 0 ? x : defaut
  }
  return { user: n(env.IMG_TRIAL_DAILY_LIMIT, 10), global: n(env.IMG_GLOBAL_DAILY_LIMIT, 100) }
}
```

`src/lib/messages.js` :
```js
export const MESSAGES = {
  terms: "Acceptez d'abord les règles d'utilisation.",
  email_unconfirmed: 'Confirmez votre adresse e-mail avant de générer des images.',
  trial_over: "L'essai de 3 jours est terminé. Ajoutez votre clé BFL dans « Mes données » pour continuer.",
  quota_user: "Limite de l'essai atteinte pour aujourd'hui. Réessayez demain ou ajoutez votre clé BFL.",
  quota_global: "L'essai est momentanément indisponible. Réessayez demain ou ajoutez votre clé BFL.",
  busy: 'Une image est déjà en cours de création. Attendez qu\'elle soit terminée.',
  invalid_key: 'Votre clé BFL est refusée. Vérifiez-la ou ajoutez-en une nouvelle dans « Mes données ».',
  no_credits: "Votre compte BFL n'a plus de crédits. Rechargez-le sur le site de BFL.",
  rate_limited: 'BFL reçoit trop de demandes. Réessayez dans une minute.',
  key_unreadable: "Votre clé n'a pas pu être lue. Ajoutez-la à nouveau dans « Mes données ».",
  moderated: "BFL a refusé ce contenu. Reformulez la description. Cette tentative n'est pas décomptée de votre quota d'essai.",
  failed: "La génération a échoué chez BFL. Réessayez. Cette tentative n'est pas décomptée de votre quota d'essai.",
  timeout: "La génération prend plus de temps que prévu. Elle apparaîtra dans l'historique si elle aboutit.",
  provider_error: 'Le service d\'images ne répond pas correctement. Réessayez plus tard.',
  invalid_json: 'Le contenu envoyé est invalide.',
  invalid_parent: "L'image d'origine est introuvable.",
}

export function messageErreur(code, repli = 'Une erreur est survenue. Réessayez.') {
  return MESSAGES[code] ?? repli
}
```

- [ ] **Step 4: Relancer les tests**

```bash
npx vitest run src/lib
```
Expected : tous les tests de `src/lib` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat: régime essai/clé, dates de conservation, règles, limites, messages" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Chiffrement AES-256-GCM des clés personnelles

**Files:**
- Create: `api/_lib/crypto.js`, `scripts/gen-secret.mjs`
- Test: `api/_lib/crypto.test.js`

- [ ] **Step 1: Écrire le test**

```js
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { chiffrer, dechiffrer, ringFromEnv } from './crypto.js'

const ring = () => ({ current: '1', keys: { '1': randomBytes(32), '2': randomBytes(32) } })

describe('crypto des clés', () => {
  it('aller-retour', () => {
    const r = ring()
    const rec = chiffrer('cle-bfl-secrete-123456', 'user-1', r)
    expect(rec.ciphertext).not.toContain('cle-bfl')
    expect(rec.secret_version).toBe('1')
    expect(dechiffrer(rec, 'user-1', r)).toBe('cle-bfl-secrete-123456')
  })
  it('IV unique à chaque chiffrement', () => {
    const r = ring()
    const a = chiffrer('x'.repeat(20), 'u', r)
    const b = chiffrer('x'.repeat(20), 'u', r)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
  it('refuse le déchiffrement pour un autre utilisateur', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'user-1', r)
    expect(() => dechiffrer(rec, 'user-2', r)).toThrow()
  })
  it('refuse un contenu altéré', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'user-1', r)
    const buf = Buffer.from(rec.ciphertext, 'base64')
    buf[0] ^= 1
    expect(() => dechiffrer({ ...rec, ciphertext: buf.toString('base64') }, 'user-1', r)).toThrow()
  })
  it('déchiffre avec une ancienne version de secret', () => {
    const r = ring()
    const rec = chiffrer('x'.repeat(20), 'u', r)
    const r2 = { ...r, current: '2' }
    expect(dechiffrer(rec, 'u', r2)).toBe('x'.repeat(20))
    expect(chiffrer('y'.repeat(20), 'u', r2).secret_version).toBe('2')
  })
  it('échoue clairement si la version du secret manque', () => {
    const r = ring()
    const rec = { ...chiffrer('x'.repeat(20), 'u', r), secret_version: '9' }
    expect(() => dechiffrer(rec, 'u', r)).toThrow('indisponible')
  })
})

describe('ringFromEnv', () => {
  const b64 = randomBytes(32).toString('base64')
  it('charge les secrets de l\'environnement', () => {
    const r = ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': b64 }), IMG_KEY_CURRENT: '1' })
    expect(r.current).toBe('1')
    expect(r.keys['1']).toHaveLength(32)
  })
  it('refuse l\'absence de configuration', () => {
    expect(() => ringFromEnv({})).toThrow('manquants')
  })
  it('refuse un secret de mauvaise taille ou une version courante absente', () => {
    expect(() => ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': 'abcd' }), IMG_KEY_CURRENT: '1' })).toThrow('32 octets')
    expect(() => ringFromEnv({ IMG_KEY_SECRETS: JSON.stringify({ '1': b64 }), IMG_KEY_CURRENT: '2' })).toThrow('introuvable')
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

```bash
npx vitest run api/_lib/crypto.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`api/_lib/crypto.js` :
```js
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// IMG_KEY_SECRETS = JSON {"1":"<32 octets en base64>", ...} ; IMG_KEY_CURRENT = version utilisée pour chiffrer.
export function ringFromEnv(env = process.env) {
  const raw = env.IMG_KEY_SECRETS
  const current = env.IMG_KEY_CURRENT
  if (!raw || !current) throw new Error('IMG_KEY_SECRETS / IMG_KEY_CURRENT manquants.')
  const keys = {}
  for (const [version, b64] of Object.entries(JSON.parse(raw))) {
    const buf = Buffer.from(b64, 'base64')
    if (buf.length !== 32) throw new Error(`Secret ${version} : 32 octets attendus.`)
    keys[version] = buf
  }
  if (!keys[current]) throw new Error(`Secret courant ${current} introuvable.`)
  return { current, keys }
}

// L'identifiant de l'utilisateur est lié au chiffrement (AAD) : un texte chiffré copié vers un autre compte est inutilisable.
export function chiffrer(clair, userId, ring) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ring.keys[ring.current], iv)
  cipher.setAAD(Buffer.from(userId))
  const ct = Buffer.concat([cipher.update(clair, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([ct, tag]).toString('base64'),
    iv: iv.toString('base64'),
    secret_version: ring.current,
  }
}

export function dechiffrer(rec, userId, ring) {
  const key = ring.keys[rec.secret_version]
  if (!key) throw new Error(`Secret ${rec.secret_version} indisponible.`)
  const brut = Buffer.from(rec.ciphertext, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(rec.iv, 'base64'))
  decipher.setAAD(Buffer.from(userId))
  decipher.setAuthTag(brut.subarray(brut.length - 16))
  return Buffer.concat([decipher.update(brut.subarray(0, brut.length - 16)), decipher.final()]).toString('utf8')
}
```

`scripts/gen-secret.mjs` (affiche les valeurs à copier dans Vercel ; ne les écrit nulle part) :
```js
import { randomBytes } from 'node:crypto'

const secrets = JSON.stringify({ 1: randomBytes(32).toString('base64') })
console.log('IMG_KEY_SECRETS=' + secrets)
console.log('IMG_KEY_CURRENT=1')
console.log('CRON_SECRET=' + randomBytes(32).toString('hex'))
console.log('\nPoser chaque valeur dans Vercel avec printf (pas echo), puis vérifier avec `vercel env pull`.')
```

- [ ] **Step 4: Relancer le test**

```bash
npx vitest run api/_lib/crypto.test.js
```
Expected : 9 PASS.

- [ ] **Step 5: Commit**

```bash
git add api scripts
git commit -m "feat(api): chiffrement AES-256-GCM des clés personnelles + générateur de secrets" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Fournisseur BFL

**Files:**
- Create: `api/_lib/providers/bfl.js`
- Test: `api/_lib/providers/bfl.test.js`

- [ ] **Step 1: Écrire le test**

```js
import { describe, it, expect, vi } from 'vitest'
import { createBfl, ProviderError, extensionFor } from './bfl.js'

const reponse = (corps, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corps,
  arrayBuffer: async () => (corps instanceof Uint8Array ? corps.buffer : new ArrayBuffer(0)),
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
})

describe('bfl.submit', () => {
  it('envoie la requête attendue sur l\'endpoint UE', async () => {
    const fetchImpl = vi.fn(async () => reponse({ id: 'abc', polling_url: 'https://api.eu.bfl.ai/v1/get_result?id=abc' }))
    const bfl = createBfl({ fetchImpl })
    const r = await bfl.submit({ apiKey: 'K', prompt: 'un chat', width: 1024, height: 1024, seed: 7 })
    expect(r).toEqual({ id: 'abc', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=abc' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.eu.bfl.ai/v1/flux-2-pro')
    expect(init.headers['x-key']).toBe('K')
    expect(JSON.parse(init.body)).toEqual({ prompt: 'un chat', width: 1024, height: 1024, seed: 7 })
  })
  it('traduit les erreurs HTTP', async () => {
    const cas = [[401, 'invalid_key'], [403, 'invalid_key'], [402, 'no_credits'], [429, 'rate_limited'], [500, 'provider_error']]
    for (const [status, code] of cas) {
      const bfl = createBfl({ fetchImpl: async () => reponse({}, { status }) })
      await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code })
    }
  })
  it('refuse une polling_url hors du domaine bfl.ai (la clé ne doit jamais fuiter)', async () => {
    const bfl = createBfl({ fetchImpl: async () => reponse({ id: '1', polling_url: 'https://evil.example.com/x' }) })
    await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toBeInstanceOf(ProviderError)
  })
  it('refuse une réponse sans polling_url', async () => {
    const bfl = createBfl({ fetchImpl: async () => reponse({ id: '1' }) })
    await expect(bfl.submit({ apiKey: 'K', prompt: 'p', width: 1, height: 1, seed: 1 })).rejects.toMatchObject({ code: 'provider_error' })
  })
})

describe('bfl.poll', () => {
  const poll = (corps) => createBfl({ fetchImpl: async () => reponse(corps) }).poll({ apiKey: 'K', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=1' })
  it('traduit les statuts', async () => {
    expect(await poll({ status: 'Ready', result: { sample: 'https://delivery.bfl.ai/x.jpg' } })).toEqual({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.jpg' })
    expect(await poll({ status: 'Pending' })).toEqual({ state: 'pending' })
    expect(await poll({ status: 'Request Moderated' })).toEqual({ state: 'refused' })
    expect(await poll({ status: 'Content Moderated' })).toEqual({ state: 'refused' })
    expect(await poll({ status: 'Error' })).toEqual({ state: 'failed' })
    expect(await poll({ status: 'Failed' })).toEqual({ state: 'failed' })
  })
  it('envoie la clé et refuse un domaine étranger', async () => {
    const fetchImpl = vi.fn(async () => reponse({ status: 'Pending' }))
    const bfl = createBfl({ fetchImpl })
    await bfl.poll({ apiKey: 'K', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=1' })
    expect(fetchImpl.mock.calls[0][1].headers['x-key']).toBe('K')
    await expect(bfl.poll({ apiKey: 'K', pollingUrl: 'https://evil.example.com/x' })).rejects.toBeInstanceOf(ProviderError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('bfl.download', () => {
  it('télécharge sans envoyer la clé', async () => {
    const fetchImpl = vi.fn(async () => reponse(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
    const r = await createBfl({ fetchImpl }).download('https://delivery.bfl.ai/x.png')
    expect(r.contentType).toBe('image/png')
    expect(r.buffer.length).toBe(3)
    expect(fetchImpl.mock.calls[0][1]).toBeUndefined()
  })
  it('refuse http', async () => {
    await expect(createBfl({ fetchImpl: vi.fn() }).download('http://x.example/y.png')).rejects.toBeInstanceOf(ProviderError)
  })
})

describe('extensionFor', () => {
  it('déduit l\'extension du type de contenu', () => {
    expect(extensionFor('image/png')).toBe('png')
    expect(extensionFor('image/jpeg')).toBe('jpg')
    expect(extensionFor('image/webp')).toBe('webp')
    expect(extensionFor('application/octet-stream')).toBe('jpg')
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

```bash
npx vitest run api/_lib/providers/bfl.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`api/_lib/providers/bfl.js` :
```js
// Seul fichier qui connaît BFL. Un autre fournisseur = un autre fichier avec les mêmes trois méthodes.
export class ProviderError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

const MAX_OCTETS = 20 * 1024 * 1024

function erreurHttp(status) {
  if (status === 401 || status === 403) return new ProviderError('invalid_key', 'Clé refusée par BFL.', status)
  if (status === 402) return new ProviderError('no_credits', 'Crédits BFL épuisés.', status)
  if (status === 429) return new ProviderError('rate_limited', 'Trop de demandes chez BFL.', status)
  return new ProviderError('provider_error', `BFL a répondu ${status}.`, status)
}

// La clé est envoyée à cette URL : elle doit rester dans le domaine bfl.ai.
function verifierUrlBfl(valeur) {
  let url
  try { url = new URL(valeur) } catch { throw new ProviderError('provider_error', 'URL de suivi invalide.') }
  const hoteOk = url.hostname === 'bfl.ai' || url.hostname.endsWith('.bfl.ai')
  if (url.protocol !== 'https:' || !hoteOk) throw new ProviderError('provider_error', 'URL de suivi hors du domaine BFL.')
}

export function extensionFor(contentType) {
  if (contentType?.includes('png')) return 'png'
  if (contentType?.includes('webp')) return 'webp'
  return 'jpg'
}

export function createBfl({ fetchImpl = fetch, baseUrl = 'https://api.eu.bfl.ai', model = 'flux-2-pro' } = {}) {
  async function submit({ apiKey, prompt, width, height, seed }) {
    const resp = await fetchImpl(`${baseUrl}/v1/${model}`, {
      method: 'POST',
      headers: { accept: 'application/json', 'Content-Type': 'application/json', 'x-key': apiKey },
      body: JSON.stringify({ prompt, width, height, seed }),
    })
    if (!resp.ok) throw erreurHttp(resp.status)
    const data = await resp.json()
    if (!data?.id || !data?.polling_url) throw new ProviderError('provider_error', 'Réponse BFL inattendue.')
    verifierUrlBfl(data.polling_url)
    return { id: data.id, pollingUrl: data.polling_url }
  }

  async function poll({ apiKey, pollingUrl }) {
    verifierUrlBfl(pollingUrl)
    const resp = await fetchImpl(pollingUrl, { headers: { accept: 'application/json', 'x-key': apiKey } })
    if (!resp.ok) throw erreurHttp(resp.status)
    const data = await resp.json()
    switch (data.status) {
      case 'Ready': {
        const sampleUrl = data.result?.sample
        if (!sampleUrl) throw new ProviderError('provider_error', 'Image absente de la réponse.')
        return { state: 'ready', sampleUrl }
      }
      case 'Request Moderated':
      case 'Content Moderated':
        return { state: 'refused' }
      case 'Error':
      case 'Failed':
        return { state: 'failed' }
      default:
        return { state: 'pending' }
    }
  }

  // Le lien de livraison expire au bout de 10 minutes : télécharger tout de suite.
  async function download(valeur) {
    if (new URL(valeur).protocol !== 'https:') throw new ProviderError('provider_error', 'Lien de téléchargement non sécurisé.')
    const resp = await fetchImpl(valeur)
    if (!resp.ok) throw new ProviderError('provider_error', `Téléchargement impossible (${resp.status}).`)
    const buffer = Buffer.from(await resp.arrayBuffer())
    if (buffer.length > MAX_OCTETS) throw new ProviderError('provider_error', 'Image trop volumineuse.')
    return { buffer, contentType: resp.headers.get('content-type') || 'image/jpeg' }
  }

  return { model, submit, poll, download }
}

export const bfl = createBfl({
  baseUrl: process.env.BFL_BASE_URL || undefined,
  model: process.env.BFL_MODEL || undefined,
})
```

Note de test : `download('http://...')` appelle `new URL` puis lève `ProviderError` avant tout `fetch`, ce que le test vérifie.

- [ ] **Step 4: Relancer le test**

```bash
npx vitest run api/_lib/providers/bfl.test.js
```
Expected : tous PASS.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): fournisseur BFL (submit/poll/download, garde de domaine)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Briques serveur communes (auth, admin, repo, cron, clé API)

**Files:**
- Create: `api/_lib/auth.js`, `api/_lib/admin.js`, `api/_lib/repo.js`, `api/_lib/cronAuth.js`, `api/_lib/resolveKey.js`, `tests/helpers.js`
- Test: `api/_lib/cronAuth.test.js`, `api/_lib/resolveKey.test.js`

- [ ] **Step 1: Écrire les tests**

`api/_lib/cronAuth.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { verifierCron } from './cronAuth.js'

describe('verifierCron', () => {
  it('accepte le bon secret', () => {
    expect(verifierCron('Bearer abc', 'abc')).toBe(true)
  })
  it('refuse un mauvais secret, un en-tête absent, un secret non configuré', () => {
    expect(verifierCron('Bearer abd', 'abc')).toBe(false)
    expect(verifierCron('Bearer ab', 'abc')).toBe(false)
    expect(verifierCron(undefined, 'abc')).toBe(false)
    expect(verifierCron('Bearer ', '')).toBe(false)
    expect(verifierCron('Bearer undefined', undefined)).toBe(false)
  })
})
```

`api/_lib/resolveKey.test.js` :
```js
import { describe, it, expect, vi } from 'vitest'
import { cleApi } from './resolveKey.js'
import { ProviderError } from './providers/bfl.js'

describe('cleApi', () => {
  it('essai : clé de l\'environnement', async () => {
    const k = await cleApi({ keyMode: 'trial', userId: 'u', repo: {}, dechiffrer: vi.fn(), ring: vi.fn(), env: { BFL_API_KEY: 'JF' } })
    expect(k).toBe('JF')
  })
  it('essai sans clé configurée : erreur fournisseur', async () => {
    await expect(cleApi({ keyMode: 'trial', userId: 'u', repo: {}, dechiffrer: vi.fn(), ring: vi.fn(), env: {} })).rejects.toBeInstanceOf(ProviderError)
  })
  it('clé personnelle : déchiffrée pour cet utilisateur', async () => {
    const repo = { getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })) }
    const dechiffrer = vi.fn(() => 'perso')
    const ring = vi.fn(() => 'RING')
    const k = await cleApi({ keyMode: 'own', userId: 'u1', repo, dechiffrer, ring, env: {} })
    expect(k).toBe('perso')
    expect(dechiffrer).toHaveBeenCalledWith({ ciphertext: 'c', iv: 'i', secret_version: '1' }, 'u1', 'RING')
  })
  it('clé personnelle absente : clé refusée', async () => {
    const repo = { getKey: vi.fn(async () => null) }
    await expect(cleApi({ keyMode: 'own', userId: 'u', repo, dechiffrer: vi.fn(), ring: vi.fn(), env: {} })).rejects.toMatchObject({ code: 'invalid_key' })
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

```bash
npx vitest run api/_lib/cronAuth.test.js api/_lib/resolveKey.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter les briques testées**

`api/_lib/cronAuth.js` :
```js
import { timingSafeEqual } from 'node:crypto'

// Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». Comparaison en temps constant.
export function verifierCron(enTete, secret) {
  if (!secret) return false
  const attendu = Buffer.from(`Bearer ${secret}`)
  const recu = Buffer.from(String(enTete ?? ''))
  if (recu.length !== attendu.length) return false
  return timingSafeEqual(recu, attendu)
}
```

`api/_lib/resolveKey.js` :
```js
import { ProviderError } from './providers/bfl.js'

// Clé BFL à utiliser pour une génération : celle de JF (essai) ou celle de l'enseignant (déchiffrée en mémoire).
export async function cleApi({ keyMode, userId, repo, dechiffrer, ring, env }) {
  if (keyMode === 'trial') {
    if (!env.BFL_API_KEY) throw new ProviderError('provider_error', 'BFL_API_KEY manquante.')
    return env.BFL_API_KEY
  }
  const rec = await repo.getKey(userId)
  if (!rec) throw new ProviderError('invalid_key', 'Aucune clé enregistrée.')
  return dechiffrer(rec, userId, ring())
}
```

- [ ] **Step 4: Écrire les briques non testées unitairement (couvertes par le test d'intégration et le test réel)**

`api/_lib/auth.js` :
```js
import { createClient } from '@supabase/supabase-js'

let anon
function client() {
  if (!anon) {
    anon = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    )
  }
  return anon
}

// Valide le jeton Supabase (Authorization: Bearer <access_token>) ; envoie la 401 et retourne null sinon.
export async function requireUser(req, res) {
  const entete = req.headers.authorization || ''
  const jeton = entete.startsWith('Bearer ') ? entete.slice(7) : null
  if (!jeton) {
    res.status(401).json({ error: 'Connexion requise.' })
    return null
  }
  const { data, error } = await client().auth.getUser(jeton)
  if (error || !data?.user) {
    res.status(401).json({ error: 'Session invalide ou expirée : reconnectez-vous.' })
    return null
  }
  return data.user
}
```

`api/_lib/admin.js` :
```js
import { createClient } from '@supabase/supabase-js'

let client

// Client service role : serveur uniquement, jamais exposé au frontend.
export function admin() {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase admin non configuré.')
    client = createClient(url, key, { auth: { persistSession: false } })
  }
  return client
}
```

`api/_lib/repo.js` :
```js
import { admin } from './admin.js'

const BUCKET = 'img-generations'

function ok({ data, error }) {
  if (error) throw error
  return data
}

export function createRepo(getDb = admin) {
  const db = () => getDb()
  const storage = () => db().storage.from(BUCKET)

  return {
    async getAccount(userId) {
      return ok(await db().from('img_accounts').select('*').eq('user_id', userId).maybeSingle())
    },
    // N'écrit pas trial_started_at : il est posé une seule fois (défaut now()) à la première acceptation.
    async upsertAccount(userId, version, nowIso) {
      return ok(await db().from('img_accounts')
        .upsert({ user_id: userId, terms_version: version, terms_accepted_at: nowIso }, { onConflict: 'user_id' })
        .select().single())
    },
    async getKey(userId) {
      return ok(await db().from('img_user_keys').select('ciphertext, iv, secret_version').eq('user_id', userId).maybeSingle())
    },
    async saveKey(userId, rec) {
      ok(await db().from('img_user_keys').upsert({ user_id: userId, ...rec }, { onConflict: 'user_id' }))
      ok(await db().from('img_accounts').update({ has_own_key: true }).eq('user_id', userId))
    },
    async deleteKey(userId) {
      ok(await db().from('img_user_keys').delete().eq('user_id', userId))
      ok(await db().from('img_accounts').update({ has_own_key: false }).eq('user_id', userId))
    },
    async reserveQuota(userId, day, userLimit, globalLimit) {
      return ok(await db().rpc('img_reserve_quota', { p_user: userId, p_day: day, p_user_limit: userLimit, p_global_limit: globalLimit }))
    },
    async refundQuota(userId, day) {
      ok(await db().rpc('img_refund_quota', { p_user: userId, p_day: day }))
    },
    async failStalePending(userId, olderThanIso) {
      const lignes = ok(await db().from('img_generations').update({ status: 'failed' })
        .eq('user_id', userId).eq('status', 'pending').lt('created_at', olderThanIso)
        .select('id, user_id, quota_day'))
      if (lignes.length) ok(await db().from('img_jobs').delete().in('generation_id', lignes.map((l) => l.id)))
      return lignes
    },
    async failStaleAll(olderThanIso) {
      const lignes = ok(await db().from('img_generations').update({ status: 'failed' })
        .eq('status', 'pending').lt('created_at', olderThanIso)
        .select('id, user_id, quota_day'))
      if (lignes.length) ok(await db().from('img_jobs').delete().in('generation_id', lignes.map((l) => l.id)))
      return lignes
    },
    async insertGeneration(row) {
      const { data, error } = await db().from('img_generations').insert(row).select().single()
      if (error) {
        if (error.code === '23505') throw Object.assign(new Error('busy'), { code: 'busy' })
        throw error
      }
      return data
    },
    async insertJob(generationId, pollingUrl) {
      ok(await db().from('img_jobs').insert({ generation_id: generationId, polling_url: pollingUrl }))
    },
    async getGeneration(id, userId) {
      return ok(await db().from('img_generations').select('*').eq('id', id).eq('user_id', userId).maybeSingle())
    },
    async getJob(generationId) {
      return ok(await db().from('img_jobs').select('*').eq('generation_id', generationId).maybeSingle())
    },
    async deleteJob(generationId) {
      ok(await db().from('img_jobs').delete().eq('generation_id', generationId))
    },
    async markDone(id, imagePath, expiresAtIso) {
      ok(await db().from('img_generations').update({ status: 'done', image_path: imagePath, image_expires_at: expiresAtIso }).eq('id', id))
    },
    async markFailed(id, status) {
      ok(await db().from('img_generations').update({ status }).eq('id', id))
    },
    async uploadImage(path, buffer, contentType) {
      const { error } = await storage().upload(path, buffer, { contentType, upsert: true })
      if (error) throw error
    },
    async removeImages(paths) {
      if (!paths.length) return
      const { error } = await storage().remove(paths)
      if (error) throw error
    },
    async listExpired(nowIso, limit) {
      return ok(await db().from('img_generations').select('id, image_path')
        .not('image_path', 'is', null).is('image_deleted_at', null).lt('image_expires_at', nowIso).limit(limit))
    },
    async markImagesDeleted(ids, nowIso) {
      ok(await db().from('img_generations').update({ image_path: null, image_deleted_at: nowIso }).in('id', ids))
    },
    async deleteGeneration(id, userId) {
      ok(await db().from('img_generations').delete().eq('id', id).eq('user_id', userId))
    },
    // Supprime toutes les données ImagActif d'un utilisateur. L'identifiant de connexion (auth.users) est conservé : il est partagé entre apps PLAI.
    async deleteAllUserData(userId) {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await storage().list(userId, { limit: 1000 })
        if (error) throw error
        if (!data?.length) break
        const { error: e2 } = await storage().remove(data.map((f) => `${userId}/${f.name}`))
        if (e2) throw e2
      }
      for (const table of ['img_templates', 'img_usage', 'img_user_keys', 'img_generations']) {
        ok(await db().from(table).delete().eq('user_id', userId))
      }
      // La ligne de compte est conservée sans les règles acceptées ni la clé : seule la date de début d'essai reste,
      // sinon supprimer ses données renouvellerait l'essai gratuit à l'infini. Réacceptation requise à la reconnexion.
      ok(await db().from('img_accounts').update({ terms_version: '', has_own_key: false }).eq('user_id', userId))
    },
  }
}
```

`tests/helpers.js` :
```js
import { vi } from 'vitest'
import { TERMS_VERSION } from '../src/lib/terms.js'

export const NOW = new Date('2026-10-08T10:00:00Z')
export const USER = { id: 'u1', email: 'prof@exemple.be', email_confirmed_at: '2026-10-01T00:00:00Z' }

export function makeRes() {
  const res = { code: 200, body: undefined, headers: {} }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  res.setHeader = (k, v) => { res.headers[k] = v }
  return res
}

export const okAuth = async () => USER
export const noAuth = async (req, res) => { res.status(401).json({ error: 'Connexion requise.' }); return null }

export const ACCOUNT = {
  user_id: 'u1',
  trial_started_at: '2026-10-07T10:00:00Z',
  terms_version: TERMS_VERSION,
  has_own_key: false,
}

export function fakeRepo(over = {}) {
  return {
    getAccount: vi.fn(async () => ACCOUNT),
    failStalePending: vi.fn(async () => []),
    getKey: vi.fn(async () => null),
    reserveQuota: vi.fn(async () => 'ok'),
    refundQuota: vi.fn(async () => {}),
    getGeneration: vi.fn(async () => null),
    insertGeneration: vi.fn(async (row) => ({ id: 'g1', ...row })),
    insertJob: vi.fn(async () => {}),
    getJob: vi.fn(async () => null),
    deleteJob: vi.fn(async () => {}),
    markDone: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    uploadImage: vi.fn(async () => {}),
    removeImages: vi.fn(async () => {}),
    deleteGeneration: vi.fn(async () => {}),
    deleteAllUserData: vi.fn(async () => {}),
    upsertAccount: vi.fn(async (userId, version) => ({ ...ACCOUNT, terms_version: version })),
    saveKey: vi.fn(async () => {}),
    deleteKey: vi.fn(async () => {}),
    ...over,
  }
}

export function fakeBfl(over = {}) {
  return {
    model: 'flux-2-pro',
    submit: vi.fn(async () => ({ id: 'b1', pollingUrl: 'https://api.eu.bfl.ai/v1/get_result?id=b1' })),
    poll: vi.fn(async () => ({ state: 'pending' })),
    download: vi.fn(async () => ({ buffer: Buffer.from([1, 2, 3]), contentType: 'image/png' })),
    ...over,
  }
}
```

- [ ] **Step 5: Relancer les tests**

```bash
npx vitest run api/_lib/cronAuth.test.js api/_lib/resolveKey.test.js
```
Expected : PASS.

- [ ] **Step 6: Commit**

```bash
git add api tests/helpers.js
git commit -m "feat(api): auth, accès admin, repo, vérification cron, résolution de clé" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: API règlement et clé personnelle

**Files:**
- Create: `api/_lib/handlers/terms.js`, `api/_lib/handlers/key.js`, `api/terms.js`, `api/key.js`
- Test: `api/_lib/handlers/terms.test.js`, `api/_lib/handlers/key.test.js`

- [ ] **Step 1: Écrire les tests**

`api/_lib/handlers/terms.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { createTermsHandler } from './terms.js'
import { makeRes, okAuth, noAuth, fakeRepo, NOW } from '../../../tests/helpers.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'

const req = (over = {}) => ({ method: 'POST', headers: {}, body: { version: TERMS_VERSION }, ...over })

describe('POST /api/terms', () => {
  it('405 hors POST', async () => {
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo: fakeRepo() })(req({ method: 'GET' }), res)
    expect(res.code).toBe(405)
  })
  it('401 sans session', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createTermsHandler({ requireUser: noAuth, repo })(req(), res)
    expect(res.code).toBe(401)
    expect(repo.upsertAccount).not.toHaveBeenCalled()
  })
  it('400 si la version ne correspond pas', async () => {
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo: fakeRepo() })(req({ body: { version: 'ancienne' } }), res)
    expect(res.code).toBe(400)
  })
  it('enregistre l\'acceptation', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createTermsHandler({ requireUser: okAuth, repo, now: () => NOW })(req(), res)
    expect(res.code).toBe(200)
    expect(repo.upsertAccount).toHaveBeenCalledWith('u1', TERMS_VERSION, NOW.toISOString())
  })
})
```

`api/_lib/handlers/key.test.js` :
```js
import { describe, it, expect, vi } from 'vitest'
import { createKeyHandler } from './key.js'
import { makeRes, okAuth, fakeRepo } from '../../../tests/helpers.js'

const chiffrer = vi.fn((clair, userId) => ({ ciphertext: `enc(${clair})`, iv: 'iv', secret_version: '1' }))
const ring = () => 'RING'
const deps = (repo) => ({ requireUser: okAuth, repo, chiffrer, ring })
const CLE = 'abcd1234-abcd-1234-abcd-1234567890ab'

describe('/api/key', () => {
  it('PUT enregistre la clé chiffrée, jamais en clair', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key: `  ${CLE}  ` } }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ hasOwnKey: true })
    expect(chiffrer).toHaveBeenCalledWith(CLE, 'u1', 'RING')
    expect(repo.saveKey).toHaveBeenCalledWith('u1', { ciphertext: `enc(${CLE})`, iv: 'iv', secret_version: '1' })
    expect(JSON.stringify(res.body)).not.toContain(CLE)
  })
  it('PUT refuse une clé de forme invalide', async () => {
    for (const key of ['court', 'a b c d e f g h i j k l m n o p', '', 123, undefined]) {
      const repo = fakeRepo()
      const res = makeRes()
      await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key } }, res)
      expect(res.code).toBe(400)
      expect(repo.saveKey).not.toHaveBeenCalled()
    }
  })
  it('PUT exige d\'avoir accepté le règlement', async () => {
    const repo = fakeRepo({ getAccount: vi.fn(async () => null) })
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'PUT', headers: {}, body: { key: CLE } }, res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('terms')
  })
  it('DELETE supprime la clé', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createKeyHandler(deps(repo))({ method: 'DELETE', headers: {} }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ hasOwnKey: false })
    expect(repo.deleteKey).toHaveBeenCalledWith('u1')
  })
  it('405 pour les autres méthodes', async () => {
    const res = makeRes()
    await createKeyHandler(deps(fakeRepo()))({ method: 'GET', headers: {} }, res)
    expect(res.code).toBe(405)
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

```bash
npx vitest run api/_lib/handlers/terms.test.js api/_lib/handlers/key.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter les handlers**

`api/_lib/handlers/terms.js` :
```js
import { TERMS_VERSION } from '../../../src/lib/terms.js'

export function createTermsHandler({ requireUser, repo, now = () => new Date() }) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (req.body?.version !== TERMS_VERSION) {
      return res.status(400).json({ error: 'Version du règlement inconnue.', code: 'terms_version' })
    }
    const account = await repo.upsertAccount(user.id, TERMS_VERSION, now().toISOString())
    return res.status(200).json({ account })
  }
}
```

`api/_lib/handlers/key.js` :
```js
import { MESSAGES } from '../../../src/lib/messages.js'

const FORME_CLE = /^[A-Za-z0-9_.-]{16,200}$/

export function createKeyHandler({ requireUser, repo, chiffrer, ring }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'PUT' && req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return

    if (req.method === 'DELETE') {
      await repo.deleteKey(user.id)
      return res.status(200).json({ hasOwnKey: false })
    }

    const brute = req.body?.key
    const cle = typeof brute === 'string' ? brute.trim() : ''
    if (!FORME_CLE.test(cle)) {
      return res.status(400).json({ error: 'Cette clé n\'a pas la forme attendue : collez-la sans espace.', code: 'invalid_key_format' })
    }
    const account = await repo.getAccount(user.id)
    if (!account) return res.status(403).json({ error: MESSAGES.terms, code: 'terms' })

    await repo.saveKey(user.id, chiffrer(cle, user.id, ring()))
    return res.status(200).json({ hasOwnKey: true })
  }
}
```

`api/terms.js` :
```js
import { createTermsHandler } from './_lib/handlers/terms.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createTermsHandler({ requireUser, repo: createRepo() })
```

`api/key.js` :
```js
import { createKeyHandler } from './_lib/handlers/key.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { chiffrer, ringFromEnv } from './_lib/crypto.js'

export default createKeyHandler({ requireUser, repo: createRepo(), chiffrer, ring: ringFromEnv })
```

- [ ] **Step 4: Relancer les tests**

```bash
npx vitest run api/_lib/handlers/terms.test.js api/_lib/handlers/key.test.js
```
Expected : PASS.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): acceptation du règlement et gestion de la clé personnelle" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: API de génération

**Files:**
- Create: `api/_lib/handlers/generate.js`, `api/generate.js`
- Test: `api/_lib/handlers/generate.test.js`

- [ ] **Step 1: Écrire le test**

```js
import { describe, it, expect, vi } from 'vitest'
import { createGenerateHandler } from './generate.js'
import { makeRes, okAuth, noAuth, fakeRepo, fakeBfl, ACCOUNT, NOW, USER } from '../../../tests/helpers.js'
import { gabaritVide } from '../../../src/lib/gabarit.js'
import { ProviderError } from '../providers/bfl.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'

function gabarit(over = {}) {
  const g = gabaritVide()
  g.sujet.description = 'Un chat roux'
  return Object.assign(g, over)
}
const req = (body = { gabarit: gabarit() }, method = 'POST') => ({ method, headers: {}, body })

function deps(over = {}) {
  return {
    requireUser: okAuth,
    repo: fakeRepo(),
    bfl: fakeBfl(),
    dechiffrer: vi.fn(() => 'cle-perso'),
    ring: () => 'RING',
    env: { BFL_API_KEY: 'cle-jf' },
    now: () => NOW,
    seedAleatoire: () => 4242,
    ...over,
  }
}

describe('POST /api/generate : garde-fous', () => {
  it('405 hors POST', async () => {
    const res = makeRes()
    await createGenerateHandler(deps())(req({}, 'GET'), res)
    expect(res.code).toBe(405)
  })
  it('401 sans session', async () => {
    const d = deps({ requireUser: noAuth })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(401)
    expect(d.repo.getAccount).not.toHaveBeenCalled()
  })
  it('403 si l\'e-mail n\'est pas confirmé', async () => {
    const res = makeRes()
    await createGenerateHandler(deps({ requireUser: async () => ({ ...USER, email_confirmed_at: null }) }))(req(), res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('email_unconfirmed')
  })
  it('403 sans compte ou avec un règlement ancien', async () => {
    for (const compte of [null, { ...ACCOUNT, terms_version: 'ancienne' }]) {
      const res = makeRes()
      await createGenerateHandler(deps({ repo: fakeRepo({ getAccount: vi.fn(async () => compte) }) }))(req(), res)
      expect(res.code).toBe(403)
      expect(res.body.code).toBe('terms')
    }
  })
  it('400 sans sujet ou avec un JSON invalide', async () => {
    for (const body of [{ gabarit: gabaritVide() }, { gabarit: 'texte' }, {}]) {
      const res = makeRes()
      await createGenerateHandler(deps())(req(body), res)
      expect(res.code).toBe(400)
    }
  })
  it('400 si l\'image d\'origine n\'appartient pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createGenerateHandler(deps())(req({ gabarit: gabarit(), parentId: 'autre' }), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_parent')
  })
  it('403 trial_over : essai terminé et pas de clé', async () => {
    const vieux = { ...ACCOUNT, trial_started_at: '2026-10-01T00:00:00Z' }
    const d = deps({ repo: fakeRepo({ getAccount: vi.fn(async () => vieux) }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(403)
    expect(res.body.code).toBe('trial_over')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
})

describe('POST /api/generate : essai', () => {
  it('réserve le quota, utilise la clé de JF et enregistre la graine', async () => {
    const d = deps()
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(202)
    expect(res.body).toEqual({ id: 'g1' })
    expect(d.repo.reserveQuota).toHaveBeenCalledWith('u1', '2026-10-08', 10, 100)
    const ligne = d.repo.insertGeneration.mock.calls[0][0]
    expect(ligne).toMatchObject({ user_id: 'u1', seed: 4242, key_mode: 'trial', quota_day: '2026-10-08', model: 'flux-2-pro' })
    expect(ligne.json.generation.seed).toBe(4242)
    expect(ligne.prompt_text).toContain('Un chat roux.')
    expect(d.bfl.submit).toHaveBeenCalledWith({ apiKey: 'cle-jf', prompt: ligne.prompt_text, width: 1024, height: 1024, seed: 4242 })
    expect(d.repo.insertJob).toHaveBeenCalledWith('g1', 'https://api.eu.bfl.ai/v1/get_result?id=b1')
  })
  it('conserve la graine fournie et le format demandé', async () => {
    const g = gabarit()
    g.generation.seed = 7
    g.format.ratio = '16:9'
    const d = deps()
    await createGenerateHandler(d)(req({ gabarit: g }), makeRes())
    expect(d.bfl.submit.mock.calls[0][0]).toMatchObject({ seed: 7, width: 1344, height: 768 })
  })
  it('refuse quand la limite individuelle est atteinte (aucun appel BFL)', async () => {
    const d = deps({ repo: fakeRepo({ reserveQuota: vi.fn(async () => 'user_limit') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('quota_user')
    expect(d.bfl.submit).not.toHaveBeenCalled()
    expect(d.repo.insertGeneration).not.toHaveBeenCalled()
  })
  it('refuse quand le disjoncteur global est atteint', async () => {
    const d = deps({ repo: fakeRepo({ reserveQuota: vi.fn(async () => 'global_limit') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(503)
    expect(res.body.code).toBe('quota_global')
  })
  it('rembourse les générations bloquées depuis plus de 5 minutes', async () => {
    const repo = fakeRepo({
      failStalePending: vi.fn(async () => [{ id: 'old1', quota_day: '2026-10-07' }, { id: 'old2', quota_day: null }]),
    })
    await createGenerateHandler(deps({ repo }))(req(), makeRes())
    expect(repo.failStalePending).toHaveBeenCalledWith('u1', new Date(NOW.getTime() - 5 * 60 * 1000).toISOString())
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-07')
    expect(repo.refundQuota).not.toHaveBeenCalledWith('u1', null)
  })
  it('409 et remboursement quand une génération est déjà en cours', async () => {
    const repo = fakeRepo({ insertGeneration: vi.fn(async () => { throw Object.assign(new Error('busy'), { code: 'busy' }) }) })
    const d = deps({ repo })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(409)
    expect(res.body.code).toBe('busy')
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('échec BFL : génération marquée échouée, quota remboursé, code traduit', async () => {
    const bfl = fakeBfl({ submit: vi.fn(async () => { throw new ProviderError('rate_limited', 'x', 429) }) })
    const d = deps({ bfl })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(429)
    expect(res.body.code).toBe('rate_limited')
    expect(d.repo.markFailed).toHaveBeenCalledWith('g1', 'failed')
    expect(d.repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
  })
  it('clé de JF absente : erreur propre et remboursement', async () => {
    const d = deps({ env: {} })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(500)
    expect(d.repo.refundQuota).toHaveBeenCalled()
  })
})

describe('POST /api/generate : clé personnelle', () => {
  const avecCle = () => fakeRepo({
    getAccount: vi.fn(async () => ({ ...ACCOUNT, trial_started_at: '2026-09-01T00:00:00Z', has_own_key: true })),
    getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })),
  })
  it('déchiffre la clé, ne touche pas au quota', async () => {
    const d = deps({ repo: avecCle() })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(202)
    expect(d.repo.reserveQuota).not.toHaveBeenCalled()
    expect(d.bfl.submit.mock.calls[0][0].apiKey).toBe('cle-perso')
    expect(d.repo.insertGeneration.mock.calls[0][0]).toMatchObject({ key_mode: 'own', quota_day: null })
  })
  it('clé illisible : message dédié, aucun appel BFL', async () => {
    const d = deps({ repo: avecCle(), dechiffrer: vi.fn(() => { throw new Error('boom') }) })
    const res = makeRes()
    await createGenerateHandler(d)(req(), res)
    expect(res.code).toBe(500)
    expect(res.body.code).toBe('key_unreadable')
    expect(d.bfl.submit).not.toHaveBeenCalled()
  })
  it('clé refusée par BFL : 400 invalid_key', async () => {
    const bfl = fakeBfl({ submit: vi.fn(async () => { throw new ProviderError('invalid_key', 'x', 401) }) })
    const res = makeRes()
    await createGenerateHandler(deps({ repo: avecCle(), bfl }))(req(), res)
    expect(res.code).toBe(400)
    expect(res.body.code).toBe('invalid_key')
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

```bash
npx vitest run api/_lib/handlers/generate.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`api/_lib/handlers/generate.js` :
```js
import { randomInt } from 'node:crypto'
import { normaliserGabarit, validerPourGeneration } from '../../../src/lib/gabarit.js'
import { composePrompt } from '../../../src/lib/composePrompt.js'
import { dimensions } from '../../../src/lib/ratios.js'
import { determineRegime } from '../../../src/lib/regime.js'
import { jourBruxelles } from '../../../src/lib/dates.js'
import { TERMS_VERSION } from '../../../src/lib/terms.js'
import { limitsFromEnv } from '../../../src/lib/limits.js'
import { MESSAGES } from '../../../src/lib/messages.js'
import { ProviderError } from '../providers/bfl.js'
import { cleApi } from '../resolveKey.js'

const STALE_MS = 5 * 60 * 1000
const STATUTS = { invalid_key: 400, no_credits: 402, rate_limited: 429, provider_error: 502 }

const echec = (res, status, code) => res.status(status).json({ error: MESSAGES[code], code })

export function createGenerateHandler({
  requireUser, repo, bfl, dechiffrer, ring,
  env = process.env,
  now = () => new Date(),
  seedAleatoire = () => randomInt(0, 4294967296),
}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (!user.email_confirmed_at) return echec(res, 403, 'email_unconfirmed')

    const account = await repo.getAccount(user.id)
    if (!account || account.terms_version !== TERMS_VERSION) return echec(res, 403, 'terms')

    let gabarit
    try {
      gabarit = normaliserGabarit(req.body?.gabarit).gabarit
    } catch (err) {
      return res.status(400).json({ error: err.message, code: 'invalid_json' })
    }
    const problemes = validerPourGeneration(gabarit)
    if (problemes.length) return res.status(400).json({ error: problemes.join(' '), code: 'invalid_json' })

    let parentId = null
    if (req.body?.parentId) {
      const parent = await repo.getGeneration(String(req.body.parentId), user.id)
      if (!parent) return echec(res, 400, 'invalid_parent')
      parentId = parent.id
    }

    const maintenant = now()
    const regime = determineRegime({ trialStartedAt: account.trial_started_at, hasOwnKey: account.has_own_key, now: maintenant })
    if (regime === 'none') return echec(res, 403, 'trial_over')

    // Débloque et rembourse les générations restées « en cours » trop longtemps.
    const perimees = await repo.failStalePending(user.id, new Date(maintenant.getTime() - STALE_MS).toISOString())
    for (const p of perimees) if (p.quota_day) await repo.refundQuota(user.id, p.quota_day)

    let quotaDay = null
    if (regime === 'trial') {
      const limites = limitsFromEnv(env)
      quotaDay = jourBruxelles(maintenant)
      const reservation = await repo.reserveQuota(user.id, quotaDay, limites.user, limites.global)
      if (reservation === 'user_limit') return echec(res, 429, 'quota_user')
      if (reservation === 'global_limit') return echec(res, 503, 'quota_global')
    }
    const rembourser = async () => { if (quotaDay) await repo.refundQuota(user.id, quotaDay) }

    let apiKey
    try {
      apiKey = await cleApi({ keyMode: regime, userId: user.id, repo, dechiffrer, ring, env })
    } catch (err) {
      await rembourser()
      const code = err instanceof ProviderError && err.code !== 'invalid_key' ? err.code : 'key_unreadable'
      return echec(res, 500, code)
    }

    const seed = gabarit.generation.seed ?? seedAleatoire()
    gabarit.generation.seed = seed
    const { width, height } = dimensions(gabarit.format.ratio)
    const promptText = composePrompt(gabarit)

    let generation
    try {
      generation = await repo.insertGeneration({
        user_id: user.id, json: gabarit, prompt_text: promptText, seed, model: bfl.model,
        key_mode: regime, quota_day: quotaDay, parent_id: parentId,
      })
    } catch (err) {
      await rembourser()
      if (err.code === 'busy') return echec(res, 409, 'busy')
      throw err
    }

    try {
      const { pollingUrl } = await bfl.submit({ apiKey, prompt: promptText, width, height, seed })
      await repo.insertJob(generation.id, pollingUrl)
      return res.status(202).json({ id: generation.id })
    } catch (err) {
      await repo.markFailed(generation.id, 'failed')
      await rembourser()
      if (err instanceof ProviderError) return echec(res, STATUTS[err.code] ?? 502, err.code)
      throw err
    }
  }
}
```

Dans le cas « clé de JF absente » du test, `cleApi` lève `ProviderError('provider_error')` : le code d'erreur renvoyé est `provider_error` avec statut 500 (le test vérifie 500 et le remboursement).

`api/generate.js` :
```js
import { createGenerateHandler } from './_lib/handlers/generate.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { bfl } from './_lib/providers/bfl.js'
import { dechiffrer, ringFromEnv } from './_lib/crypto.js'

export default createGenerateHandler({ requireUser, repo: createRepo(), bfl, dechiffrer, ring: ringFromEnv })
```

- [ ] **Step 4: Relancer le test**

```bash
npx vitest run api/_lib/handlers/generate.test.js
```
Expected : tous PASS.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): génération (régimes, quota, une seule image en cours, remboursements)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: API de suivi (status)

**Files:**
- Create: `api/_lib/handlers/status.js`, `api/status.js`
- Test: `api/_lib/handlers/status.test.js`

- [ ] **Step 1: Écrire le test**

```js
import { describe, it, expect, vi } from 'vitest'
import { createStatusHandler } from './status.js'
import { makeRes, okAuth, noAuth, fakeRepo, fakeBfl, NOW } from '../../../tests/helpers.js'
import { ProviderError } from '../providers/bfl.js'

const GEN = { id: 'g1', user_id: 'u1', status: 'pending', key_mode: 'trial', quota_day: '2026-10-08' }
const JOB = { generation_id: 'g1', polling_url: 'https://api.eu.bfl.ai/v1/get_result?id=b1' }
const req = (id = 'g1', method = 'GET') => ({ method, headers: {}, query: { id } })

function deps(over = {}, repoOver = {}) {
  return {
    requireUser: okAuth,
    repo: fakeRepo({ getGeneration: vi.fn(async () => GEN), getJob: vi.fn(async () => JOB), ...repoOver }),
    bfl: fakeBfl(),
    dechiffrer: vi.fn(() => 'cle-perso'),
    ring: () => 'RING',
    env: { BFL_API_KEY: 'cle-jf' },
    now: () => NOW,
    ...over,
  }
}

describe('GET /api/status', () => {
  it('401 sans session, 405 hors GET, 400 sans id', async () => {
    let res = makeRes()
    await createStatusHandler(deps({ requireUser: noAuth }))(req(), res)
    expect(res.code).toBe(401)
    res = makeRes()
    await createStatusHandler(deps())(req('g1', 'POST'), res)
    expect(res.code).toBe(405)
    res = makeRes()
    await createStatusHandler(deps())({ method: 'GET', headers: {}, query: {} }, res)
    expect(res.code).toBe(400)
  })
  it('404 pour une image qui n\'est pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createStatusHandler(deps({}, { getGeneration: vi.fn(async () => null) }))(req(), res)
    expect(res.code).toBe(404)
  })
  it('renvoie directement le statut final déjà connu', async () => {
    const d = deps({}, { getGeneration: vi.fn(async () => ({ ...GEN, status: 'done' })) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'done' })
    expect(d.bfl.poll).not.toHaveBeenCalled()
  })
  it('reste en cours tant que BFL n\'a pas fini', async () => {
    const res = makeRes()
    await createStatusHandler(deps())(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
  })
  it('prête : télécharge, dépose le fichier, fixe l\'échéance à 30 jours', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.png' })) })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'done' })
    expect(bfl.poll).toHaveBeenCalledWith({ apiKey: 'cle-jf', pollingUrl: JOB.polling_url })
    expect(d.repo.uploadImage).toHaveBeenCalledWith('u1/g1.png', expect.any(Buffer), 'image/png')
    expect(d.repo.markDone).toHaveBeenCalledWith('g1', 'u1/g1.png', '2026-11-07T10:00:00.000Z')
    expect(d.repo.deleteJob).toHaveBeenCalledWith('g1')
  })
  it('refus de modération : échec, quota remboursé', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'refused' })) })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'refused' })
    expect(d.repo.markFailed).toHaveBeenCalledWith('g1', 'refused')
    expect(d.repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
  })
  it('échec BFL en clé personnelle : pas de remboursement', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => ({ state: 'failed' })) })
    const d = deps({ bfl }, { getGeneration: vi.fn(async () => ({ ...GEN, key_mode: 'own', quota_day: null })), getKey: vi.fn(async () => ({ ciphertext: 'c', iv: 'i', secret_version: '1' })) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
    expect(d.repo.refundQuota).not.toHaveBeenCalled()
    expect(bfl.poll.mock.calls[0][0].apiKey).toBe('cle-perso')
  })
  it('tâche introuvable : marquée échouée', async () => {
    const d = deps({}, { getJob: vi.fn(async () => null) })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
    expect(d.repo.markFailed).toHaveBeenCalledWith('g1', 'failed')
  })
  it('erreur réseau passagère : reste en cours', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => { throw new ProviderError('provider_error', 'x', 500) }) })
    const res = makeRes()
    await createStatusHandler(deps({ bfl }))(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
  })
  it('clé refusée pendant le suivi : échec définitif', async () => {
    const bfl = fakeBfl({ poll: vi.fn(async () => { throw new ProviderError('invalid_key', 'x', 401) }) })
    const res = makeRes()
    await createStatusHandler(deps({ bfl }))(req(), res)
    expect(res.body).toEqual({ status: 'failed' })
  })
  it('téléchargement impossible : réessai au tour suivant', async () => {
    const bfl = fakeBfl({
      poll: vi.fn(async () => ({ state: 'ready', sampleUrl: 'https://delivery.bfl.ai/x.png' })),
      download: vi.fn(async () => { throw new ProviderError('provider_error', 'x') }),
    })
    const d = deps({ bfl })
    const res = makeRes()
    await createStatusHandler(d)(req(), res)
    expect(res.body).toEqual({ status: 'pending' })
    expect(d.repo.markDone).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

```bash
npx vitest run api/_lib/handlers/status.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`api/_lib/handlers/status.js` :
```js
import { imageExpiry } from '../../../src/lib/dates.js'
import { ProviderError, extensionFor } from '../providers/bfl.js'
import { cleApi } from '../resolveKey.js'

export function createStatusHandler({ requireUser, repo, bfl, dechiffrer, ring, env = process.env, now = () => new Date() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    const id = String(req.query?.id ?? '')
    if (!id) return res.status(400).json({ error: 'Identifiant manquant.' })

    const gen = await repo.getGeneration(id, user.id)
    if (!gen) return res.status(404).json({ error: 'Image introuvable.' })
    if (gen.status !== 'pending') return res.status(200).json({ status: gen.status })

    const echouer = async (statut) => {
      await repo.markFailed(gen.id, statut)
      await repo.deleteJob(gen.id)
      if (gen.quota_day) await repo.refundQuota(user.id, gen.quota_day)
      return res.status(200).json({ status: statut })
    }

    const job = await repo.getJob(gen.id)
    if (!job) return echouer('failed')

    let etat
    try {
      const apiKey = await cleApi({ keyMode: gen.key_mode, userId: user.id, repo, dechiffrer, ring, env })
      etat = await bfl.poll({ apiKey, pollingUrl: job.polling_url })
    } catch (err) {
      if (err instanceof ProviderError && err.code === 'invalid_key') return echouer('failed')
      return res.status(200).json({ status: 'pending' }) // panne passagère : le client réessaie
    }

    if (etat.state === 'pending') return res.status(200).json({ status: 'pending' })
    if (etat.state === 'refused') return echouer('refused')
    if (etat.state === 'failed') return echouer('failed')

    try {
      const { buffer, contentType } = await bfl.download(etat.sampleUrl)
      const chemin = `${user.id}/${gen.id}.${extensionFor(contentType)}`
      await repo.uploadImage(chemin, buffer, contentType)
      await repo.markDone(gen.id, chemin, imageExpiry(now()).toISOString())
      await repo.deleteJob(gen.id)
      return res.status(200).json({ status: 'done' })
    } catch {
      return res.status(200).json({ status: 'pending' }) // le lien BFL reste valable 10 minutes : nouvel essai au prochain tour
    }
  }
}
```

`api/status.js` :
```js
import { createStatusHandler } from './_lib/handlers/status.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'
import { bfl } from './_lib/providers/bfl.js'
import { dechiffrer, ringFromEnv } from './_lib/crypto.js'

export default createStatusHandler({ requireUser, repo: createRepo(), bfl, dechiffrer, ring: ringFromEnv })
```

- [ ] **Step 4: Relancer le test**

```bash
npx vitest run api/_lib/handlers/status.test.js
```
Expected : tous PASS.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): suivi de génération (téléchargement immédiat, échéance 30 jours)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Nettoyage quotidien, suppression d'une image, suppression des données

**Files:**
- Create: `api/_lib/handlers/cleanup.js`, `api/_lib/handlers/generation.js`, `api/_lib/handlers/account.js`, `api/cron/cleanup.js`, `api/generation.js`, `api/account.js`
- Test: `api/_lib/handlers/cleanup.test.js`, `api/_lib/handlers/generation.test.js`, `api/_lib/handlers/account.test.js`

- [ ] **Step 1: Écrire les tests**

`api/_lib/handlers/cleanup.test.js` :
```js
import { describe, it, expect, vi } from 'vitest'
import { runCleanup, createCleanupHandler } from './cleanup.js'
import { makeRes, fakeRepo, NOW } from '../../../tests/helpers.js'

function repoCleanup(lots, perimees = []) {
  const file = [...lots]
  return fakeRepo({
    listExpired: vi.fn(async () => file.shift() ?? []),
    markImagesDeleted: vi.fn(async () => {}),
    failStaleAll: vi.fn(async () => perimees),
  })
}

describe('runCleanup', () => {
  it('supprime les fichiers puis marque les lignes, lot par lot', async () => {
    const repo = repoCleanup([[{ id: 'a', image_path: 'u/a.png' }, { id: 'b', image_path: 'u/b.jpg' }], [{ id: 'c', image_path: 'u/c.png' }]])
    const r = await runCleanup({ repo, now: NOW })
    expect(r.imagesSupprimees).toBe(3)
    expect(repo.removeImages).toHaveBeenNthCalledWith(1, ['u/a.png', 'u/b.jpg'])
    expect(repo.markImagesDeleted).toHaveBeenNthCalledWith(1, ['a', 'b'], NOW.toISOString())
    expect(repo.markImagesDeleted).toHaveBeenNthCalledWith(2, ['c'], NOW.toISOString())
  })
  it('ne marque rien si la suppression des fichiers échoue', async () => {
    const repo = repoCleanup([[{ id: 'a', image_path: 'u/a.png' }]])
    repo.removeImages = vi.fn(async () => { throw new Error('storage down') })
    await expect(runCleanup({ repo, now: NOW })).rejects.toThrow('storage down')
    expect(repo.markImagesDeleted).not.toHaveBeenCalled()
  })
  it('échoue et rembourse les générations bloquées depuis plus de 15 minutes', async () => {
    const repo = repoCleanup([], [{ id: 'x', user_id: 'u1', quota_day: '2026-10-08' }, { id: 'y', user_id: 'u2', quota_day: null }])
    const r = await runCleanup({ repo, now: NOW })
    expect(repo.failStaleAll).toHaveBeenCalledWith(new Date(NOW.getTime() - 15 * 60 * 1000).toISOString())
    expect(repo.refundQuota).toHaveBeenCalledTimes(1)
    expect(repo.refundQuota).toHaveBeenCalledWith('u1', '2026-10-08')
    expect(r.echecsNettoyes).toBe(2)
  })
})

describe('createCleanupHandler', () => {
  it('401 sans le bon secret', async () => {
    const repo = repoCleanup([])
    const res = makeRes()
    await createCleanupHandler({ repo, secret: 's3cret', now: () => NOW })({ method: 'GET', headers: { authorization: 'Bearer faux' } }, res)
    expect(res.code).toBe(401)
    expect(repo.listExpired).not.toHaveBeenCalled()
  })
  it('exécute avec le bon secret', async () => {
    const repo = repoCleanup([])
    const res = makeRes()
    await createCleanupHandler({ repo, secret: 's3cret', now: () => NOW })({ method: 'GET', headers: { authorization: 'Bearer s3cret' } }, res)
    expect(res.code).toBe(200)
    expect(res.body).toEqual({ imagesSupprimees: 0, echecsNettoyes: 0 })
  })
})
```

`api/_lib/handlers/generation.test.js` :
```js
import { describe, it, expect, vi } from 'vitest'
import { createGenerationHandler } from './generation.js'
import { makeRes, okAuth, noAuth, fakeRepo } from '../../../tests/helpers.js'

const req = (id = 'g1', method = 'DELETE') => ({ method, headers: {}, query: { id } })

describe('DELETE /api/generation', () => {
  it('401, 405, 400', async () => {
    let res = makeRes()
    await createGenerationHandler({ requireUser: noAuth, repo: fakeRepo() })(req(), res)
    expect(res.code).toBe(401)
    res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })(req('g1', 'GET'), res)
    expect(res.code).toBe(405)
    res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })({ method: 'DELETE', headers: {}, query: {} }, res)
    expect(res.code).toBe(400)
  })
  it('404 si la génération n\'est pas à l\'utilisateur', async () => {
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo: fakeRepo() })(req(), res)
    expect(res.code).toBe(404)
  })
  it('supprime le fichier avant la ligne', async () => {
    const ordre = []
    const repo = fakeRepo({
      getGeneration: vi.fn(async () => ({ id: 'g1', image_path: 'u1/g1.png' })),
      removeImages: vi.fn(async () => { ordre.push('fichier') }),
      deleteGeneration: vi.fn(async () => { ordre.push('ligne') }),
    })
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo })(req(), res)
    expect(res.code).toBe(200)
    expect(ordre).toEqual(['fichier', 'ligne'])
    expect(repo.removeImages).toHaveBeenCalledWith(['u1/g1.png'])
  })
  it('supprime la ligne seule quand l\'image a déjà expiré', async () => {
    const repo = fakeRepo({ getGeneration: vi.fn(async () => ({ id: 'g1', image_path: null })) })
    const res = makeRes()
    await createGenerationHandler({ requireUser: okAuth, repo })(req(), res)
    expect(res.code).toBe(200)
    expect(repo.removeImages).not.toHaveBeenCalled()
    expect(repo.deleteGeneration).toHaveBeenCalledWith('g1', 'u1')
  })
})
```

`api/_lib/handlers/account.test.js` :
```js
import { describe, it, expect } from 'vitest'
import { createAccountHandler } from './account.js'
import { makeRes, okAuth, noAuth, fakeRepo } from '../../../tests/helpers.js'

describe('DELETE /api/account', () => {
  it('401 sans session', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createAccountHandler({ requireUser: noAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm: 'SUPPRIMER' } }, res)
    expect(res.code).toBe(401)
    expect(repo.deleteAllUserData).not.toHaveBeenCalled()
  })
  it('exige la confirmation exacte', async () => {
    for (const confirm of [undefined, 'supprimer', 'oui']) {
      const repo = fakeRepo()
      const res = makeRes()
      await createAccountHandler({ requireUser: okAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm } }, res)
      expect(res.code).toBe(400)
      expect(repo.deleteAllUserData).not.toHaveBeenCalled()
    }
  })
  it('supprime toutes les données de l\'utilisateur connecté, pas d\'un autre', async () => {
    const repo = fakeRepo()
    const res = makeRes()
    await createAccountHandler({ requireUser: okAuth, repo })({ method: 'DELETE', headers: {}, body: { confirm: 'SUPPRIMER', userId: 'autre' } }, res)
    expect(res.code).toBe(200)
    expect(repo.deleteAllUserData).toHaveBeenCalledWith('u1')
  })
  it('405 hors DELETE', async () => {
    const res = makeRes()
    await createAccountHandler({ requireUser: okAuth, repo: fakeRepo() })({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.code).toBe(405)
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

```bash
npx vitest run api/_lib/handlers/cleanup.test.js api/_lib/handlers/generation.test.js api/_lib/handlers/account.test.js
```
Expected : FAIL.

- [ ] **Step 3: Implémenter**

`api/_lib/handlers/cleanup.js` :
```js
import { verifierCron } from '../cronAuth.js'

const LOT = 100
const MAX_LOTS = 5
const PERIME_MS = 15 * 60 * 1000

export async function runCleanup({ repo, now = new Date() }) {
  const nowIso = now.toISOString()
  let imagesSupprimees = 0
  for (let i = 0; i < MAX_LOTS; i++) {
    const lot = await repo.listExpired(nowIso, LOT)
    if (!lot.length) break
    await repo.removeImages(lot.map((g) => g.image_path)) // d'abord les fichiers : si ça échoue, rien n'est marqué
    await repo.markImagesDeleted(lot.map((g) => g.id), nowIso)
    imagesSupprimees += lot.length
  }
  const perimees = await repo.failStaleAll(new Date(now.getTime() - PERIME_MS).toISOString())
  for (const p of perimees) if (p.quota_day) await repo.refundQuota(p.user_id, p.quota_day)
  return { imagesSupprimees, echecsNettoyes: perimees.length }
}

export function createCleanupHandler({ repo, secret, now = () => new Date() }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })
    if (!verifierCron(req.headers?.authorization, secret)) return res.status(401).json({ error: 'Non autorisé.' })
    return res.status(200).json(await runCleanup({ repo, now: now() }))
  }
}
```

`api/_lib/handlers/generation.js` :
```js
export function createGenerationHandler({ requireUser, repo }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    const id = String(req.query?.id ?? '')
    if (!id) return res.status(400).json({ error: 'Identifiant manquant.' })
    const gen = await repo.getGeneration(id, user.id)
    if (!gen) return res.status(404).json({ error: 'Image introuvable.' })
    if (gen.image_path) await repo.removeImages([gen.image_path]) // le fichier d'abord : sans la ligne, on ne saurait plus où il est
    await repo.deleteGeneration(gen.id, user.id)
    return res.status(200).json({ deleted: true })
  }
}
```

`api/_lib/handlers/account.js` :
```js
export function createAccountHandler({ requireUser, repo }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Méthode non autorisée.' })
    const user = await requireUser(req, res)
    if (!user) return
    if (req.body?.confirm !== 'SUPPRIMER') {
      return res.status(400).json({ error: 'Confirmation manquante : tapez SUPPRIMER.', code: 'confirm' })
    }
    await repo.deleteAllUserData(user.id)
    return res.status(200).json({ deleted: true })
  }
}
```

`api/cron/cleanup.js` :
```js
import { createCleanupHandler } from '../_lib/handlers/cleanup.js'
import { createRepo } from '../_lib/repo.js'

export default createCleanupHandler({ repo: createRepo(), secret: process.env.CRON_SECRET })
```

`api/generation.js` :
```js
import { createGenerationHandler } from './_lib/handlers/generation.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createGenerationHandler({ requireUser, repo: createRepo() })
```

`api/account.js` :
```js
import { createAccountHandler } from './_lib/handlers/account.js'
import { requireUser } from './_lib/auth.js'
import { createRepo } from './_lib/repo.js'

export default createAccountHandler({ requireUser, repo: createRepo() })
```

`repo.listExpired`, `repo.markImagesDeleted`, `repo.failStaleAll` existent déjà (Task 7).

- [ ] **Step 4: Lancer toute la suite**

```bash
npx vitest run
```
Expected : tous les tests (lib + api) PASS.

- [ ] **Step 5: Commit**

```bash
git add api
git commit -m "feat(api): nettoyage quotidien, suppression d'une image, suppression des données" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Essai réel BFL (vérifie les hypothèses non confirmées par la documentation)

**Files:**
- Create: `scripts/bfl-smoke.mjs`

Hypothèses à confirmer par ce test : l'endpoint UE accepte `seed`; le chemin `flux-2-pro` existe; le domaine de `polling_url` est bien `*.bfl.ai`; une même graine redonne la même image; le code HTTP d'un compte sans crédits (402 supposé).

- [ ] **Step 1: Écrire le script**

```js
import { createHash } from 'node:crypto'
import { createBfl, extensionFor } from '../api/_lib/providers/bfl.js'

const apiKey = process.env.BFL_API_KEY
if (!apiKey) throw new Error('BFL_API_KEY manquante (.env.local).')

const bfl = createBfl({ baseUrl: process.env.BFL_BASE_URL || undefined, model: process.env.BFL_MODEL || undefined })
const params = { apiKey, prompt: 'Un chat roux qui dort sur un rebord de fenêtre. Style : aquarelle. À éviter : pas de texte dans l\'image.', width: 1024, height: 1024, seed: 42 }

async function generer() {
  const { pollingUrl } = await bfl.submit(params)
  console.log('polling_url :', new URL(pollingUrl).hostname)
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const etat = await bfl.poll({ apiKey, pollingUrl })
    if (etat.state === 'ready') {
      const { buffer, contentType } = await bfl.download(etat.sampleUrl)
      console.log('type :', contentType, '| extension :', extensionFor(contentType), '| octets :', buffer.length)
      return createHash('sha256').update(buffer).digest('hex')
    }
    if (etat.state !== 'pending') throw new Error(`Etat final : ${etat.state}`)
  }
  throw new Error('Délai dépassé (3 minutes).')
}

const a = await generer()
const b = await generer()
console.log(a === b ? 'Graine reproductible : OUI (images identiques)' : 'Graine reproductible : NON (images différentes) -> adapter le texte d\'aide du champ graine')
```

- [ ] **Step 2: Demander l'accord de JF (dépense réelle)**

Dire à JF : « Ce test appelle BFL deux fois avec votre clé (environ 2 images, quelques centimes). Puis-je le lancer ? » Attendre un oui. Ajouter `BFL_API_KEY` dans `.env.local` (valeur saisie par JF, jamais écrite dans un message ou un fichier versionné).

- [ ] **Step 3: Lancer**

```bash
npm run smoke:bfl
```
Expected : `polling_url : <hôte>.bfl.ai`, un type de contenu, puis `Graine reproductible : OUI` ou `NON`.

Si le script échoue :
- 404/400 sur `seed` ou sur le chemin : lire https://docs.bfl.ai/api-reference, corriger `BFL_MODEL` ou `submit()` dans `api/_lib/providers/bfl.js` (et son test), relancer `npx vitest run`.
- Hôte de `polling_url` hors `bfl.ai` : élargir `verifierUrlBfl` à l'hôte réel observé uniquement s'il appartient à BFL, et mettre à jour son test.
- Graine non reproductible : adapter le texte d'aide du champ « Graine » à la Task 14 (« rapproche l'image, ne la garantit pas »).

- [ ] **Step 4: Noter le résultat et commiter**

Ajouter au `README.md` une ligne « Essai réel BFL du 2026-10-08 : <résultat> ».

```bash
git add scripts/bfl-smoke.mjs README.md
git commit -m "test: essai réel BFL (graine, domaine, type de contenu)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Coque de l'application (auth, règlement, navigation, en-têtes)

**Files:**
- Create: `src/lib/supabaseClient.js`, `src/lib/api.js`, `src/lib/data.js`, `src/lib/useCompte.js`, `src/contexts/AuthContext.jsx`, `src/pages/Login.jsx`, `src/pages/Reglement.jsx`, `src/components/BandeauRegime.jsx`, `src/App.jsx`, `vercel.json`
- Create (pages provisoires remplacées aux Tasks 14 à 17) : aucune, les pages sont créées dans leurs tasks ; en attendant, `App.jsx` n'importe que `Login` et `Reglement`.

- [ ] **Step 1: Client Supabase, appels API et lecture des données**

`src/lib/supabaseClient.js` :
```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const cleAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !cleAnon) throw new Error('Variables Supabase manquantes (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')

export const supabase = createClient(url, cleAnon)
```

`src/lib/api.js` :
```js
import { supabase } from './supabaseClient.js'
import { TERMS_VERSION } from './terms.js'

async function appeler(chemin, { method = 'GET', body } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const resp = await fetch(chemin, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const erreur = new Error(data.error || 'Erreur')
    erreur.code = data.code
    erreur.status = resp.status
    throw erreur
  }
  return data
}

export const api = {
  accepterReglement: () => appeler('/api/terms', { method: 'POST', body: { version: TERMS_VERSION } }),
  generer: (gabarit, parentId) => appeler('/api/generate', { method: 'POST', body: { gabarit, parentId } }),
  statut: (id) => appeler(`/api/status?id=${encodeURIComponent(id)}`),
  enregistrerCle: (key) => appeler('/api/key', { method: 'PUT', body: { key } }),
  supprimerCle: () => appeler('/api/key', { method: 'DELETE' }),
  supprimerGeneration: (id) => appeler(`/api/generation?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  supprimerMesDonnees: () => appeler('/api/account', { method: 'DELETE', body: { confirm: 'SUPPRIMER' } }),
}
```

`src/lib/data.js` :
```js
import { supabase } from './supabaseClient.js'

const BUCKET = 'img-generations'
const COLONNES = 'id, json, prompt_text, seed, status, image_path, image_expires_at, image_deleted_at, parent_id, created_at'

function ok({ data, error }) {
  if (error) throw error
  return data
}

export async function getAccount() {
  return ok(await supabase.from('img_accounts').select('*').maybeSingle())
}

export async function usageDuJour(jour) {
  const ligne = ok(await supabase.from('img_usage').select('count').eq('day', jour).maybeSingle())
  return ligne?.count ?? 0
}

export async function listerGenerations(limite = 60) {
  return ok(await supabase.from('img_generations').select(COLONNES).order('created_at', { ascending: false }).limit(limite))
}

export async function getGeneration(id) {
  return ok(await supabase.from('img_generations').select(COLONNES).eq('id', id).single())
}

// Liens signés (lecture de ses propres fichiers seulement, grâce à la politique de stockage).
export async function urlsSignees(chemins, secondes = 600) {
  if (!chemins.length) return {}
  const lignes = ok(await supabase.storage.from(BUCKET).createSignedUrls(chemins, secondes))
  return Object.fromEntries(lignes.filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]))
}

export async function urlTelechargement(chemin, nomFichier) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60, { download: nomFichier })
  if (error) throw error
  return data.signedUrl
}

export async function listerModeles() {
  return ok(await supabase.from('img_templates').select('*').order('created_at', { ascending: false }))
}

export async function enregistrerModele({ nom, json, verrous = [] }) {
  const { data: { user } } = await supabase.auth.getUser()
  return ok(await supabase.from('img_templates').insert({ user_id: user.id, name: nom, json, locked_fields: verrous }).select().single())
}

export async function majVerrousModele(id, verrous) {
  ok(await supabase.from('img_templates').update({ locked_fields: verrous }).eq('id', id))
}

export async function supprimerModele(id) {
  ok(await supabase.from('img_templates').delete().eq('id', id))
}
```

`src/lib/useCompte.js` :
```js
import { useCallback, useEffect, useState } from 'react'
import { getAccount, usageDuJour } from './data.js'
import { jourBruxelles } from './dates.js'

export function useCompte(user) {
  const uid = user?.id
  const [etat, setEtat] = useState({ chargement: true, compte: null, usage: 0 })

  const recharger = useCallback(async () => {
    if (!uid) {
      setEtat({ chargement: false, compte: null, usage: 0 })
      return
    }
    try {
      const [compte, usage] = await Promise.all([getAccount(), usageDuJour(jourBruxelles())])
      setEtat({ chargement: false, compte, usage })
    } catch {
      setEtat((e) => ({ ...e, chargement: false }))
    }
  }, [uid])

  useEffect(() => { recharger() }, [recharger])
  return { ...etat, recharger }
}
```

- [ ] **Step 2: Contexte d'authentification (avec `emailRedirectTo`)**

`src/contexts/AuthContext.jsx` :
```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null))
      .finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  // emailRedirectTo obligatoire : sans lui, le lien de confirmation renvoie vers une autre app PLAI.
  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return { error }
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) setPasswordRecovery(false)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, passwordRecovery, signIn, signUp, signOut, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Écran de connexion / inscription / mot de passe oublié**

`src/pages/Login.jsx` :
```jsx
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { TERMS_POINTS } from '../lib/terms.js'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')
  const [enCours, setEnCours] = useState(false)
  const { signIn, signUp, sendPasswordReset, updatePassword, passwordRecovery } = useAuth()

  async function handleSubmit(e) {
    e.preventDefault()
    setErreur('')
    setSucces('')
    setEnCours(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setErreur('E-mail ou mot de passe incorrect.')
    } else if (mode === 'reset') {
      const { error } = await sendPasswordReset(email)
      if (error) setErreur(error.message)
      else setSucces('E-mail envoyé. Vérifiez votre boîte mail pour créer un nouveau mot de passe.')
    } else {
      const { error } = await signUp(email, password)
      if (error) setErreur(error.message)
      else setSucces('Compte créé. Confirmez votre e-mail, puis connectez-vous : les règles d\'utilisation vous seront présentées à la première connexion.')
    }
    setEnCours(false)
  }

  async function handleUpdatePassword(e) {
    e.preventDefault()
    setErreur('')
    if (newPassword.length < 8) { setErreur('8 caractères minimum.'); return }
    setEnCours(true)
    const { error } = await updatePassword(newPassword)
    if (error) setErreur(error.message)
    setEnCours(false)
  }

  if (passwordRecovery) {
    return (
      <div className="plai-section">
        <div className="plai-card" style={{ maxWidth: 440, margin: '2rem auto' }}>
          <h2>Nouveau mot de passe</h2>
          <form onSubmit={handleUpdatePassword}>
            <div className="plai-field">
              <label className="plai-label" htmlFor="new-password">Nouveau mot de passe</label>
              <input id="new-password" type="password" className="plai-input" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder="8 caractères minimum" required minLength={8} />
              <p className="plai-help">Choisissez un mot de passe que vous n'utilisez pas ailleurs.</p>
            </div>
            {erreur && <p className="plai-error">{erreur}</p>}
            <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Chargement…' : 'Enregistrer'}</button>
          </form>
        </div>
      </div>
    )
  }

  const titre = mode === 'login' ? 'Se connecter' : mode === 'reset' ? 'Mot de passe oublié' : 'Créer mon compte'

  return (
    <div className="plai-section">
      <div className="plai-card" style={{ maxWidth: 440, margin: '2rem auto' }}>
        <h2>{titre}</h2>
        <p className="plai-help">
          {mode === 'login' && 'Si vous avez déjà un compte sur un autre outil PLAI, utilisez le même e-mail et le même mot de passe.'}
          {mode === 'register' && 'Utilisez votre e-mail professionnel. Un compte déjà créé sur un autre outil PLAI fonctionne ici aussi : connectez-vous.'}
          {mode === 'reset' && 'Saisissez l\'e-mail de votre compte : vous recevrez un lien pour choisir un nouveau mot de passe.'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="plai-field">
            <label className="plai-label" htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" className="plai-input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@ecole.be" autoComplete="email" required />
            <p className="plai-help">Sert uniquement à vous connecter et à vous envoyer les messages de confirmation.</p>
          </div>
          {mode !== 'reset' && (
            <div className="plai-field">
              <label className="plai-label" htmlFor="password">Mot de passe</label>
              <input id="password" type="password" className="plai-input" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} />
              <p className="plai-help">{mode === 'register' ? 'Choisissez un mot de passe que vous n\'utilisez pas ailleurs.' : 'Celui de votre compte PLAI.'}</p>
            </div>
          )}
          {erreur && <p className="plai-error">{erreur}</p>}
          {succes && <p className="plai-success">{succes}</p>}
          <button type="submit" className="plai-btn" disabled={enCours}>{enCours ? 'Chargement…' : titre}</button>
        </form>
        <p style={{ marginTop: '1rem' }}>
          {mode !== 'login' && <button type="button" className="plai-nav-link" onClick={() => setMode('login')}>J'ai déjà un compte</button>}
          {mode === 'login' && <button type="button" className="plai-nav-link" onClick={() => setMode('register')}>Créer un compte</button>}
          {' · '}
          {mode !== 'reset' && <button type="button" className="plai-nav-link" onClick={() => setMode('reset')}>Mot de passe oublié</button>}
        </p>
        {mode === 'register' && (
          <div style={{ marginTop: '1.25rem' }}>
            <h3>Règles d'utilisation (résumé)</h3>
            <ul style={{ paddingLeft: '1.25rem' }}>
              {TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Écran d'acceptation du règlement (première connexion)**

`src/pages/Reglement.jsx` :
```jsx
import { useState } from 'react'
import { api } from '../lib/api.js'
import { TERMS_POINTS } from '../lib/terms.js'

export default function Reglement({ onAccepte }) {
  const [coche, setCoche] = useState(false)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function accepter() {
    setErreur('')
    setEnCours(true)
    try {
      await api.accepterReglement()
      await onAccepte()
    } catch (e) {
      setErreur(e.message)
    }
    setEnCours(false)
  }

  return (
    <div className="plai-section">
      <div className="plai-card" style={{ maxWidth: 640, margin: '2rem auto' }}>
        <h2>Avant de commencer</h2>
        <p className="plai-help">Voici ce que fait ImagActif de vos données. Lisez ces points, puis acceptez pour continuer.</p>
        <ul style={{ paddingLeft: '1.25rem', margin: '1rem 0' }}>
          {TERMS_POINTS.map((p) => <li key={p} style={{ marginBottom: '0.5rem' }}>{p}</li>)}
        </ul>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} style={{ width: 22, height: 22, marginTop: 4 }} />
          <span>J'ai lu ces règles et je les accepte.</span>
        </label>
        {erreur && <p className="plai-error">{erreur}</p>}
        <button type="button" className="plai-btn" style={{ marginTop: '1rem' }} disabled={!coche || enCours} onClick={accepter}>
          {enCours ? 'Enregistrement…' : 'Accepter et continuer'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Bandeau de régime (essai / clé / terminé)**

`src/components/BandeauRegime.jsx` :
```jsx
import { joursRestants } from '../lib/dates.js'
import { trialEnd } from '../lib/regime.js'

const LIMITE = Number(import.meta.env.VITE_TRIAL_DAILY_LIMIT) || 10

export default function BandeauRegime({ regime, compte, usage }) {
  if (regime === 'own') {
    return <div className="plai-banner">Vous utilisez votre clé BFL personnelle : les images sont facturées par BFL sur votre compte.</div>
  }
  if (regime === 'trial') {
    const jours = joursRestants(trialEnd(compte.trial_started_at))
    const reste = Math.max(LIMITE - usage, 0)
    return (
      <div className="plai-banner">
        Essai gratuit : encore {jours} jour{jours > 1 ? 's' : ''}, {reste} image{reste > 1 ? 's' : ''} disponible{reste > 1 ? 's' : ''} aujourd'hui.
        Ensuite, ajoutez votre clé BFL dans « Mes données ».
      </div>
    )
  }
  return (
    <div className="plai-banner" style={{ borderColor: '#f97316' }}>
      L'essai de 3 jours est terminé. Ajoutez votre clé BFL dans « Mes données » pour générer de nouvelles images.
      Vos JSON et vos images encore disponibles restent consultables.
    </div>
  )
}
```

- [ ] **Step 6: Coque `App.jsx` (navigation, branding, pied de page)**

`src/App.jsx` (les pages des Tasks 14 à 17 sont importées ici ; tant qu'elles n'existent pas, créer des fichiers vides exportant `export default function X() { return null }` pour que le build passe, ils seront remplacés) :
```jsx
import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import { useCompte } from './lib/useCompte.js'
import { determineRegime } from './lib/regime.js'
import { TERMS_VERSION } from './lib/terms.js'
import { gabaritVide } from './lib/gabarit.js'
import Login from './pages/Login.jsx'
import Reglement from './pages/Reglement.jsx'
import Creer from './pages/Creer.jsx'
import Historique from './pages/Historique.jsx'
import Modeles from './pages/Modeles.jsx'
import MesDonnees from './pages/MesDonnees.jsx'

const VUES = [['creer', 'Créer'], ['historique', 'Historique'], ['modeles', 'Modèles'], ['donnees', 'Mes données']]
const brouillonVide = () => ({ gabarit: gabaritVide(), parentId: null, verrous: [] })

function Contenu() {
  const { user, loading, signOut, passwordRecovery } = useAuth()
  const { chargement, compte, usage, recharger } = useCompte(user)
  const [vue, setVue] = useState('creer')
  const [brouillon, setBrouillon] = useState(brouillonVide)

  const accepte = compte && compte.terms_version === TERMS_VERSION
  const regime = accepte ? determineRegime({ trialStartedAt: compte.trial_started_at, hasOwnKey: compte.has_own_key }) : 'none'

  function ouvrirDansCreer(b) {
    setBrouillon({ parentId: null, verrous: [], ...b })
    setVue('creer')
  }

  let page = null
  if (!loading) {
    if (!user || passwordRecovery) page = <Login />
    else if (chargement) page = null
    else if (!accepte) page = <Reglement onAccepte={recharger} />
    else if (vue === 'creer') page = <Creer brouillon={brouillon} setBrouillon={setBrouillon} compte={compte} usage={usage} regime={regime} recharger={recharger} ouvrirDansCreer={ouvrirDansCreer} />
    else if (vue === 'historique') page = <Historique ouvrirDansCreer={ouvrirDansCreer} />
    else if (vue === 'modeles') page = <Modeles ouvrirDansCreer={ouvrirDansCreer} />
    else page = <MesDonnees compte={compte} regime={regime} recharger={recharger} signOut={signOut} />
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav className="plai-nav">
        <a href="/" className="plai-nav-logo">
          <img src="/plai-logo.jpg" alt="PLAI" style={{ height: 32, width: 'auto' }} />
          ImagActif
        </a>
        {user && accepte && (
          <div className="plai-nav-actions img-tabs">
            {VUES.map(([id, label]) => (
              <button key={id} type="button" className="plai-nav-link" aria-current={vue === id ? 'page' : undefined}
                style={vue === id ? { fontWeight: 700, textDecoration: 'underline' } : undefined} onClick={() => setVue(id)}>
                {label}
              </button>
            ))}
            <button type="button" className="plai-nav-link" onClick={signOut}>Se déconnecter</button>
          </div>
        )}
      </nav>

      <div className="plai-container">{page}</div>

      <footer className="plai-footer">
        <p>ImagActif : outil PLAI, Pôle Territorial de la Ville de Liège</p>
        <p>Les images sont générées par une IA : à relire avant tout usage en classe.</p>
        <p>
          Contact : jf.beguin@outlook.com · Code :{' '}
          <a href="https://polyformproject.org/licenses/noncommercial/1.0.0" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>
          {' · '}Jean-François Beguin, jfb4plai.com
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Contenu />
    </AuthProvider>
  )
}
```

- [ ] **Step 7: `vercel.json` (région UE, cron, CSP sans Google Fonts)**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "regions": ["cdg1"],
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }],
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://dfoaumjleqtxjeaplnna.supabase.co; connect-src 'self' https://dfoaumjleqtxjeaplnna.supabase.co wss://dfoaumjleqtxjeaplnna.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'"
        },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" }
      ]
    }
  ]
}
```

- [ ] **Step 8: Pages provisoires pour que le build passe, puis build**

```bash
cd "C:/Users/jfbeg/OneDrive/claude-workspace/ImagActif"
mkdir -p src/pages src/components
for p in Creer Historique Modeles MesDonnees; do
  printf 'export default function %s() { return null }\n' "$p" > "src/pages/$p.jsx"
done
npx vite build
```
Expected : `built in …` sans erreur (le fichier `.env` est nécessaire à l'exécution mais pas au build).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(ui): coque PLAI, connexion, règlement, bandeau de régime, en-têtes de sécurité" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Page « Créer » (formulaire guidé, import/export JSON, génération)

**Files:**
- Create: `src/lib/champs.js`, `src/components/GabaritForm.jsx`, `src/components/JsonPanel.jsx`, `src/components/EnregistrerModele.jsx`
- Modify (remplace le fichier provisoire): `src/pages/Creer.jsx`

- [ ] **Step 1: Définition des champs et de leur guidage**

`src/lib/champs.js` (chaque champ : label précis, exemple concret, aide sur l'effet ; aucune affirmation pédagogique) :
```js
export const STYLES_SUGGERES = [
  'illustration plate aux contours nets',
  'aquarelle',
  'dessin au crayon de couleur',
  'dessin au trait noir et blanc',
  'pictogramme simple',
  'photographie réaliste',
]

export const CHAMPS = [
  {
    path: 'sujet.description', label: 'Sujet principal', type: 'textarea', obligatoire: true,
    placeholder: "Un chat roux qui dort sur le rebord d'une fenêtre d'école",
    aide: "Ce que l'image doit montrer, en une ou deux phrases : c'est l'élément le plus important. Ne décrivez jamais un élève réel et ne citez aucun nom : ce texte est envoyé à BFL.",
  },
  {
    path: 'sujet.details', label: 'Détails du sujet', type: 'textarea',
    placeholder: 'Pelage roux tigré, yeux fermés, une plante verte à côté',
    aide: "Objets, couleurs, nombre de personnages à faire apparaître. Plus c'est concret, moins l'IA improvise.",
  },
  {
    path: 'style.type', label: 'Style visuel', type: 'texte', suggestions: STYLES_SUGGERES,
    placeholder: 'illustration plate aux contours nets',
    aide: "Le style change tout le rendu. Pour garder des images homogènes d'une fiche à l'autre, gardez le même style : enregistrez un modèle.",
  },
  {
    path: 'style.palette', label: 'Palette de couleurs', type: 'texte',
    placeholder: 'tons chauds, orange et beige, peu de contrastes',
    aide: "Couleurs dominantes. Pour une image épurée, demandez peu de couleurs et un fond uni.",
  },
  {
    path: 'composition.cadrage', label: 'Cadrage', type: 'texte',
    placeholder: 'plan rapproché, sujet centré',
    aide: "Distance et placement du sujet dans l'image. Un sujet centré sur fond simple donne une image épurée.",
  },
  {
    path: 'composition.point_de_vue', label: 'Point de vue', type: 'texte',
    placeholder: 'vue de face, à hauteur du sujet',
    aide: "Depuis où l'on regarde la scène (de face, de dessus, de profil…).",
  },
  {
    path: 'composition.arriere_plan', label: 'Arrière-plan', type: 'texte',
    placeholder: 'fond uni beige',
    aide: "Ce qu'il y a derrière le sujet. Un fond uni évite les éléments parasites.",
  },
  {
    path: 'lumiere', label: 'Lumière', type: 'texte',
    placeholder: 'lumière douce du matin',
    aide: "Ambiance lumineuse : elle influence les ombres et les couleurs.",
  },
  {
    path: 'exclusions', label: 'À éviter', type: 'liste',
    placeholder: "pas de texte dans l'image\nvisages réalistes",
    aide: "Une chose par ligne. Les modèles d'images écrivent mal : « pas de texte dans l'image » est conseillé, ajoutez votre texte dans votre document. Ces consignes sont des demandes, pas des garanties : l'IA peut ne pas les respecter à 100 %.",
  },
  {
    path: 'format.ratio', label: "Format de l'image", type: 'ratio',
    aide: "Forme de l'image (carré, paysage, portrait…). Choisissez-la selon l'endroit où elle sera placée dans votre document.",
  },
  {
    path: 'generation.seed', label: 'Graine (facultatif)', type: 'seed',
    placeholder: 'laisser vide pour une image nouvelle',
    aide: "Un nombre qui fixe le « tirage au sort » de l'IA. Même graine et mêmes champs : image très proche. Changez un seul champ en gardant la graine pour obtenir une variante proche. Laissez vide pour une image toute nouvelle.",
  },
  {
    path: 'personnalise', label: 'Champs personnalisés', type: 'custom',
    aide: "Ajoutez vos propres critères (nom + valeur), par exemple « Saison : automne ». Ils sont ajoutés tels quels à la description envoyée à l'IA, dans l'ordre.",
  },
]
```

- [ ] **Step 2: Formulaire du gabarit**

`src/components/GabaritForm.jsx` :
```jsx
import { useState } from 'react'
import { CHAMPS } from '../lib/champs.js'
import { getIn, setIn } from '../lib/path.js'
import { RATIOS, RATIO_IDS } from '../lib/ratios.js'

function ListeLignes({ id, valeur, disabled, placeholder, onChange, aideId }) {
  const [texte, setTexte] = useState((valeur ?? []).join('\n'))
  return (
    <textarea id={id} className="plai-input" value={texte} disabled={disabled} placeholder={placeholder}
      aria-describedby={aideId} onChange={(e) => setTexte(e.target.value)}
      onBlur={() => onChange(texte.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10))} />
  )
}

function ChampsPerso({ valeur, disabled, onChange }) {
  const lignes = valeur ?? []
  const maj = (i, cle, v) => onChange(lignes.map((l, j) => (j === i ? { ...l, [cle]: v } : l)))
  return (
    <div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input className="plai-input" style={{ flex: '1 1 140px' }} aria-label={`Nom du champ ${i + 1}`} placeholder="Saison"
            value={l.nom} disabled={disabled} onChange={(e) => maj(i, 'nom', e.target.value)} />
          <input className="plai-input" style={{ flex: '2 1 200px' }} aria-label={`Valeur du champ ${i + 1}`} placeholder="automne"
            value={l.valeur} disabled={disabled} onChange={(e) => maj(i, 'valeur', e.target.value)} />
          <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled}
            onClick={() => onChange(lignes.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      {lignes.length < 10 && (
        <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled}
          onClick={() => onChange([...lignes, { nom: '', valeur: '' }])}>Ajouter un champ</button>
      )}
    </div>
  )
}

function Saisie({ c, id, valeur, disabled, onChange, aideId }) {
  switch (c.type) {
    case 'textarea':
      return <textarea id={id} className="plai-input" value={valeur ?? ''} disabled={disabled} placeholder={c.placeholder}
        aria-describedby={aideId} onChange={(e) => onChange(e.target.value)} />
    case 'texte':
      return (
        <>
          <input id={id} className="plai-input" value={valeur ?? ''} disabled={disabled} placeholder={c.placeholder}
            aria-describedby={aideId} list={c.suggestions ? `${id}-liste` : undefined} onChange={(e) => onChange(e.target.value)} />
          {c.suggestions && <datalist id={`${id}-liste`}>{c.suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
        </>
      )
    case 'liste':
      return <ListeLignes key={JSON.stringify(valeur)} id={id} valeur={valeur} disabled={disabled} placeholder={c.placeholder} aideId={aideId} onChange={onChange} />
    case 'ratio':
      return (
        <select id={id} className="plai-input" value={valeur} disabled={disabled} aria-describedby={aideId} onChange={(e) => onChange(e.target.value)}>
          {RATIO_IDS.map((r) => <option key={r} value={r}>{RATIOS[r].label}</option>)}
        </select>
      )
    case 'seed':
      return <input id={id} type="number" min="0" max="4294967295" className="plai-input" value={valeur ?? ''} disabled={disabled}
        placeholder={c.placeholder} aria-describedby={aideId}
        onChange={(e) => onChange(e.target.value === '' ? null : Number.parseInt(e.target.value, 10))} />
    case 'custom':
      return <ChampsPerso valeur={valeur} disabled={disabled} onChange={onChange} />
    default:
      return null
  }
}

export default function GabaritForm({ gabarit, onChange, verrous = [] }) {
  return (
    <div>
      {CHAMPS.map((c) => {
        const id = `champ-${c.path.replace(/\./g, '-')}`
        const verrou = verrous.includes(c.path)
        return (
          <div className="plai-field" key={c.path}>
            <label className="plai-label" htmlFor={c.type === 'custom' ? undefined : id}>
              {c.label}{c.obligatoire ? ' (obligatoire)' : ''}{verrou ? ' (verrouillé par le modèle)' : ''}
            </label>
            <Saisie c={c} id={id} aideId={`${id}-aide`} valeur={getIn(gabarit, c.path)} disabled={verrou}
              onChange={(v) => onChange(setIn(gabarit, c.path, v))} />
            <p className="plai-help" id={`${id}-aide`}>{c.aide}</p>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Panneau JSON (copier / importer)**

`src/components/JsonPanel.jsx` :
```jsx
import { useState } from 'react'
import { normaliserGabarit } from '../lib/gabarit.js'

export default function JsonPanel({ gabarit, onImporter }) {
  const [texte, setTexte] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  async function copier() {
    setErreur('')
    try {
      await navigator.clipboard.writeText(JSON.stringify(gabarit, null, 2))
      setMessage('JSON copié.')
    } catch {
      setErreur('Copie impossible : sélectionnez le texte ci-dessous.')
      setTexte(JSON.stringify(gabarit, null, 2))
    }
  }

  function importer() {
    setMessage('')
    setErreur('')
    try {
      const { gabarit: g, avertissements } = normaliserGabarit(JSON.parse(texte))
      onImporter(g)
      setMessage(avertissements.length ? avertissements.join(' ') : 'JSON chargé dans le formulaire.')
    } catch (e) {
      setErreur(e instanceof SyntaxError ? "Ce texte n'est pas du JSON valide." : e.message)
    }
  }

  return (
    <details className="plai-card" style={{ marginTop: '1rem' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>JSON : copier ou importer</summary>
      <p className="plai-help">Copiez le JSON pour le garder ou le réutiliser ailleurs. Pour reprendre un JSON, collez-le ci-dessous : il est vérifié puis rempli dans le formulaire, rien n'est exécuté.</p>
      <div className="img-actions">
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copier}>Copier le JSON de ce formulaire</button>
      </div>
      <label className="plai-label" htmlFor="json-import" style={{ marginTop: '1rem' }}>JSON à importer</label>
      <textarea id="json-import" className="plai-input" style={{ minHeight: '8rem', fontFamily: 'monospace' }} value={texte}
        onChange={(e) => setTexte(e.target.value)} placeholder='{ "sujet": { "description": "Un chat roux…" } }' />
      <div className="img-actions">
        <button type="button" className="plai-btn" disabled={!texte.trim()} onClick={importer}>Charger ce JSON</button>
      </div>
      {message && <p className="plai-success">{message}</p>}
      {erreur && <p className="plai-error">{erreur}</p>}
    </details>
  )
}
```

- [ ] **Step 4: Enregistrement d'un modèle (champ nommé, réutilisé en Historique)**

`src/components/EnregistrerModele.jsx` :
```jsx
import { useState } from 'react'
import { enregistrerModele } from '../lib/data.js'

export default function EnregistrerModele({ json, verrous = [], onFini }) {
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState(false)

  async function valider(e) {
    e.preventDefault()
    setErreur('')
    try {
      await enregistrerModele({ nom: nom.trim(), json, verrous })
      setFait(true)
      onFini?.()
    } catch (err) {
      setErreur(err.message)
    }
  }

  if (fait) return <p className="plai-success">Modèle « {nom.trim()} » enregistré.</p>
  return (
    <form onSubmit={valider} style={{ marginTop: '0.75rem' }}>
      <label className="plai-label" htmlFor="nom-modele">Nom du modèle</label>
      <input id="nom-modele" className="plai-input" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80}
        placeholder="Album de la forêt, style aquarelle" required />
      <p className="plai-help">Un modèle garde tous les champs actuels. Vous pourrez ensuite verrouiller ceux qui ne doivent pas changer (dans « Modèles »).</p>
      {erreur && <p className="plai-error">{erreur}</p>}
      <button type="submit" className="plai-btn" disabled={!nom.trim()}>Enregistrer le modèle</button>
    </form>
  )
}
```

- [ ] **Step 5: Page « Créer »**

`src/pages/Creer.jsx` (remplace le fichier provisoire) :
```jsx
import { useEffect, useRef, useState } from 'react'
import GabaritForm from '../components/GabaritForm.jsx'
import JsonPanel from '../components/JsonPanel.jsx'
import EnregistrerModele from '../components/EnregistrerModele.jsx'
import BandeauRegime from '../components/BandeauRegime.jsx'
import { api } from '../lib/api.js'
import { getGeneration, urlsSignees } from '../lib/data.js'
import { validerPourGeneration } from '../lib/gabarit.js'
import { messageErreur } from '../lib/messages.js'
import { joursRestants } from '../lib/dates.js'

const ATTENTE_MAX_MS = 120000
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const echec = (code) => Object.assign(new Error(), { code })

export default function Creer({ brouillon, setBrouillon, compte, usage, regime, recharger, ouvrirDansCreer }) {
  const [etat, setEtat] = useState('repos') // repos | cours | fini
  const [erreur, setErreur] = useState('')
  const [resultat, setResultat] = useState(null)
  const [modele, setModele] = useState(false)
  const actif = useRef(true)
  useEffect(() => () => { actif.current = false }, [])

  const majGabarit = (gabarit) => setBrouillon({ ...brouillon, gabarit })

  async function suivre(id) {
    const debut = Date.now()
    while (actif.current && Date.now() - debut < ATTENTE_MAX_MS) {
      await pause(2000)
      const s = await api.statut(id)
      if (s.status === 'done') {
        const gen = await getGeneration(id)
        const urls = await urlsSignees([gen.image_path])
        if (actif.current) setResultat({ gen, url: urls[gen.image_path] })
        return
      }
      if (s.status === 'refused') throw echec('moderated')
      if (s.status === 'failed') throw echec('failed')
    }
    if (actif.current) throw echec('timeout')
  }

  async function lancer() {
    setErreur('')
    setModele(false)
    const problemes = validerPourGeneration(brouillon.gabarit)
    if (problemes.length) { setErreur(problemes.join(' ')); return }
    setEtat('cours')
    setResultat(null)
    try {
      const { id } = await api.generer(brouillon.gabarit, brouillon.parentId)
      await suivre(id)
      if (actif.current) setEtat('fini')
    } catch (e) {
      if (actif.current) {
        setErreur(messageErreur(e.code, e.message))
        setEtat('repos')
      }
    }
    recharger()
  }

  const bloque = regime === 'none' || etat === 'cours'

  return (
    <div className="plai-section">
      <h2>Créer une image</h2>
      <BandeauRegime regime={regime} compte={compte} usage={usage} />
      {brouillon.verrous.length > 0 && (
        <p className="plai-banner">Ce brouillon vient d'un modèle : les champs verrouillés ne peuvent pas être modifiés.</p>
      )}
      <div className="img-split" style={{ marginTop: '1rem' }}>
        <div>
          <GabaritForm gabarit={brouillon.gabarit} onChange={majGabarit} verrous={brouillon.verrous} />
          <JsonPanel gabarit={brouillon.gabarit} onImporter={majGabarit} />
        </div>
        <div>
          <div className="plai-card img-warn">
            <p>
              Le texte de la description part chez BFL (serveur européen). N'y mettez aucun nom ni aucune donnée d'élève.
            </p>
          </div>
          <button type="button" className="plai-btn" style={{ marginTop: '1rem' }} disabled={bloque} onClick={lancer}>
            {etat === 'cours' ? 'Création en cours…' : 'Créer l\'image'}
          </button>
          <div role="status" aria-live="polite">
            {etat === 'cours' && <p className="plai-help">Comptez 10 à 40 secondes. Vous pouvez rester sur cette page.</p>}
          </div>
          {erreur && <p className="plai-error" role="alert">{erreur}</p>}
          {resultat && (
            <div className="plai-card img-card" style={{ marginTop: '1rem' }}>
              <img src={resultat.url} alt={`Image générée : ${resultat.gen.json.sujet.description}`} />
              <p className="plai-help">
                Image générée par IA, à relire avant usage en classe. Elle sera supprimée dans {joursRestants(resultat.gen.image_expires_at)} jours :
                téléchargez-la depuis l'Historique si vous voulez la garder. Le JSON, lui, reste.
              </p>
              <div className="img-actions">
                <button type="button" className="plai-btn plai-btn-ghost"
                  onClick={() => ouvrirDansCreer({ gabarit: resultat.gen.json, parentId: resultat.gen.id })}>
                  Faire une variante
                </button>
                <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setModele(!modele)}>Enregistrer comme modèle</button>
              </div>
              {modele && <EnregistrerModele json={resultat.gen.json} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

Note : « Faire une variante » appelle `ouvrirDansCreer`, qui remplace le brouillon par le JSON de l'image (graine incluse) et vide `verrous`. Pour obtenir une image nouvelle, l'enseignant vide le champ « Graine » (l'aide l'explique).

- [ ] **Step 6: Build et suite de tests**

```bash
npx vitest run && npx vite build
```
Expected : tests PASS ; build sans erreur.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): page Créer (formulaire guidé, import/export JSON, génération et suivi)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Historique (compte à rebours, téléchargement, variantes)

**Files:**
- Create: `src/components/CarteImage.jsx`
- Modify (remplace le fichier provisoire): `src/pages/Historique.jsx`

- [ ] **Step 1: Carte d'une génération**

`src/components/CarteImage.jsx` :
```jsx
import { useState } from 'react'
import EnregistrerModele from './EnregistrerModele.jsx'
import { joursRestants, niveauUrgence } from '../lib/dates.js'

const dateFr = (iso) => new Date(iso).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })

export default function CarteImage({ gen, url, onVariante, onTelecharger, onSupprimer }) {
  const [modele, setModele] = useState(false)
  const [message, setMessage] = useState('')
  const sujet = gen.json?.sujet?.description ?? ''

  async function copierJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(gen.json, null, 2))
      setMessage('JSON copié.')
    } catch {
      setMessage('Copie impossible depuis ce navigateur.')
    }
  }

  const aImage = gen.status === 'done' && gen.image_path
  const jours = aImage ? joursRestants(gen.image_expires_at) : 0
  const urgence = aImage ? niveauUrgence(jours) : null

  return (
    <article className="plai-card img-card">
      {aImage && url && <img src={url} alt={`Image générée : ${sujet}`} />}
      {gen.status === 'done' && !gen.image_path && (
        <p className="plai-banner">Image supprimée le {dateFr(gen.image_deleted_at ?? gen.image_expires_at)}. Le JSON est conservé : vous pouvez la régénérer.</p>
      )}
      {gen.status === 'pending' && <p className="plai-banner">Création en cours…</p>}
      {(gen.status === 'failed' || gen.status === 'refused') && (
        <p className="plai-banner">{gen.status === 'refused' ? 'Refusée par BFL.' : 'Échec de la génération.'}</p>
      )}
      <h3 style={{ marginTop: '0.75rem' }}>{sujet || 'Sans titre'}</h3>
      <p className="plai-help">Créée le {dateFr(gen.created_at)} · graine {gen.seed}</p>
      {aImage && (
        <p className={urgence === 'bientot' ? 'img-urgent' : 'plai-help'} role={urgence === 'bientot' ? 'alert' : undefined}>
          {urgence === 'expire'
            ? "Cette image sera supprimée aujourd'hui."
            : `Image supprimée dans ${jours} jour${jours > 1 ? 's' : ''}.`}
          {urgence !== 'ok' && ' Téléchargez-la si vous voulez la garder.'}
        </p>
      )}
      <div className="img-actions">
        {aImage && <button type="button" className="plai-btn" onClick={onTelecharger}>Télécharger</button>}
        {gen.status === 'done' && (
          <button type="button" className="plai-btn plai-btn-ghost" onClick={onVariante}>
            {aImage ? 'Faire une variante' : 'Régénérer'}
          </button>
        )}
        <button type="button" className="plai-btn plai-btn-ghost" onClick={copierJson}>Copier le JSON</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setModele(!modele)}>Enregistrer comme modèle</button>
        <button type="button" className="plai-btn plai-btn-ghost" onClick={onSupprimer}>Supprimer</button>
      </div>
      {message && <p className="plai-help" role="status">{message}</p>}
      {modele && <EnregistrerModele json={gen.json} />}
    </article>
  )
}
```

- [ ] **Step 2: Page « Historique »**

`src/pages/Historique.jsx` :
```jsx
import { useCallback, useEffect, useState } from 'react'
import CarteImage from '../components/CarteImage.jsx'
import { api } from '../lib/api.js'
import { listerGenerations, urlsSignees, urlTelechargement } from '../lib/data.js'

export default function Historique({ ouvrirDansCreer }) {
  const [generations, setGenerations] = useState(null)
  const [urls, setUrls] = useState({})
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    try {
      const liste = await listerGenerations()
      setGenerations(liste)
      setUrls(await urlsSignees(liste.filter((g) => g.image_path).map((g) => g.image_path)))
    } catch (e) {
      setErreur(e.message)
    }
  }, [])
  useEffect(() => { charger() }, [charger])

  async function telecharger(gen) {
    try {
      const ext = gen.image_path.split('.').pop()
      const lien = await urlTelechargement(gen.image_path, `imagactif-${gen.id.slice(0, 8)}.${ext}`)
      window.location.assign(lien)
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function supprimer(gen) {
    if (!window.confirm('Supprimer cette image et son JSON ? Cette action est définitive.')) return
    try {
      await api.supprimerGeneration(gen.id)
      await charger()
    } catch (e) {
      setErreur(e.message)
    }
  }

  return (
    <div className="plai-section">
      <h2>Historique</h2>
      <p className="plai-help">Vos images sont supprimées 30 jours après leur création ; leur JSON reste ici jusqu'à ce que vous le supprimiez.</p>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {generations === null && !erreur && <p className="plai-help">Chargement…</p>}
      {generations?.length === 0 && <p className="plai-empty">Aucune image pour l'instant. Créez-en une dans l'onglet « Créer ».</p>}
      <div className="img-grid">
        {generations?.map((g) => (
          <CarteImage key={g.id} gen={g} url={urls[g.image_path]}
            onVariante={() => ouvrirDansCreer({ gabarit: g.json, parentId: g.id })}
            onTelecharger={() => telecharger(g)}
            onSupprimer={() => supprimer(g)} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build**

```bash
npx vite build
```
Expected : build sans erreur.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): historique avec compte à rebours, téléchargement, variantes et régénération" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Modèles (champs verrouillés)

**Files:**
- Modify (remplace le fichier provisoire): `src/pages/Modeles.jsx`

- [ ] **Step 1: Écrire la page**

`src/pages/Modeles.jsx` :
```jsx
import { useCallback, useEffect, useState } from 'react'
import { CHAMPS } from '../lib/champs.js'
import { listerModeles, majVerrousModele, supprimerModele } from '../lib/data.js'

function Verrous({ modele, onSauve }) {
  const [verrous, setVerrous] = useState(modele.locked_fields)
  const [message, setMessage] = useState('')
  const bascule = (path) => setVerrous((v) => (v.includes(path) ? v.filter((p) => p !== path) : [...v, path]))

  async function sauver() {
    await majVerrousModele(modele.id, verrous)
    setMessage('Verrous enregistrés.')
    onSauve()
  }

  return (
    <fieldset style={{ border: 'none', padding: 0, marginTop: '0.75rem' }}>
      <legend className="plai-label">Champs à verrouiller</legend>
      <p className="plai-help">Un champ verrouillé ne peut plus être modifié quand vous utilisez ce modèle : il reste identique d'une image à l'autre.</p>
      {CHAMPS.map((c) => (
        <label key={c.path} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
          <input type="checkbox" style={{ width: 20, height: 20 }} checked={verrous.includes(c.path)} onChange={() => bascule(c.path)} />
          <span>{c.label}</span>
        </label>
      ))}
      <button type="button" className="plai-btn plai-btn-ghost" style={{ marginTop: '0.5rem' }} onClick={sauver}>Enregistrer les verrous</button>
      {message && <p className="plai-success" role="status">{message}</p>}
    </fieldset>
  )
}

export default function Modeles({ ouvrirDansCreer }) {
  const [modeles, setModeles] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    try { setModeles(await listerModeles()) } catch (e) { setErreur(e.message) }
  }, [])
  useEffect(() => { charger() }, [charger])

  async function supprimer(m) {
    if (!window.confirm(`Supprimer le modèle « ${m.name} » ?`)) return
    try { await supprimerModele(m.id); await charger() } catch (e) { setErreur(e.message) }
  }

  return (
    <div className="plai-section">
      <h2>Modèles</h2>
      <p className="plai-help">Un modèle est un JSON que vous réutilisez en ne changeant que certains champs. Créez-le depuis « Créer » ou « Historique » (bouton « Enregistrer comme modèle »).</p>
      {erreur && <p className="plai-error" role="alert">{erreur}</p>}
      {modeles?.length === 0 && <p className="plai-empty">Aucun modèle pour l'instant.</p>}
      <div className="img-grid">
        {modeles?.map((m) => (
          <article key={m.id} className="plai-card">
            <h3>{m.name}</h3>
            <p className="plai-help">{m.json?.sujet?.description || 'Sans sujet'}</p>
            <p className="plai-help">{m.locked_fields.length} champ{m.locked_fields.length > 1 ? 's' : ''} verrouillé{m.locked_fields.length > 1 ? 's' : ''}</p>
            <div className="img-actions">
              <button type="button" className="plai-btn" onClick={() => ouvrirDansCreer({ gabarit: m.json, verrous: m.locked_fields })}>Utiliser</button>
              <button type="button" className="plai-btn plai-btn-ghost" onClick={() => setOuvert(ouvert === m.id ? null : m.id)}>Verrous</button>
              <button type="button" className="plai-btn plai-btn-ghost" onClick={() => supprimer(m)}>Supprimer</button>
            </div>
            {ouvert === m.id && <Verrous modele={m} onSauve={charger} />}
          </article>
        ))}
      </div>
    </div>
  )
}
```

La graine d'un modèle : en l'utilisant, `gabarit.generation.seed` est celle enregistrée. Pour une image nouvelle, l'enseignant vide le champ « Graine » (sauf s'il est verrouillé : le verrouiller revient à demander des images proches).

- [ ] **Step 2: Build**

```bash
npx vite build
```
Expected : build sans erreur.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): modèles avec champs verrouillés" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 17: « Mes données » (règles, clé BFL, export, suppression)

**Files:**
- Modify (remplace le fichier provisoire): `src/pages/MesDonnees.jsx`

- [ ] **Step 1: Écrire la page**

`src/pages/MesDonnees.jsx` :
```jsx
import { useState } from 'react'
import JSZip from 'jszip'
import { api } from '../lib/api.js'
import { listerGenerations, listerModeles, urlsSignees } from '../lib/data.js'
import { TERMS_POINTS } from '../lib/terms.js'
import { messageErreur } from '../lib/messages.js'

function telecharger(blob, nom) {
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(blob)
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

export default function MesDonnees({ compte, regime, recharger, signOut }) {
  const [cle, setCle] = useState('')
  const [messageCle, setMessageCle] = useState('')
  const [erreurCle, setErreurCle] = useState('')
  const [exportEnCours, setExportEnCours] = useState(false)
  const [erreurExport, setErreurExport] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurSuppr, setErreurSuppr] = useState('')

  async function enregistrerCle(e) {
    e.preventDefault()
    setMessageCle('')
    setErreurCle('')
    try {
      await api.enregistrerCle(cle)
      setCle('')
      setMessageCle('Clé enregistrée (chiffrée). Elle sera utilisée pour vos prochaines images.')
      await recharger()
    } catch (err) {
      setErreurCle(messageErreur(err.code, err.message))
    }
  }

  async function retirerCle() {
    setMessageCle('')
    setErreurCle('')
    try {
      await api.supprimerCle()
      setMessageCle('Clé supprimée de nos serveurs.')
      await recharger()
    } catch (err) {
      setErreurCle(err.message)
    }
  }

  async function exporter() {
    setErreurExport('')
    setExportEnCours(true)
    try {
      const zip = new JSZip()
      const generations = await listerGenerations(1000)
      zip.file('generations.json', JSON.stringify(generations.map((g) => ({
        id: g.id, json: g.json, prompt_text: g.prompt_text, seed: g.seed, status: g.status,
        created_at: g.created_at, image_expires_at: g.image_expires_at, image_deleted_at: g.image_deleted_at,
      })), null, 2))
      zip.file('modeles.json', JSON.stringify(await listerModeles(), null, 2))
      const avecImage = generations.filter((g) => g.image_path)
      const urls = await urlsSignees(avecImage.map((g) => g.image_path), 300)
      for (const g of avecImage) {
        const resp = await fetch(urls[g.image_path])
        if (resp.ok) zip.file(`images/${g.id}.${g.image_path.split('.').pop()}`, await resp.blob())
      }
      telecharger(await zip.generateAsync({ type: 'blob' }), 'imagactif-export.zip')
    } catch (err) {
      setErreurExport(err.message)
    }
    setExportEnCours(false)
  }

  async function supprimerTout(e) {
    e.preventDefault()
    setErreurSuppr('')
    try {
      await api.supprimerMesDonnees()
      await signOut()
    } catch (err) {
      setErreurSuppr(err.message)
    }
  }

  return (
    <div className="plai-section">
      <h2>Mes données</h2>

      <section className="plai-card" aria-labelledby="t-regles">
        <h3 id="t-regles">Règles d'utilisation</h3>
        <ul style={{ paddingLeft: '1.25rem' }}>
          {TERMS_POINTS.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <p className="plai-help">Règles acceptées le {new Date(compte.terms_accepted_at).toLocaleDateString('fr-BE')}.</p>
      </section>

      <section className="plai-card" aria-labelledby="t-cle" style={{ marginTop: '1rem' }}>
        <h3 id="t-cle">Ma clé BFL</h3>
        <p>
          {compte.has_own_key ? 'Une clé personnelle est enregistrée (chiffrée sur nos serveurs).' : regime === 'trial' ? "Vous êtes en essai : aucune clé n'est nécessaire pour l'instant." : "Aucune clé enregistrée : ajoutez-la pour continuer à générer."}
        </p>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Comment obtenir une clé BFL ?</summary>
          <ol style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
            <li>Créez un compte sur le site de Black Forest Labs et ajoutez des crédits (l'image coûte quelques centimes).</li>
            <li>Dans votre espace BFL, créez une clé d'API et copiez-la.</li>
            <li>Collez-la ci-dessous. Elle est chiffrée et ne revient jamais dans votre navigateur.</li>
          </ol>
          <p className="plai-help">Aide officielle : <a href="https://help.bfl.ai/articles/8446125349-quickstart-guide" target="_blank" rel="noopener noreferrer">help.bfl.ai, démarrage</a>.</p>
        </details>
        <form onSubmit={enregistrerCle} style={{ marginTop: '1rem' }}>
          <label className="plai-label" htmlFor="cle-bfl">Clé d'API BFL</label>
          <input id="cle-bfl" type="password" className="plai-input" value={cle} onChange={(e) => setCle(e.target.value)}
            placeholder="Collez ici la clé copiée depuis votre espace BFL" autoComplete="off" />
          <p className="plai-help">Utilisée uniquement pour vos images, et seulement par notre serveur. Vous pouvez la supprimer à tout moment.</p>
          <div className="img-actions">
            <button type="submit" className="plai-btn" disabled={!cle.trim()}>Enregistrer la clé</button>
            {compte.has_own_key && <button type="button" className="plai-btn plai-btn-ghost" onClick={retirerCle}>Supprimer ma clé</button>}
          </div>
        </form>
        {messageCle && <p className="plai-success" role="status">{messageCle}</p>}
        {erreurCle && <p className="plai-error" role="alert">{erreurCle}</p>}
      </section>

      <section className="plai-card" aria-labelledby="t-export" style={{ marginTop: '1rem' }}>
        <h3 id="t-export">Exporter mes données</h3>
        <p className="plai-help">Un fichier ZIP avec tous vos JSON, vos modèles et les images encore disponibles.</p>
        <button type="button" className="plai-btn" disabled={exportEnCours} onClick={exporter}>{exportEnCours ? 'Préparation…' : 'Télécharger mon export'}</button>
        {erreurExport && <p className="plai-error" role="alert">{erreurExport}</p>}
      </section>

      <section className="plai-card" aria-labelledby="t-suppr" style={{ marginTop: '1rem' }}>
        <h3 id="t-suppr">Supprimer mes données ImagActif</h3>
        <p>Supprime définitivement vos images, JSON, modèles et votre clé BFL. Cette action est irréversible.</p>
        <p className="plai-help">Seule la date de début de votre essai gratuit est conservée, pour qu'il ne puisse pas être renouvelé. Votre identifiant de connexion (e-mail) est commun à plusieurs outils PLAI : il n'est pas supprimé ici. Pour le faire supprimer, écrivez à jf.beguin@outlook.com.</p>
        <form onSubmit={supprimerTout}>
          <label className="plai-label" htmlFor="confirm-suppr">Tapez SUPPRIMER pour confirmer</label>
          <input id="confirm-suppr" className="plai-input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="SUPPRIMER" autoComplete="off" />
          <button type="submit" className="plai-btn" style={{ marginTop: '0.5rem' }} disabled={confirmation !== 'SUPPRIMER'}>Supprimer définitivement mes données</button>
        </form>
        {erreurSuppr && <p className="plai-error" role="alert">{erreurSuppr}</p>}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Build et tests**

```bash
npx vitest run && npx vite build
```
Expected : PASS, build sans erreur.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ui): Mes données (règles, clé BFL, export ZIP, suppression)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Vérification locale complète, déploiement et finition PLAI

**Files:**
- Create: `modes-emploi` (HTML autonome, voir Step 8), vignette dans `projets/portail-plai/src/data/apps.ts`

- [ ] **Step 1: Variables d'environnement locales**

Dans `.env.local` (non versionné), renseigner : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `BFL_API_KEY`, `BFL_BASE_URL`, `BFL_MODEL`, `IMG_TRIAL_DAILY_LIMIT`, `IMG_GLOBAL_DAILY_LIMIT`, `VITE_TRIAL_DAILY_LIMIT`, `CRON_SECRET`. Générer les secrets avec `npm run secret` et copier `IMG_KEY_SECRETS` / `IMG_KEY_CURRENT`.

- [ ] **Step 2: Lancer l'app avec les fonctions (jamais `vite dev` seul)**

```bash
vercel dev
```
Expected : serveur local sur un port affiché (par défaut 3000).

- [ ] **Step 3: Parcours complet en navigateur (compte de test)**

Avec le navigateur intégré, sur l'URL locale, vérifier dans l'ordre et noter chaque résultat :
1. Inscription d'un compte de test → message de confirmation ; confirmer l'e-mail (lien reçu) ; connexion.
2. Écran « Avant de commencer » : bouton grisé tant que la case n'est pas cochée ; acceptation → arrivée sur « Créer ».
3. Bandeau d'essai affiché (3 jours, 10 images).
4. « Créer l'image » sans sujet → message « Décrivez le sujet de l'image. » ; avec sujet → image affichée sous 10 à 40 s, mention « Image générée par IA », compte à rebours « 30 jours ».
5. Historique : carte avec vignette, « Image supprimée dans 30 jours », Télécharger (fichier reçu), Copier le JSON.
6. Variante : le formulaire est prérempli avec la graine ; changer un champ → nouvelle image proche.
7. Enregistrer comme modèle → apparaît dans Modèles ; verrouiller « Style visuel » ; Utiliser → champ grisé « (verrouillé par le modèle) ».
8. Mes données : enregistrer une fausse clé (16+ caractères) → « Clé enregistrée » ; générer → message « clé refusée » (le régime « own » prend le dessus) ; supprimer la clé.
9. Réinitialisation du mot de passe : e-mail reçu, lien ramène sur ImagActif (pas sur une autre app).
10. Export ZIP : contient `generations.json`, `modeles.json`, `images/`.
11. Suppression des données : taper SUPPRIMER → déconnexion ; reconnexion → écran « Avant de commencer » de nouveau (compte vidé).

Vérifier visuellement : nav PLAI, logo non déformé (hauteur 32, largeur auto), pied de page, texte ≥ 16 px, aucun appel vers `fonts.googleapis.com` (`read_network_requests`).

- [ ] **Step 4: Simuler l'expiration à 30 jours (en base, avec l'accord de JF)**

Dire à JF : « Je vais avancer de 31 jours la date d'expiration d'UNE image de test (compte de test), puis lancer le nettoyage. » Après accord, dans le SQL Editor : `update img_generations set image_expires_at = now() - interval '1 day' where id = '<id de l'image de test>';` puis :
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/cleanup
```
Expected : `{"imagesSupprimees":1,"echecsNettoyes":0}`. Dans l'Historique : « Image supprimée le … » avec bouton « Régénérer » ; le fichier n'existe plus dans le bucket (Dashboard Supabase, Storage).

- [ ] **Step 5: Build de production et suite de tests**

```bash
npx vitest run && npx vite build
```
Expected : tout PASS, build sans erreur. Aucun `console.log` de données utilisateur ni de clé : `grep -rn "console.log" src api` ne doit rien renvoyer d'utilisateur.

- [ ] **Step 6: Variables Vercel et déploiement**

```bash
vercel link --yes --project imagactif
```
Poser chaque variable serveur avec `printf` (jamais `echo`) puis vérifier :
```bash
printf '%s' "<valeur>" | vercel env add NOM_VARIABLE production
vercel env pull .env.check --environment=production
```
Comparer les noms présents avec `.env.example` (sans afficher les valeurs), puis supprimer `.env.check`. Ne jamais mettre `BFL_API_KEY`, `IMG_KEY_SECRETS`, `SUPABASE_SERVICE_ROLE_KEY` ni `CRON_SECRET` dans une variable `VITE_*`.

Pousser (après `npx vite build` réussi) :
```bash
git push -u origin main
```
Puis vérifier qu'il n'existe qu'un seul projet Vercel `imagactif` (l'intégration GitHub peut en créer un doublon) :
```bash
vercel project ls
```
Si un doublon apparaît, garder celui qui est lié au dépôt et lancer `vercel remove <doublon> --yes`.

- [ ] **Step 7: Domaine et redirections d'authentification (JF)**

Demander à JF : (a) ajouter le domaine `imagactif.jfb4plai.com` au projet Vercel et suivre l'instruction DNS habituelle ; (b) ajouter `https://imagactif.jfb4plai.com` aux « Redirect URLs » de Supabase Auth (Authentication, URL Configuration) : sans cela, les e-mails de confirmation et de réinitialisation renvoient vers une autre app.

- [ ] **Step 8: Mode d'emploi HTML PLAI (autonome)**

Créer `public/modes-emploi/imagactif.html` : page autonome (CSS de `shared/css/plai-style.css` incorporé, polices système en repli, aucune ressource externe) avec : à quoi sert l'outil, créer une image pas à pas, faire une variante, créer un modèle et verrouiller des champs, durées de conservation (image 30 jours, JSON conservé), obtenir et ajouter sa clé BFL, ce que l'outil ne fait pas bien (texte dans les images, respect imparfait des « À éviter », graine non garantie), exporter et supprimer ses données. Ajouter dans `vercel.json` un en-tête `X-Robots-Tag: noindex` pour `/modes-emploi/(.*)` comme les autres apps.

- [ ] **Step 9: Vignette du portail**

Dans `C:\Users\jfbeg\OneDrive\claude-workspace\projets\portail-plai\src\data\apps.ts`, ajouter l'entrée ImagActif en suivant le format des entrées existantes (nom, description courte sans affirmation scientifique, URL `https://imagactif.jfb4plai.com`). Repo et déploiement du portail sont séparés : build local du portail (`npx vite build`) avant push, puis push `main`.

- [ ] **Step 10: Revue finale globale**

Dispatcher une revue de code globale (superpowers:requesting-code-review) sur l'ensemble de la branche, pas seulement tâche par tâche, avec ces points : RLS et droits, aucune clé côté front, aucun log de prompt/clé, suppression des fichiers avant les lignes, cohérence des types entre `src/lib`, handlers et UI. Corriger puis relancer `npx vitest run && npx vite build`.

- [ ] **Step 11: Checklist post-build et audit**

Cocher avec JF : (a) RLS actif partout (test d'intégration vert) ; (b) aucune clé exposée (`grep -rn "BFL_API_KEY\|SERVICE_ROLE" dist` ne renvoie rien) ; (c) DPA BFL demandé et durée de conservation chez BFL documentée ; (d) traitement inscrit au registre ; (e) sauvegarde Supabase planifiée : exclure le bucket d'images ou limiter sa rétention à 30 jours ; (f) bloc « Qu'est-ce que cet outil ne fait pas bien » présent dans le mode d'emploi ; (g) audit sécurité / fiabilité / UX.

- [ ] **Step 12: Commit final**

```bash
git add -A
git commit -m "docs: mode d'emploi, vignette portail et checklist de mise en ligne" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

---

## Auto-revue du plan contre le spec

| Exigence du spec | Task |
|---|---|
| Endpoint UE BFL, fournisseur isolé dans un fichier | 6 |
| Essai 3 jours, clé de JF, quota 10/jour et disjoncteur 100/jour (variables d'environnement) | 4, 9, 1 (fonction SQL) |
| Clé personnelle chiffrée AES-256-GCM côté serveur, jamais renvoyée | 5, 8 |
| JSON source de vérité, `composePrompt`, gabarit v1, champs personnalisés, import/export, validation | 2, 3, 14 |
| Modèle = JSON + champs verrouillés | 1, 16 |
| Variante / régénération avec la même graine | 9, 14, 15 |
| Image supprimée à 30 jours, JSON conservé, cron quotidien, fichiers via l'API de stockage | 1, 10, 11 |
| Information garantie (inscription, première connexion, compte à rebours, orange à J-5, téléchargement, mention après suppression, rappel dans Mes données) | 4, 13, 15, 17 |
| Une seule génération en cours, remboursement des échecs et refus | 1, 9, 10, 11 |
| E-mail vérifié obligatoire pour générer | 9 |
| RLS, GRANT explicites, `img_user_keys` et `img_jobs` sans accès client | 1 |
| Polices hébergées, aucun traceur, CSP stricte | 0, 13 |
| Région UE des fonctions | 13 |
| Exclusion par défaut « pas de texte », avertissement données élèves | 2, 14 |
| Export complet et suppression des données | 17 |
| Tests : unitaires, RLS en base, bout en bout avec BFL simulé (handlers), un essai réel | 2 à 12, 1, 18 |
| Branding PLAI, texte 16 px, logo non déformé | 0, 13, 18 |
| Mode d'emploi HTML, vignette portail, revue finale, checklist post-build | 18 |

Hypothèses à confirmer pendant l'exécution (signalées dans les tasks concernées) : paramètre `seed` et chemin `flux-2-pro` sur l'endpoint UE, code HTTP 402 pour les crédits épuisés, domaine exact de `polling_url` (Task 12) ; paramètres `redirectTo` des e-mails Supabase (Task 18, étape 7).
