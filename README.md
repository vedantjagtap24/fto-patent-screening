# FTOlyzer

**Freedom to Operate patent screening with GPT-4.1.** Upload a spreadsheet of patent claims, describe your product's features, and FTOlyzer checks every claim against every feature and ranks the claims by how much they overlap, so patent counsel knows which patents to review first.

**Live demo:** https://ftolyzer.up.railway.app. The sign-in details are filled in; just click **Sign in**. The demo shows a completed screening of 3,056 surgical-robotics patent claims against 4 product features. New runs are turned off there because each one uses paid OpenAI credits.

> FTOlyzer produces a preliminary screening, not a legal opinion. Final infringement conclusions should be reviewed by a qualified patent attorney.

---

## What it does

1. **Upload patent claims.** An Excel file with `S.No.`, `Publication Number` and `Claims` columns.
2. **Describe your product.** A short list of features, for example *"Tremor reduction technology that filters small involuntary movements"*.
3. **Run the analysis.** Each claim is sent to GPT-4.1 with the full feature list. For every feature the model returns whether it is present, a confidence level (High, Medium or Low), a short reasoning, and the claim numbers where it appears.
4. **Review ranked results.** Claims are ranked by how many features they contain:

   | Rank | Meaning |
   |---|---|
   | Rank 1 | contains all features |
   | Rank 2 | contains at least 75% of the features |
   | Rank 3 | contains at least 50% of the features |
   | Rank 4 | contains at least one feature |
   | No rank | contains none of the features |

   The cut-offs scale with the number of features, so with 6 features Rank 2 means 5 or more.

### Features

- **Home page** with the headline numbers and charts for the latest run: risk distribution, feature coverage, a heatmap of features found together, and the patents to review first.
- **Results table** with rank, feature and search filters that combine, a per-patent view of the model's reasoning, and links to Google Patents.
- **Excel export** of exactly the filtered rows, with every feature's verdict, confidence, reasoning and relevant claims.
- **Large runs:** 3,056 claims finish in roughly 15 minutes on an OpenAI Tier 2 account.
- **Resumable runs:** if a run is interrupted, cancelled or hits errors, **Resume** continues with only the unfinished or failed claims.
- **Demo mode** that shows a finished run and blocks anything that would spend OpenAI credits.

## How it works

```
React app (frontend/)  ──HTTP──▶  Express server (backend/server.js)  ──▶  OpenAI GPT-4.1
        │                                   │
        └──── Supabase Auth (sign-in) ──────┴──▶  Supabase Postgres (projects, claims, results)
```

- **Frontend:** React 18 (Create React App). It signs users in with Supabase Auth and calls the Express API with the user's access token.
- **Backend:** Express on Node 18. It verifies the token with Supabase, stores data with the Supabase service-role key, calls OpenAI, and serves the built React app from `backend/public`.
- **Analysis pipeline:** `POST /analyze` answers immediately and the work continues in the background.
  - A pool of workers (25 by default) keeps requests in flight, so one slow claim doesn't hold up the others.
  - OpenAI rate-limit responses are waited out and retried instead of counting as failures.
  - Each request times out after 90 seconds and is retried.
  - Each claim's result is saved as soon as it's ready, which is what makes runs resumable.
  - The app polls `/status` every 5 seconds for real progress, failure counts and the latest error.
- **Hosting:** Railway runs `npm start` from the repository root.

## Repository layout

```
.
├── backend/
│   ├── server.js          Express API, analysis pipeline, serves the built app
│   └── public/            Built React app that Railway serves (generated, see below)
├── frontend/
│   ├── public/            index.html, icons, manifest
│   └── src/
│       ├── components/
│       │   ├── Login/                 Sign-in page and its animated scene
│       │   └── App/
│       │       ├── MainLayout.js      Sidebar, header, data loading, run control
│       │       ├── Home/              Home page hero
│       │       ├── Dashboard/         Charts and their statistics
│       │       └── Screening/         Upload, features, run, results table, export
│       ├── hooks/                     Shared React hooks
│       └── lib/supabase.js            Supabase client and auth helpers
├── docs/
│   ├── dataset-surgical-robotics-3056-claims.xlsx   Full demo dataset
│   ├── sample-20-claims.xlsx                        Small sample for quick tests
│   ├── product-features.docx                        Features used in the demo
│   └── fto-search-process.docx                      Background on the FTO process
└── package.json           Server dependencies and scripts
```

## Running it locally

**You need:** Node 18, a Supabase project, and an OpenAI API key with access to `gpt-4.1`.

**1. Database.** Create these tables in Supabase (at least these columns):

| Table | Columns |
|---|---|
| `projects` | `id` (uuid), `user_id` (uuid), `name`, `description`, `status` (`draft`, `processing`, `completed`, `error`), `created_at`, `updated_at` |
| `features` | `id`, `project_id`, `name`, `order_index` |
| `patent_claims` | `id` (uuid), `project_id`, `claim_number`, `publication_number`, `claims_text`, `raw_data` (jsonb) |
| `analysis_summary` | `id`, `project_id`, `claim_id`, `rank`, `feature_count`, `total_features`, `detailed_analysis` (jsonb), `created_at` |

Then create a user under **Authentication → Users** to sign in with.

**2. Server settings.** Create `backend/.env`:

```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ANALYSIS_LOCKED=false        # leave unset (or true) for demo mode
ANALYSIS_CONCURRENCY=25      # optional; lower it on low OpenAI tiers
```

**3. Frontend settings.** The Supabase URL and public anon key are in `frontend/src/lib/supabase.js`; point them at your project. To pre-fill a demo login, create `frontend/.env.local`:

```bash
REACT_APP_DEMO_EMAIL=demo@example.com
REACT_APP_DEMO_PASSWORD=...
```

These values are baked into the built JavaScript, so only use a throwaway demo account.

**4. Install and run.**

```bash
npm install
npm --prefix frontend install
npm run build:web     # builds frontend/ into backend/public
npm start             # http://localhost:3001
```

While working on the UI, run `npm --prefix frontend start` alongside `npm start`. The React dev server on port 3000 forwards API calls to the server on port 3001.

## Deploying

Railway runs `npm start` and serves whatever is in `backend/public`, so rebuild before you push UI changes:

```bash
npm run build:web
git add backend/public && git commit -m "Rebuild web app" && git push
```

Set `OPENAI_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` under the service's **Variables** in Railway. Demo mode is on unless `ANALYSIS_LOCKED` is set to `false`.

## API

All `/api/projects` routes need an `Authorization: Bearer <Supabase access token>` header.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Server status and whether demo mode is on |
| GET | `/api/public/summary` | Patent count, feature names and high-priority count for the sign-in page (no sign-in needed) |
| GET, POST | `/api/projects` | List or create projects |
| GET, POST | `/api/projects/:id/features` | Read or replace a project's features |
| GET, POST | `/api/projects/:id/claims` | Read claims (`?full=1` includes their text) or upload them in chunks |
| POST | `/api/projects/:id/analyze` | Start a run in the background (`{ "resume": true }` continues one) |
| GET | `/api/projects/:id/status` | Progress, failures and the latest error |
| POST | `/api/projects/:id/cancel` | Stop a run after the claims in progress |
| GET | `/api/projects/:id/results` | All results with their rank and per-feature analysis |

In demo mode every POST route returns `403`.

## Author

Built by **Vedant Jagtap** · vsj7589@nyu.edu
