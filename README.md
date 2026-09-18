# CredibleX Growth Intelligence Engine

**AI-powered SME financing & partner opportunity intelligence — an independent prototype.**

This project shows how an embedded-finance lender like [CredibleX](https://crediblex.com) could use data and AI to identify SME financing opportunities, match SMEs to the right financing product, and prioritise potential ecosystem partners — all wrapped in an interactive dashboard that explains its own results in plain business language.

**[→ View the live dashboard](https://growthintelligencedashboard.netlify.app/)** *(replace with your GitHub Pages link once deployed — see below)*

> Independent portfolio project. Not affiliated with, commissioned by, or endorsed by CredibleX. All data is synthetically generated for demonstration purposes only.

---

## What this is

CredibleX distributes financing through embedded partnerships rather than direct SME acquisition (see [`docs/CredibleX_Research.md`](docs/CredibleX_Research.md)). That creates two linked intelligence problems this project tackles together:

1. **Which SMEs represent the strongest financing opportunity, and with which product?**
2. **Which potential partners offer the best distribution reach into that opportunity?**

The project builds a small, transparent analytical core (Python + SQL) for both questions, wraps it in an AI layer that *explains* results rather than inventing them, and surfaces everything through a standalone HTML dashboard.

## Project story, in one sentence

> I studied CredibleX's embedded-finance model and built an AI-assisted intelligence prototype that connects SME financing opportunities, product suitability, and partner prioritisation into one decision-support system.

## The dashboard

Four pages, no backend required:

| Page | What it shows |
|---|---|
| **Executive Overview** | Portfolio KPIs and charts — opportunity by industry, product distribution, segment breakdown |
| **SME Intelligence** | Filterable, sortable table of all 1,000 SMEs. Click any row for its AI Financing Brief |
| **Partner Intelligence** | SME Reach vs. Financing Relevance scatter plot + filterable partner cards. Click any partner for its AI Partner Brief |
| **AI Insights** | Four AI-generated executive insights synthesising the full portfolio |

## How the scores work

| Module | What it does | Where |
|---|---|---|
| **A. SME Opportunity Score** (0–100) | Blends revenue growth, financing need, working-capital pressure, transaction activity, and revenue stability into a commercial-opportunity score (High / Emerging / Moderate / Low) | `python/opportunity_engine.ipynb`, `sql/analysis.sql` |
| **B. Product Recommendation** | Matches each SME to CredibleX's real three-product suite — Receivables, Revenue-Based, or Payable Financing — with a plain-language reason | same |
| **C. Partner Opportunity Score** (0–100) | Scores potential partners on reach, activity, financing relevance, digital maturity, and growth (Priority / Emerging / Monitor) | same |
| **D. Early Warning** | Flags SMEs on four risk-adjacent signals (Stable / Monitor / Attention Required) — a screening signal, not a credit model | same |

**Important:** these are illustrative *commercial-opportunity* heuristics, not credit-risk models, and do not represent CredibleX's actual underwriting methodology. See the Scope section of [`docs/Project_Charter.pdf`](docs/Project_Charter.pdf).

## The AI layer

Rather than using AI to generate generic text, this project uses it to **explain calculated results**. Every prompt (see [`ai/prompts.md`](ai/prompts.md)) injects only pre-computed fields — the model narrates, it never invents a number. If no API key is set, `python/_ai_layer.py` and the dashboard fall back to a deterministic template generator with the identical structure, so the whole project runs end-to-end with zero credentials.

## Tech stack

- **Data & analysis:** Python (Pandas, NumPy), Jupyter notebooks, SQL (T-SQL)
- **AI layer:** LLM API (Anthropic Claude) with a template-based offline fallback
- **Dashboard:** HTML, CSS, JavaScript, Chart.js — no framework, no backend
- **Hosting:** GitHub Pages

## Running it yourself

```bash
git clone https://github.com/<your-username>/crediblex-growth-intelligence.git
cd crediblex-growth-intelligence

# Python environment
pip install pandas numpy jupyter nbclient

# Run the notebooks in order
jupyter nbconvert --to notebook --execute --inplace python/data_cleaning.ipynb
jupyter nbconvert --to notebook --execute --inplace python/opportunity_engine.ipynb
jupyter nbconvert --to notebook --execute --inplace python/ai_insights.ipynb

# Open the dashboard directly — no build step, no server required
open dashboard/index.html
```

To enable live AI-generated briefs instead of the template fallback, set `ANTHROPIC_API_KEY` in your environment before running `ai_insights.ipynb`.

### Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Deploy from branch → `main` → `/dashboard` (or move `dashboard/` contents to repo root / a `docs/` folder, per your GitHub Pages setup).
3. Your dashboard will be live at `https://<your-username>.github.io/crediblex-growth-intelligence/`.

## Repository structure

```
crediblex-growth-intelligence/
│
├── README.md
│
├── docs/
│   ├── Project_Charter.pdf
│   ├── CredibleX_Research.md
│   └── Final_Report.pdf
│
├── data/
│   ├── sme_data.csv              # raw synthetic SME data (1,000 rows)
│   ├── partner_data.csv          # raw synthetic partner data (50 rows)
│   ├── sme_scored.csv            # SME data + calculated scores
│   └── partner_scored.csv        # partner data + calculated scores
│
├── python/
│   ├── data_cleaning.ipynb
│   ├── opportunity_engine.ipynb
│   └── ai_insights.ipynb
│
├── sql/
│   └── analysis.sql
│
├── dashboard/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── data.js                   # scored data embedded for the dashboard
│   └── ai_briefs.json            # sample AI-generated briefs (top 20 each)
│
└── ai/
    └── prompts.md
```

## Limitations

All data is synthetically generated and does not represent real CredibleX customers, partners, or transactions. Scoring weights are reasoned assumptions, not calibrated against real outcomes. See Section 9 of [`docs/Final_Report.pdf`](docs/Final_Report.pdf) for full limitations and future scope.

## License

Portfolio project — feel free to reference the approach, but please don't represent it as CredibleX's actual product or methodology.
