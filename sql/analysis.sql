/* =============================================================================
   CredibleX Growth Intelligence Engine — SQL Analysis
   =============================================================================
   Written for Microsoft SQL Server (T-SQL). Assumes two base tables have
   already been loaded from data/sme_data.csv and data/partner_data.csv:

     dbo.SME      (SME_ID, Industry, Emirate, Business_Age, Monthly_Revenue,
                    Revenue_Growth, Revenue_Volatility, Transaction_Volume,
                    Receivable_Days, Payable_Days, Cash_Buffer,
                    Financing_Requirement, Repayment_Behaviour)

     dbo.Partner  (Partner_ID, Partner_Type, SME_Reach, Transaction_Volume,
                    Industry_Focus, Financing_Relevance, Digital_Maturity,
                    Growth_Rate, Integration_Complexity)

   This script mirrors the same logic implemented in Python inside
   python/opportunity_engine.ipynb, so results are consistent whether the
   analysis is run in Python or directly in SQL. All figures are synthetic
   and illustrative only.
============================================================================= */

/* -----------------------------------------------------------------------
   0. (Optional) Table creation — run once when loading raw CSVs via
      SSMS Import Wizard or BULK INSERT.
------------------------------------------------------------------------ */
-- CREATE TABLE dbo.SME (
--     SME_ID                 VARCHAR(10) PRIMARY KEY,
--     Industry                VARCHAR(50),
--     Emirate                 VARCHAR(30),
--     Business_Age            DECIMAL(5,1),
--     Monthly_Revenue         BIGINT,
--     Revenue_Growth          DECIMAL(6,3),
--     Revenue_Volatility      DECIMAL(6,3),
--     Transaction_Volume      INT,
--     Receivable_Days         INT,
--     Payable_Days            INT,
--     Cash_Buffer             INT,
--     Financing_Requirement   BIGINT,
--     Repayment_Behaviour     VARCHAR(20)
-- );
--
-- CREATE TABLE dbo.Partner (
--     Partner_ID              VARCHAR(10) PRIMARY KEY,
--     Partner_Type            VARCHAR(50),
--     SME_Reach                INT,
--     Transaction_Volume       BIGINT,
--     Industry_Focus           VARCHAR(50),
--     Financing_Relevance      DECIMAL(6,1),
--     Digital_Maturity         DECIMAL(6,1),
--     Growth_Rate              DECIMAL(6,3),
--     Integration_Complexity   VARCHAR(10)
-- );


