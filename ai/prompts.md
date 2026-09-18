# AI Prompt Library — CredibleX Growth Intelligence Engine

This project uses an LLM (Claude / GPT-class model) for exactly one job:
**explaining pre-computed analytical results in business language.** The
model is never asked to calculate a score, choose a product, or invent a
number — every figure in the prompts below is passed in from the
deterministic analysis in `python/opportunity_engine.ipynb` /
`sql/analysis.sql`. This is a deliberate guardrail against AI hallucination
(see `Final_Report.pdf`, Section 7 — Challenges & Solutions).

If no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` is available in the runtime
environment, `python/_ai_layer.py` and the dashboard's `script.js` fall
back to a deterministic template generator that follows the exact same
structure — so the project runs end-to-end without live API credentials,
and can be upgraded to live LLM calls simply by setting an API key.

---

## 1. SME Financing Brief prompt

**Used in:** `python/ai_insights.ipynb`, `python/_ai_layer.py::build_sme_prompt`

```
You are a financing analyst at CredibleX writing an internal brief.
Use ONLY the facts below. Do not invent numbers. Keep it concise and business-toned.

SME_ID: {SME_ID}
Industry: {Industry}
Emirate: {Emirate}
Business_Age (years): {Business_Age}
Monthly_Revenue (AED): {Monthly_Revenue}
Revenue_Growth: {Revenue_Growth}
Revenue_Volatility: {Revenue_Volatility}
Transaction_Volume: {Transaction_Volume}
Receivable_Days: {Receivable_Days}
Payable_Days: {Payable_Days}
Cash_Buffer (days): {Cash_Buffer}
Financing_Requirement (AED): {Financing_Requirement}
Opportunity_Score: {Opportunity_Score} ({Opportunity_Segment})
Recommended_Product: {Recommended_Product}
Recommendation_Reason: {Recommendation_Reason}
Early_Warning_Status: {Early_Warning_Status}

Return a JSON object with exactly these keys:
business_profile, financing_opportunity, recommended_product, key_drivers,
potential_concern, suggested_next_action
```

**Output structure (AI Financing Brief):**
`Business Profile → Financing Opportunity → Recommended Product → Key Drivers → Potential Concern → Suggested Next Action`

---

## 2. Partner Brief prompt

**Used in:** `python/ai_insights.ipynb`, `python/_ai_layer.py::build_partner_prompt`

```
You are a business-development analyst at CredibleX writing an internal partner brief.
Use ONLY the facts below. Do not invent numbers.

Partner_ID: {Partner_ID}
Partner_Type: {Partner_Type}
SME_Reach: {SME_Reach}
Transaction_Volume (AED/month): {Transaction_Volume}
Industry_Focus: {Industry_Focus}
Financing_Relevance: {Financing_Relevance}
Digital_Maturity: {Digital_Maturity}
Growth_Rate: {Growth_Rate}
Integration_Complexity: {Integration_Complexity}
Partner_Score: {Partner_Score} ({Partner_Segment})

Return a JSON object with exactly these keys:
partner_profile, sme_exposure, financing_opportunity, potential_fit,
why_it_matters, suggested_bd_angle
```

**Output structure (AI Partner Brief):**
`Partner Profile → SME Exposure → Financing Opportunity → Potential CredibleX Fit → Why It Matters → Suggested Business Development Angle`

---

## 3. Executive Summary prompt

**Used in:** `python/ai_insights.ipynb::generate_executive_summary`

This one is intentionally *not* sent to an LLM in the reference
implementation — it's derived with simple aggregate statistics (top
industry among High-Opportunity SMEs, most-recommended product, % in each
Early-Warning bucket, count and type of Priority partners) and phrased as
four short insights. An equivalent prompt, if a live LLM call is preferred:

```
You are writing a 4-part executive summary for CredibleX leadership,
covering: portfolio_insight, product_insight, partner_insight,
early_warning_insight.

Use ONLY these pre-computed statistics — do not invent any figures:
- % of SMEs in "High Opportunity" segment: {pct_high}
- Most-represented industry among High-Opportunity SMEs: {top_industry}
- Most frequently recommended financing product: {top_product}
- Number of Priority-segment partners: {n_priority_partners}
- Most common partner type among Priority partners: {top_partner_type}
- % of SMEs flagged "Attention Required": {pct_attention}

Each insight should be 1–2 sentences, business-toned, and reference the
statistics given.
```

---

## 4. Design principles for this AI layer

1. **Numbers come from code, never from the model.** All prompts inject
   already-calculated fields; the model's only task is narrative framing.
2. **Structured output.** Every prompt requests a fixed JSON schema so the
   output can be rendered directly into the dashboard's brief modal without
   free-text parsing.
3. **Graceful degradation.** No API key → deterministic template output
   with an identical structure, so the notebooks and dashboard are fully
   functional without credentials (important for a portfolio project
   reviewers will run themselves).
4. **Traceability.** Because the AI is only explaining fields it was given,
   any brief can be manually checked against the source row in
   `data/sme_scored.csv` / `data/partner_scored.csv`.
