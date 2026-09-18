"""
CredibleX Growth Intelligence Engine — AI Explanation Layer
=============================================================
This module turns the *calculated* analytical outputs (opportunity
scores, product matches, partner scores, early-warning flags) into
natural-language business briefs.

Design choice
-------------
If an `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) environment variable is
present, this module calls that LLM API with a prompt built strictly
from the row's own analytical fields (see ai/prompts.md), so the model
explains numbers it's given rather than inventing them.

If no API key is available (e.g. running this notebook fresh from
GitHub without credentials), the module falls back to a deterministic,
template-based narrative generator that mirrors the same structure.
This keeps the notebook fully runnable out of the box while still
demonstrating the intended AI-explanation pattern. Swap in a real key
to see live LLM-generated briefs instead.
"""
import os
import json

USE_LIVE_LLM = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY"))


# ---------------------------------------------------------------------------
# Prompt builders (used for both the live-LLM path and documentation)
# ---------------------------------------------------------------------------
def build_sme_prompt(row: dict) -> str:
    return f"""You are a financing analyst at CredibleX writing an internal brief.
Use ONLY the facts below. Do not invent numbers. Keep it concise and business-toned.

SME_ID: {row['SME_ID']}
Industry: {row['Industry']}
Emirate: {row['Emirate']}
Business_Age (years): {row['Business_Age']}
Monthly_Revenue (AED): {row['Monthly_Revenue']}
Revenue_Growth: {row['Revenue_Growth']}
Revenue_Volatility: {row['Revenue_Volatility']}
Transaction_Volume: {row['Transaction_Volume']}
Receivable_Days: {row['Receivable_Days']}
Payable_Days: {row['Payable_Days']}
Cash_Buffer (days): {row['Cash_Buffer']}
Financing_Requirement (AED): {row['Financing_Requirement']}
Opportunity_Score: {row['Opportunity_Score']} ({row['Opportunity_Segment']})
Recommended_Product: {row['Recommended_Product']}
Recommendation_Reason: {row['Recommendation_Reason']}
Early_Warning_Status: {row['Early_Warning_Status']}

Return a JSON object with exactly these keys:
business_profile, financing_opportunity, recommended_product, key_drivers,
potential_concern, suggested_next_action"""


def build_partner_prompt(row: dict) -> str:
    return f"""You are a business-development analyst at CredibleX writing an internal partner brief.
Use ONLY the facts below. Do not invent numbers.

Partner_ID: {row['Partner_ID']}
Partner_Type: {row['Partner_Type']}
SME_Reach: {row['SME_Reach']}
Transaction_Volume (AED/month): {row['Transaction_Volume']}
Industry_Focus: {row['Industry_Focus']}
Financing_Relevance: {row['Financing_Relevance']}
Digital_Maturity: {row['Digital_Maturity']}
Growth_Rate: {row['Growth_Rate']}
Integration_Complexity: {row['Integration_Complexity']}
Partner_Score: {row['Partner_Score']} ({row['Partner_Segment']})

Return a JSON object with exactly these keys:
partner_profile, sme_exposure, financing_opportunity, potential_fit,
why_it_matters, suggested_bd_angle"""


# ---------------------------------------------------------------------------
# Template-based fallback generator (deterministic, no API key required)
# ---------------------------------------------------------------------------
def _fmt_pct(x):
    return f"{x*100:.1f}%"


def _fmt_aed(x):
    return f"AED {x:,.0f}"


