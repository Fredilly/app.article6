# Quick Check v2 fixture review: Maya Forest Corridor REDD+ Belize

This fixture has been reviewed against `source.pdf` and `extracted.txt`.

Reviewed `gold.json` is the truth. Current Quick Check output is preserved below only to document extraction failures that still need generic fixes outside this fixture PR.

- Fixture id: `maya-forest-corridor-redd-belize`
- Source PDF: `/Users/stphen/Desktop/12-maya-forest-corridor-redd-belize.pdf`

## Reviewed truth

### host_country

- reviewed answer: Belize
- reviewed status: FOUND
- reviewed quote: Project location Belize, Belize and Cayo Districts
- page: 1
- section: none
- spanId: maya-forest-corridor-redd-belize-extracted:p1:b21:b1cbf7fb
- source type: fact_contract

### methodology

- reviewed answer: VM0007 REDD+ Methodology Framework v1.8
- reviewed status: FOUND
- reviewed quote: Methodology VM0007 VM0007 REDD+ Methodology Framework (REDD+MF) 1.8
- page: 83
- section: Title and Reference of Methodology (VCS, 3.1)
- spanId: maya-forest-corridor-redd-belize-extracted:p83:b3279:1a24fa3e
- source type: exact_section
- notes for method ID/version: VM0007 v1.8 (DECLARED)

### baseline_scenario

- reviewed answer: REDD project area consists of sanctioned deforestation caused by conversion to industrial agriculture
- reviewed status: FOUND
- reviewed quote: REDD project area consists of sanctioned deforestation caused by conversion to industrial agriculture.
- page: 89
- section: Baseline Scenario (VCS, 3.13)
- spanId: maya-forest-corridor-redd-belize-extracted:p89:b3568:bc966054
- source type: exact_section
- note: Sugarcane support appears elsewhere in the document, but the visible answer is limited to what this quote directly proves.

### additionality

- reviewed answer: VT0001 v3.0 shows the project is not legally mandated because all alternatives are legal under Belizean law, selects Alternative A as the baseline scenario, and uses simple cost analysis because the project depends on carbon revenue.
- reviewed status: FOUND
- reviewed quote: The following analysis was conducted to determine alternative baseline scenarios according to the procedure presented in “VT0001 Tool for the Demonstration and Assessment of Additionality in VCS Agriculture, Forestry and Other Land Use (AFOLU) Project Activities (Version 3.0).” Because the project is private property, all alternatives presented in 1a are legal under Belizean law. Alternative A - Clearing of Forest and Conversion to Agriculture - is selected as the baseline scenario. Because the Project generates no financial or economic benefits other than VCS related income, the simple cost analysis (Option 1) is selected. Income from the project area would be zero where in the project scenario, income from carbon revenue would help cover the project costs.
- page: 91
- section: Additionality Methods (VCS, 3.14)
- spanId: maya-forest-corridor-redd-belize-extracted:p91:b3603:d73df7cc
- source type: exact_section
- weak evidence to reject: page 46 section 2.2.1 describes prior conditions and legal clearing, but does not by itself prove the VT0001 additionality conclusion.

### leakage

- reviewed answer: Leakage is assessed under VMD0009 LK-ASP using Approach 2 Market Leakage Assessment; sugarcane is the baseline commodity; timber leakage is excluded as de minimis.
- reviewed status: FOUND
- reviewed quote: Leakage was determined following the steps described in module VMD0009 Estimation of emissions from activity shifting for avoiding planned deforestation/forest degradation and avoiding planned wetland degradation (LK-ASP). Since a specific agent of deforestation is not identified, a class of deforestation is used to determine activity shifting leakage using approach 2 Market Leakage Assessment. As described in section 3.1.3, given the fact that harvested wood products are identified as de minimis, market effects leakage due to decreased timber harvest was excluded from the analysis. The most likely commodity for the class of deforestation agent is Sugarcane (Saccharum officinarum).
- page: 116
- section: Leakage Emissions (VCS 2.5, 3.2, 3.6, 3.15, 4.3)
- spanId: maya-forest-corridor-redd-belize-extracted:p116:b4525:41a8b234
- source type: exact_section
- weak evidence to reject: page 82 says only “Not applicable. Refer to 3.2.3 Leakage Emissions.” That cross-reference must not satisfy leakage by itself.
- secondary evidence: page 122 states the leakage adjustment management factor (LKMAF) is 1.

### stakeholder_consultation

- reviewed answer: Initial consultations were held from 29 May 2024 to 9 June 2024, follow-up consultations were held from 23 August 2024 to 28 August 2024, engagement was conducted in English and Spanish, and Table 7 summarizes comments received and actions taken.
- reviewed status: FOUND
- reviewed quote: 29 May 2024 to June 9, 2024 ... Eight Community-level meetings were held with 35 community leaders in the 12 target communities ... Formal letters, in English and Spanish, were sent to community leaders ... Table 6. Follow-up stakeholder consultations ... 23 August 2024 to 28 August 2024 ... Four community meetings were held with 54 community leaders and community members from the 12 target communities ... Invitations were disseminated in English and Spanish ... Three meetings were held in English and one meeting was held in Spanish ... Table 7. Stakeholder comments received and actions taken.
- page: 54
- section: Stakeholder Consultations (VCS, 3.18; CCB, G3.4)
- spanId: maya-forest-corridor-redd-belize-extracted:p54:b2088:ecd1bf86
- source type: exact_section

## Current Quick Check output preserved for follow-up

### Failures captured in `corrections.json`

- methodology visible answer dump: the current extractor returns the methodology row plus modules and tools instead of the primary methodology only.
- additionality false positive: page 46 section 2.2.1 is related context, but it is not sufficient additionality evidence by itself.
- leakage false positive: page 82 cross-reference text is not leakage evidence.
- stakeholder under-answer: page 53 introduction alone omits the meeting dates, follow-up round, language split, and Table 7 actions.