/* -----------------------------------------------------------------------
   A. SME Financing Opportunity Score (0-100)
   -----------------------------------------------------------------------
   Min-max normalises five signals and blends them with the same weights
   used in the Python engine:
     25% revenue growth · 25% financing requirement ratio
   · 20% working-capital pressure · 15% transaction volume · 15% stability
------------------------------------------------------------------------ */
WITH Bounds AS (
    SELECT
        MIN(CASE WHEN Revenue_Growth > 0 THEN Revenue_Growth ELSE 0 END) AS Growth_Min,
        MAX(CASE WHEN Revenue_Growth > 0 THEN Revenue_Growth ELSE 0 END) AS Growth_Max,
        MIN(CAST(Financing_Requirement AS FLOAT) / Monthly_Revenue) AS FinRatio_Min,
        MAX(CAST(Financing_Requirement AS FLOAT) / Monthly_Revenue) AS FinRatio_Max,
        MIN(Receivable_Days) AS RecvDays_Min, MAX(Receivable_Days) AS RecvDays_Max,
        MIN(Cash_Buffer) AS Cash_Min, MAX(Cash_Buffer) AS Cash_Max,
        MIN(LOG(1 + Transaction_Volume)) AS TxnLog_Min, MAX(LOG(1 + Transaction_Volume)) AS TxnLog_Max,
        MIN(Revenue_Volatility) AS Vol_Min, MAX(Revenue_Volatility) AS Vol_Max
    FROM dbo.SME
),
Normalised AS (
    SELECT
        s.SME_ID,
        s.Industry, s.Emirate, s.Monthly_Revenue, s.Revenue_Growth,
        s.Receivable_Days, s.Payable_Days, s.Cash_Buffer,
        s.Financing_Requirement, s.Transaction_Volume, s.Revenue_Volatility,
        s.Repayment_Behaviour,
        -- normalised components, each in [0,1]
        (CASE WHEN s.Revenue_Growth > 0 THEN s.Revenue_Growth ELSE 0 END - b.Growth_Min)
            / NULLIF(b.Growth_Max - b.Growth_Min, 0) AS Growth_N,
        ((CAST(s.Financing_Requirement AS FLOAT) / s.Monthly_Revenue) - b.FinRatio_Min)
            / NULLIF(b.FinRatio_Max - b.FinRatio_Min, 0) AS FinRatio_N,
        (0.6 * ((s.Receivable_Days - b.RecvDays_Min) * 1.0 / NULLIF(b.RecvDays_Max - b.RecvDays_Min, 0))
         + 0.4 * (1 - ((s.Cash_Buffer - b.Cash_Min) * 1.0 / NULLIF(b.Cash_Max - b.Cash_Min, 0)))) AS WCPressure_N,
        ((LOG(1 + s.Transaction_Volume) - b.TxnLog_Min) / NULLIF(b.TxnLog_Max - b.TxnLog_Min, 0)) AS Txn_N,
        (1 - (s.Revenue_Volatility - b.Vol_Min) / NULLIF(b.Vol_Max - b.Vol_Min, 0)) AS Stability_N
    FROM dbo.SME s CROSS JOIN Bounds b
),
Scored AS (
    SELECT *,
        ROUND(
            (0.25 * Growth_N + 0.25 * FinRatio_N + 0.20 * WCPressure_N
             + 0.15 * Txn_N + 0.15 * Stability_N) * 100, 1
        ) AS Opportunity_Score
    FROM Normalised
),
WithPercentiles AS (
    SELECT *,
        PERCENTILE_CONT(0.65) WITHIN GROUP (ORDER BY Opportunity_Score) OVER () AS P65,
        PERCENTILE_CONT(0.40) WITHIN GROUP (ORDER BY Opportunity_Score) OVER () AS P40,
        PERCENTILE_CONT(0.15) WITHIN GROUP (ORDER BY Opportunity_Score) OVER () AS P15
    FROM Scored
)
SELECT
    SME_ID, Industry, Emirate, Monthly_Revenue, Opportunity_Score,
    CASE
        WHEN Opportunity_Score >= P65 AND Opportunity_Score >= 60 THEN 'High Opportunity'
        WHEN Opportunity_Score >= P40 THEN 'Emerging Opportunity'
        WHEN Opportunity_Score >= P15 THEN 'Moderate Opportunity'
        ELSE 'Low Opportunity'
    END AS Opportunity_Segment
INTO #SME_Scored
FROM WithPercentiles;

SELECT Opportunity_Segment, COUNT(*) AS SME_Count, ROUND(AVG(Opportunity_Score),1) AS Avg_Score
FROM #SME_Scored
GROUP BY Opportunity_Segment
ORDER BY Avg_Score DESC;


/* -----------------------------------------------------------------------
   B. Financing Product Recommendation
------------------------------------------------------------------------ */
SELECT
    s.SME_ID,
    s.Receivable_Days, s.Payable_Days, s.Revenue_Growth, s.Revenue_Volatility,
    CASE
        WHEN s.Receivable_Days >= 45 AND s.Receivable_Days >= s.Payable_Days
            THEN 'Receivables Financing'
        WHEN s.Revenue_Growth >= 0.15 AND s.Revenue_Volatility <= 0.35
            THEN 'Revenue-Based Financing'
        WHEN s.Payable_Days >= 30
            THEN 'Payable Financing'
        ELSE 'Revenue-Based Financing'
    END AS Recommended_Product,
    CASE
        WHEN s.Receivable_Days >= 45 AND s.Receivable_Days >= s.Payable_Days
            THEN 'Receivable days exceed payable days — delayed customer payments likely creating working-capital pressure.'
        WHEN s.Revenue_Growth >= 0.15 AND s.Revenue_Volatility <= 0.35
            THEN 'Strong, stable revenue growth supports repayment as a share of future revenue.'
        WHEN s.Payable_Days >= 30
            THEN 'High payable days suggest the SME could benefit from extended supplier payment terms.'
        ELSE 'No single working-capital driver dominates; revenue-based financing is the most flexible fit.'
    END AS Recommendation_Reason