def generate_sme_brief_template(row: dict) -> dict:
    growth_desc = "growing" if row["Revenue_Growth"] > 0.03 else (
        "contracting" if row["Revenue_Growth"] < -0.03 else "broadly flat")
    volatility_desc = "stable" if row["Revenue_Volatility"] < 0.3 else "variable"

    business_profile = (
        f"{row['SME_ID']} is a {row['Business_Age']}-year-old {row['Industry']} business "
        f"based in {row['Emirate']}, generating approximately {_fmt_aed(row['Monthly_Revenue'])} "
        f"in monthly revenue with {volatility_desc} revenue patterns and revenue that is "
        f"currently {growth_desc} ({_fmt_pct(row['Revenue_Growth'])} growth)."
    )

    financing_opportunity = (
        f"The business scores {row['Opportunity_Score']}/100 on the Financing Opportunity Score, "
        f"placing it in the '{row['Opportunity_Segment']}' segment, with an estimated illustrative "
        f"financing requirement of {_fmt_aed(row['Financing_Requirement'])}."
    )

    recommended_product = f"{row['Recommended_Product']}. {row['Recommendation_Reason']}"

    drivers = []
    if row["Receivable_Days"] > 45:
        drivers.append(f"elevated receivable days ({row['Receivable_Days']} days)")
    if row["Revenue_Growth"] > 0.1:
        drivers.append(f"strong revenue growth ({_fmt_pct(row['Revenue_Growth'])})")
    if row["Transaction_Volume"] > 150:
        drivers.append(f"healthy transaction activity ({row['Transaction_Volume']} transactions/month)")
    if row["Cash_Buffer"] < 20:
        drivers.append(f"thin cash buffer ({row['Cash_Buffer']} days)")
    if not drivers:
        drivers.append("a moderate, well-balanced financial profile")
    key_drivers = "; ".join(drivers).capitalize() + "."

    if row["Early_Warning_Status"] == "Attention Required":
        potential_concern = (
            "Multiple early-warning indicators are flagged (declining revenue, elevated "
            "receivables, thin cash buffer, or weak repayment history) — this SME warrants "
            "closer review before any financing offer is extended."
        )
    elif row["Early_Warning_Status"] == "Monitor":
        potential_concern = (
            "One or two early-warning signals are present; not disqualifying, but worth "
            "monitoring alongside the financing conversation."
        )
    else:
        potential_concern = "No material early-warning signals are present at this time."

    suggested_next_action = (
        f"Prioritise outreach with a tailored {row['Recommended_Product']} offer" +
        (", but pair it with a light-touch financial review given the flagged concerns."
         if row["Early_Warning_Status"] != "Stable" else
         " and fast-track given the clean risk profile.")
    )

    return {
        "business_profile": business_profile,
        "financing_opportunity": financing_opportunity,
        "recommended_product": recommended_product,
        "key_drivers": key_drivers,
        "potential_concern": potential_concern,
        "suggested_next_action": suggested_next_action,
    }


def generate_partner_brief_template(row: dict) -> dict:
    partner_profile = (
        f"{row['Partner_ID']} is a {row['Partner_Type']} with a primary focus on the "
        f"{row['Industry_Focus']} sector, reaching an estimated {row['SME_Reach']:,} SMEs "
        f"and processing roughly {_fmt_aed(row['Transaction_Volume'])} in transaction volume per month."
    )

    sme_exposure = (
        f"With {row['SME_Reach']:,} SMEs in its network and a digital maturity score of "
        f"{row['Digital_Maturity']}/100, this partner offers "
        f"{'substantial' if row['SME_Reach'] > 2000 else 'moderate'} reach into CredibleX's target segment."
    )

    financing_opportunity = (
        f"Financing relevance is scored at {row['Financing_Relevance']}/100, and the partner's "
        f"overall Partner Opportunity Score is {row['Partner_Score']}/100 ('{row['Partner_Segment']}')."
    )

    potential_fit = (
        "Strong candidate for an embedded-finance integration where CredibleX financing "
        "products are offered at the point of transaction or invoicing."
        if row["Partner_Segment"] == "Priority" else
        "Reasonable candidate worth developing further, with fit likely to improve as "
        "digital integration and transaction volume mature."
        if row["Partner_Segment"] == "Emerging" else
        "Lower near-term fit; better suited to periodic monitoring than active pursuit."
    )

    why_it_matters = (
        f"Growth rate of {_fmt_pct(row['Growth_Rate'])} and "
        f"{row['Integration_Complexity'].lower()} integration complexity mean this partnership "
        f"could scale {'quickly' if row['Growth_Rate'] > 0.15 and row['Integration_Complexity']=='Low' else 'steadily'} "
        "if pursued."
    )

    suggested_bd_angle = (
        f"Approach with an embedded-financing pilot tailored to {row['Industry_Focus']} SMEs "
        f"in the partner's network, emphasising {'quick technical integration' if row['Integration_Complexity']=='Low' else 'a phased integration roadmap'}."
    )

    return {
        "partner_profile": partner_profile,
        "sme_exposure": sme_exposure,
        "financing_opportunity": financing_opportunity,
        "potential_fit": potential_fit,
        "why_it_matters": why_it_matters,
        "suggested_bd_angle": suggested_bd_angle,
    }


