"""
CredibleX Growth Intelligence Engine — Scoring Logic
This module contains the four analytical functions used across the project:
  A. SME Financing Opportunity Score (0-100)
  B. Financing Product Recommendation
  C. Partner Opportunity Score (0-100)
  D. Early Warning Classification

NOTE: These are illustrative commercial-opportunity heuristics built on
synthetic data. They are NOT credit-risk models and do not represent
CredibleX's actual underwriting methodology.
"""
import numpy as np
import pandas as pd


def _minmax(s: pd.Series) -> pd.Series:
    lo, hi = s.min(), s.max()
    if hi == lo:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return (s - lo) / (hi - lo)


# ---------------------------------------------------------------------------
# A. SME Financing Opportunity Score
# ---------------------------------------------------------------------------
def compute_sme_opportunity_score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    growth_n = _minmax(df["Revenue_Growth"].clip(lower=0))
    financing_n = _minmax(df["Financing_Requirement"] / df["Monthly_Revenue"])
    wc_pressure_n = _minmax(
        0.6 * _minmax(df["Receivable_Days"]) + 0.4 * (1 - _minmax(df["Cash_Buffer"]))
    )
    txn_n = _minmax(np.log1p(df["Transaction_Volume"]))
    stability_n = 1 - _minmax(df["Revenue_Volatility"])

    score = (
        0.25 * growth_n +
        0.25 * financing_n +
        0.20 * wc_pressure_n +
        0.15 * txn_n +
        0.15 * stability_n
    ) * 100

    df["Opportunity_Score"] = score.round(1)

    # Quantile-based segmentation: keeps class sizes meaningful for a
    # portfolio-style prototype instead of relying on arbitrary fixed cuts.
    q65, q40, q15 = df["Opportunity_Score"].quantile([0.65, 0.40, 0.15])

    def bucket(s):
        if s >= q65 and s >= 60:
            return "High Opportunity"
        elif s >= q40:
            return "Emerging Opportunity"
        elif s >= q15:
            return "Moderate Opportunity"
        else:
            return "Low Opportunity"

    df["Opportunity_Segment"] = df["Opportunity_Score"].apply(bucket)
    return df


# ---------------------------------------------------------------------------
# B. Product Recommendation
# ---------------------------------------------------------------------------
def recommend_product(row) -> tuple:
    receivable_days = row["Receivable_Days"]
    payable_days = row["Payable_Days"]
    growth = row["Revenue_Growth"]
    volatility = row["Revenue_Volatility"]

    if receivable_days >= 45 and receivable_days >= payable_days:
        product = "Receivables Financing"
        reason = (
            f"Receivable days of {receivable_days} exceed payable days of {payable_days}, "
            "suggesting delayed customer payments are creating working-capital pressure that "
            "invoice/receivables financing could bridge."
        )
    elif growth >= 0.15 and volatility <= 0.35:
        product = "Revenue-Based Financing"
        reason = (
            f"Revenue growth of {growth*100:.1f}% combined with relatively stable revenue "
            "(low volatility) indicates the business could support financing repaid as a "
            "share of future revenue."
        )
    elif payable_days >= 30:
        product = "Payable Financing"
        reason = (
            f"Payable days of {payable_days} suggest the SME could benefit from extending "
            "supplier payment terms through payable financing to smooth cash flow."
        )
    else:
        product = "Revenue-Based Financing"
        reason = (
            "No single working-capital driver dominates; revenue-based financing offers "
            "the most flexible fit given the business's current profile."
        )
    return product, reason


def apply_product_recommendation(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    results = df.apply(recommend_product, axis=1, result_type="expand")
    df["Recommended_Product"] = results[0]
    df["Recommendation_Reason"] = results[1]
    return df


# ---------------------------------------------------------------------------
# C. Partner Opportunity Score
# ---------------------------------------------------------------------------
def compute_partner_opportunity_score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    reach_n = _minmax(np.log1p(df["SME_Reach"]))
    txn_n = _minmax(np.log1p(df["Transaction_Volume"]))
    relevance_n = _minmax(df["Financing_Relevance"])
    digital_n = _minmax(df["Digital_Maturity"])
    growth_n = _minmax(df["Growth_Rate"])
    complexity_penalty = df["Integration_Complexity"].map({"Low": 0.0, "Medium": 0.08, "High": 0.18})

    score = (
        0.28 * reach_n +
        0.20 * txn_n +
        0.27 * relevance_n +
        0.10 * digital_n +
        0.15 * growth_n
    ) * 100 - complexity_penalty * 100

    score = score.clip(lower=0, upper=100)
    df["Partner_Score"] = score.round(1)

    q70, q35 = df["Partner_Score"].quantile([0.70, 0.35])

    def bucket(s):
        if s >= q70:
            return "Priority"
        elif s >= q35:
            return "Emerging"
        else:
            return "Monitor"

    df["Partner_Segment"] = df["Partner_Score"].apply(bucket)
    return df


# ---------------------------------------------------------------------------
# D. Early Warning
# ---------------------------------------------------------------------------
def compute_early_warning(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    flags = pd.DataFrame(index=df.index)
    flags["declining_revenue"] = df["Revenue_Growth"] < -0.05
    flags["high_receivables"] = df["Receivable_Days"] > df["Receivable_Days"].quantile(0.75)
    flags["low_transactions"] = df["Transaction_Volume"] < df["Transaction_Volume"].quantile(0.25)
    flags["low_cash_buffer"] = df["Cash_Buffer"] < df["Cash_Buffer"].quantile(0.25)
    flags["poor_repayment"] = df["Repayment_Behaviour"].isin(["Poor", "Fair"])

    flag_count = flags.sum(axis=1)
    df["Warning_Flags"] = flag_count

    def bucket(n):
        if n >= 3:
            return "Attention Required"
        elif n >= 1:
            return "Monitor"
        else:
            return "Stable"

    df["Early_Warning_Status"] = flag_count.apply(bucket)
    return df


def run_full_pipeline(sme_df: pd.DataFrame, partner_df: pd.DataFrame):
    sme = compute_sme_opportunity_score(sme_df)
    sme = apply_product_recommendation(sme)
    sme = compute_early_warning(sme)
    partner = compute_partner_opportunity_score(partner_df)
    return sme, partner