INTO #Product_Match
FROM dbo.SME s;

SELECT Recommended_Product, COUNT(*) AS SME_Count
FROM #Product_Match
GROUP BY Recommended_Product
ORDER BY SME_Count DESC;


/* -----------------------------------------------------------------------
   C. Partner Opportunity Score (0-100)
------------------------------------------------------------------------ */
WITH PBounds AS (
    SELECT
        MIN(LOG(1 + SME_Reach)) AS Reach_Min, MAX(LOG(1 + SME_Reach)) AS Reach_Max,
        MIN(LOG(1 + Transaction_Volume)) AS Txn_Min, MAX(LOG(1 + Transaction_Volume)) AS Txn_Max,
        MIN(Financing_Relevance) AS Rel_Min, MAX(Financing_Relevance) AS Rel_Max,
        MIN(Digital_Maturity) AS Dig_Min, MAX(Digital_Maturity) AS Dig_Max,
        MIN(Growth_Rate) AS Gro_Min, MAX(Growth_Rate) AS Gro_Max
    FROM dbo.Partner
),
PNorm AS (
    SELECT
        p.Partner_ID, p.Partner_Type, p.SME_Reach, p.Financing_Relevance,
        p.Integration_Complexity,
        (LOG(1 + p.SME_Reach) - b.Reach_Min) / NULLIF(b.Reach_Max - b.Reach_Min, 0) AS Reach_N,
        (LOG(1 + p.Transaction_Volume) - b.Txn_Min) / NULLIF(b.Txn_Max - b.Txn_Min, 0) AS Txn_N,
        (p.Financing_Relevance - b.Rel_Min) / NULLIF(b.Rel_Max - b.Rel_Min, 0) AS Rel_N,
        (p.Digital_Maturity - b.Dig_Min) / NULLIF(b.Dig_Max - b.Dig_Min, 0) AS Dig_N,
        (p.Growth_Rate - b.Gro_Min) / NULLIF(b.Gro_Max - b.Gro_Min, 0) AS Gro_N,
        CASE p.Integration_Complexity
            WHEN 'Low' THEN 0.0 WHEN 'Medium' THEN 0.08 WHEN 'High' THEN 0.18 END AS Complexity_Penalty
    FROM dbo.Partner p CROSS JOIN PBounds b
),
PScored AS (
    SELECT *,
        ROUND(
            (0.28*Reach_N + 0.20*Txn_N + 0.27*Rel_N + 0.10*Dig_N + 0.15*Gro_N) * 100
            - Complexity_Penalty * 100, 1
        ) AS Partner_Score
    FROM PNorm
),
PPercentiles AS (
    SELECT *,
        PERCENTILE_CONT(0.70) WITHIN GROUP (ORDER BY Partner_Score) OVER () AS P70,
        PERCENTILE_CONT(0.35) WITHIN GROUP (ORDER BY Partner_Score) OVER () AS P35
    FROM PScored
)
SELECT
    Partner_ID, Partner_Type, SME_Reach, Partner_Score,
    CASE
        WHEN Partner_Score >= P70 THEN 'Priority'
        WHEN Partner_Score >= P35 THEN 'Emerging'
        ELSE 'Monitor'
    END AS Partner_Segment
INTO #Partner_Scored
FROM PPercentiles;