def generate_executive_summary_template(sme_df, partner_df) -> dict:
    top_industry = (
        sme_df[sme_df["Opportunity_Segment"] == "High Opportunity"]["Industry"]
        .value_counts().idxmax()
    )
    top_product = sme_df["Recommended_Product"].value_counts().idxmax()
    pct_high = (sme_df["Opportunity_Segment"] == "High Opportunity").mean() * 100
    pct_attention = (sme_df["Early_Warning_Status"] == "Attention Required").mean() * 100
    n_priority_partners = (partner_df["Partner_Segment"] == "Priority").sum()
    top_partner_type = (
        partner_df[partner_df["Partner_Segment"] == "Priority"]["Partner_Type"]
        .value_counts().idxmax() if n_priority_partners > 0 else partner_df["Partner_Type"].value_counts().idxmax()
    )

    portfolio_insight = (
        f"{pct_high:.1f}% of analysed SMEs fall into the High-Opportunity segment, with "
        f"{top_industry} the most represented industry among them — indicating where "
        "embedded-finance demand is currently concentrated."
    )
    product_insight = (
        f"{top_product} is the most frequently recommended product across the portfolio, "
        "suggesting working-capital timing mismatches are the dominant financing need "
        "among the SMEs analysed."
    )
    partner_insight = (
        f"{n_priority_partners} partners are classified as Priority, led by "
        f"{top_partner_type} players — these represent the strongest near-term candidates "
        "for embedded-finance distribution."
    )
    early_warning_insight = (
        f"{pct_attention:.1f}% of SMEs are flagged as 'Attention Required' on the early-warning "
        "framework and should be reviewed before financing outreach, even where their "
        "opportunity score looks attractive."
    )

    return {
        "portfolio_insight": portfolio_insight,
        "product_insight": product_insight,
        "partner_insight": partner_insight,
        "early_warning_insight": early_warning_insight,
    }


# ---------------------------------------------------------------------------
# Optional live-LLM path (used only if an API key is present)
# ---------------------------------------------------------------------------
def _call_anthropic(prompt: str) -> dict:
    import urllib.request

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps({
            "model": "claude-sonnet-4-6",
            "max_tokens": 600,
            "messages": [{"role": "user", "content": prompt}],
        }).encode(),
        headers={
            "Content-Type": "application/json",
            "x-api-key": os.environ["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    text = "".join(b["text"] for b in data["content"] if b["type"] == "text")
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


def generate_sme_brief(row: dict) -> dict:
    if USE_LIVE_LLM:
        try:
            return _call_anthropic(build_sme_prompt(row))
        except Exception:
            pass  # fall back silently if the live call fails
    return generate_sme_brief_template(row)


def generate_partner_brief(row: dict) -> dict:
    if USE_LIVE_LLM:
        try:
            return _call_anthropic(build_partner_prompt(row))
        except Exception:
            pass
    return generate_partner_brief_template(row)