SELECT Partner_Segment, COUNT(*) AS Partner_Count, ROUND(AVG(Partner_Score),1) AS Avg_Score
FROM #Partner_Scored
GROUP BY Partner_Segment
ORDER BY Avg_Score DESC;


/* -----------------------------------------------------------------------
   D. Early Warning Classification
------------------------------------------------------------------------ */
WITH Thresholds AS (
    SELECT
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY Receivable_Days) OVER () AS Recv_P75,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY Transaction_Volume) OVER () AS Txn_P25,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY Cash_Buffer) OVER () AS Cash_P25,
        SME_ID, Revenue_Growth, Receivable_Days, Transaction_Volume, Cash_Buffer, Repayment_Behaviour
    FROM dbo.SME
),
Flags AS (
    SELECT
        SME_ID,
        (CASE WHEN Revenue_Growth < -0.05 THEN 1 ELSE 0 END) +
        (CASE WHEN Receivable_Days > Recv_P75 THEN 1 ELSE 0 END) +
        (CASE WHEN Transaction_Volume < Txn_P25 THEN 1 ELSE 0 END) +
        (CASE WHEN Cash_Buffer < Cash_P25 THEN 1 ELSE 0 END) +
        (CASE WHEN Repayment_Behaviour IN ('Poor','Fair') THEN 1 ELSE 0 END) AS Warning_Flags
    FROM Thresholds
)
SELECT
    SME_ID, Warning_Flags,
    CASE
        WHEN Warning_Flags >= 3 THEN 'Attention Required'
        WHEN Warning_Flags >= 1 THEN 'Monitor'
        ELSE 'Stable'
    END AS Early_Warning_Status
INTO #Early_Warning
FROM Flags;

SELECT Early_Warning_Status, COUNT(*) AS SME_Count
FROM #Early_Warning
GROUP BY Early_Warning_Status
ORDER BY SME_Count DESC;


/* -----------------------------------------------------------------------
   Combined view: joins all four modules for a full SME intelligence row
------------------------------------------------------------------------ */
SELECT
    s.SME_ID, s.Industry, s.Emirate, s.Monthly_Revenue,
    sc.Opportunity_Score, sc.Opportunity_Segment,
    pm.Recommended_Product,
    ew.Early_Warning_Status
FROM dbo.SME s
JOIN #SME_Scored sc ON s.SME_ID = sc.SME_ID
JOIN #Product_Match pm ON s.SME_ID = pm.SME_ID
JOIN #Early_Warning ew ON s.SME_ID = ew.SME_ID
ORDER BY sc.Opportunity_Score DESC;


/* -----------------------------------------------------------------------
   Business intelligence queries used to validate the AI Executive Summary
------------------------------------------------------------------------ */

-- Opportunity concentration by industry
SELECT Industry, COUNT(*) AS SME_Count,
       ROUND(AVG(Opportunity_Score), 1) AS Avg_Opportunity_Score,
       SUM(CASE WHEN Opportunity_Segment = 'High Opportunity' THEN 1 ELSE 0 END) AS High_Opportunity_Count
FROM #SME_Scored
GROUP BY Industry
ORDER BY Avg_Opportunity_Score DESC;

-- Opportunity vs Early Warning cross-tab
SELECT sc.Opportunity_Segment, ew.Early_Warning_Status, COUNT(*) AS SME_Count
FROM #SME_Scored sc
JOIN #Early_Warning ew ON sc.SME_ID = ew.SME_ID
GROUP BY sc.Opportunity_Segment, ew.Early_Warning_Status
ORDER BY sc.Opportunity_Segment, ew.Early_Warning_Status;

-- Top partner types by average Partner Score
SELECT Partner_Type, COUNT(*) AS Partner_Count, ROUND(AVG(Partner_Score),1) AS Avg_Score
FROM #Partner_Scored
GROUP BY Partner_Type
ORDER BY Avg_Score DESC;

-- Clean-up
DROP TABLE IF EXISTS #SME_Scored, #Product_Match, #Partner_Scored, #Early_Warning;
