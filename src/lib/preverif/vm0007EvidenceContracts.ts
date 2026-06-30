import type {
  MethodologyEvidenceContract,
  MethodologyRuleLike,
} from "@/lib/preverif/evidenceAudit";

export type Vm0007EvidenceContract = MethodologyEvidenceContract;
export type Vm0007RuleLike = MethodologyRuleLike;

type ContractMatcher = {
  contract: Vm0007EvidenceContract;
  matches: (rule: NormalizedRule) => boolean;
};

type NormalizedRule = {
  rawId: string;
  shortId: string;
  title: string;
  summary: string;
  type: string;
  text: string;
};

function defineContract(input: Vm0007EvidenceContract): Vm0007EvidenceContract {
  return Object.freeze({
    ...input,
    appliesToRuleIds: input.appliesToRuleIds ? Object.freeze([...input.appliesToRuleIds]) : undefined,
    pddSectionsToSearch: Object.freeze([...input.pddSectionsToSearch]),
    strongEvidenceSignals: Object.freeze([...input.strongEvidenceSignals]),
    weakEvidenceSignals: Object.freeze([...input.weakEvidenceSignals]),
    rejectSignals: Object.freeze([...input.rejectSignals]),
    notApplicableSignals: Object.freeze([...input.notApplicableSignals]),
  });
}

function normalizeRule(rule: Vm0007RuleLike | string): NormalizedRule {
  const rawId = typeof rule === "string" ? rule : rule.id;
  const shortId = normalizeVm0007RuleId(rawId);
  const title = typeof rule === "string" ? "" : (rule.title ?? "").trim();
  const summary = typeof rule === "string" ? "" : (rule.summary ?? "").trim();
  const type = typeof rule === "string" ? "" : (rule.type ?? "").trim();
  const text = `${title} ${summary} ${type}`.trim().toLowerCase();

  return { rawId, shortId, title, summary, type, text };
}

export function normalizeVm0007RuleId(ruleId: string): string {
  const trimmed = ruleId.trim();
  if (/^R-\d-\d{4}$/i.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(/R-\d-\d{4}$/i);
  return match ? match[0].toUpperCase() : trimmed.toUpperCase();
}

const REDD_ELIGIBILITY_CONTRACT = defineContract({
  id: "family:redd-eligibility",
  label: "REDD eligibility",
  appliesToFamily: "General REDD applicability and exclusion rules",
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "S-1-1 General",
    "S-1-2 REDD",
    "Project activity description",
  ],
  strongEvidenceSignals: [
    "Project activity is described as REDD or avoided deforestation",
    "Eligibility conditions are tested against project facts rather than copied from the methodology",
    "Land-use history, deforestation agents, and exclusion checks are project-specific",
  ],
  weakEvidenceSignals: [
    "Narrative says the rule applies without showing project facts",
    "High-level eligibility table appears without supporting detail",
    "Methodology title page mentions REDD modules only",
  ],
  rejectSignals: [
    "Methodology boilerplate is repeated without project-specific evidence",
    "The project is primarily ARR or IFM with no REDD pathway explained",
    "Evidence comes only from glossary, appendix, or reference text",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show project-specific evidence for this REDD eligibility condition.",
  clientAction: "Add the project-specific eligibility analysis, the supporting land-use facts, and the document references used for this condition.",
  supportsNotApplicable: false,
});

const WRC_NA_CONTRACT = defineContract({
  id: "family:wrc-peatland-tidal-na",
  label: "WRC / peatland / tidal not-applicable rules",
  appliesToFamily: "Wetland restoration, peatland, tidal wetland, and related scope rules",
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "S-1-3 WRC",
    "S-2 Project Boundary",
    "Project activity description",
    "Stratification or soils appendices",
  ],
  strongEvidenceSignals: [
    "PDD states the project includes WRC, peatland, tidal wetland, or wetland rewetting activities",
    "Soil type, hydrology, or tidal influence is documented for the project area",
    "The activity scope is tied to mapped project strata or management units",
  ],
  weakEvidenceSignals: [
    "A table lists wetland modules without saying they are used in this project",
    "Peatland or tidal terms appear only in methodology citations",
    "A narrative mentions soils or water management without a project linkage",
  ],
  rejectSignals: [
    "Evidence is only a methodology applicability checklist with no project facts",
    "Project description shows upland REDD only and no wetland activity pathway",
    "Wetland terms appear only in references, tools, or copied module names",
  ],
  notApplicableSignals: [
    "Project is REDD-only or upland forest only",
    "This is a REDD/APD project",
    "PDD states no peat soils, no tidal influence, or no wetland restoration activity",
    "Project is not ARR",
    "Project is not IFM",
    "Soil carbon is excluded",
    "Modules tied to WRC, peatland, or tidal scope are not selected for the project",
  ],
  defaultGapMessage: "PDD does not yet show whether this wetland-specific rule applies to the project scope.",
  clientAction: "State whether the project includes WRC, peatland, or tidal wetland activities and cite the boundary, hydrology, and soil evidence supporting that scope decision.",
  supportsNotApplicable: true,
});

const PROJECT_BOUNDARY_CONTRACT = defineContract({
  id: "family:project-boundary",
  label: "Project boundary",
  appliesToFamily: "Geographic, temporal, reference-region, and boundary integrity rules",
  pddSectionsToSearch: [
    "S-2 Project Boundary",
    "S-2-1 Geographical Boundaries",
    "S-2-2 Temporal Boundaries",
    "Maps",
    "GIS appendices",
  ],
  strongEvidenceSignals: [
    "Boundary is mapped with coordinates, area, and inclusion or exclusion logic",
    "Reference region, proxy area, and overlap checks are described with project geography",
    "Crediting-period or historical-period dates are stated with project context",
  ],
  weakEvidenceSignals: [
    "Boundary is described narratively without coordinates or map references",
    "Temporal dates appear without saying what they govern",
    "Reference region is named but not justified",
  ],
  rejectSignals: [
    "Boundary text is only a methodology excerpt",
    "Maps are present but not tied to the project boundary decision",
    "Dates or areas conflict across the PDD",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the boundary evidence needed for this rule.",
  clientAction: "Add the mapped boundary, time-boundary details, and the project-specific justification for the geography or period used in this rule.",
  supportsNotApplicable: false,
});

const LEGAL_RIGHTS_CONTRACT = defineContract({
  id: "family:legal-rights-ownership",
  label: "Legal rights / ownership",
  appliesToFamily: "Rules that depend on legal rights, authorization, or land control",
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "Ownership or tenure sections",
    "Legal framework sections",
    "Annexed permits and concessions",
  ],
  strongEvidenceSignals: [
    "Land tenure, concession, or authorization documents are cited directly",
    "The party holding or lacking the right to convert or deforest is named clearly",
    "The legal claim is linked to the project area and dates",
  ],
  weakEvidenceSignals: [
    "Ownership is described generally with no named document",
    "A proponent statement claims rights without documentary support",
    "The legal basis is implied through project participation language only",
  ],
  rejectSignals: [
    "No source document or issuing authority is identified",
    "Rights described belong to a different area or timeframe",
    "The text conflicts on who controls conversion or land use",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the legal-rights evidence needed for this rule.",
  clientAction: "Add the controlling legal documents, the named rightsholders, and the citations tying those rights to the project area and timeframe.",
  supportsNotApplicable: false,
});

const BASELINE_SCENARIO_CONTRACT = defineContract({
  id: "family:baseline-scenario",
  label: "Baseline scenario",
  appliesToFamily: "Baseline scenario determination and reassessment rules",
  pddSectionsToSearch: [
    "S-3 Baseline Scenario",
    "S-3-1 Determination of the Most Plausible Baseline Scenario",
    "S-3-2 Re-assessing the Baseline Scenario",
    "Baseline appendices",
  ],
  strongEvidenceSignals: [
    "Alternatives are listed and screened using VT0001 steps",
    "Barrier or investment analysis leads to a named baseline scenario",
    "Baseline reassessment timing or trigger is stated explicitly",
  ],
  weakEvidenceSignals: [
    "Baseline is named without the decision path",
    "Alternatives are listed but not compared",
    "VT0001 is cited with little project-specific analysis",
  ],
  rejectSignals: [
    "The section repeats methodology steps without selecting a project baseline",
    "The baseline scenario conflicts with project activity or land-use facts",
    "No project alternatives or reassessment logic is shown",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the baseline scenario judgment needed for this rule.",
  clientAction: "Add the alternative scenarios considered, the VT0001 decision path used, and the citations supporting the selected baseline scenario.",
  supportsNotApplicable: false,
});

const ADDITIONALITY_CONTRACT = defineContract({
  id: "family:additionality",
  label: "Additionality",
  appliesToFamily: "Additionality determination rules",
  pddSectionsToSearch: [
    "S-4 Additionality",
    "S-4-1 Project Method",
    "S-4-2 Activity Method",
    "Barrier or investment analysis appendices",
  ],
  strongEvidenceSignals: [
    "PDD applies VT0001 or the tidal-wetland method to the project activity",
    "Barriers, investment constraints, or common-practice tests are documented with project facts",
    "The additionality conclusion is tied to named activities and evidence",
  ],
  weakEvidenceSignals: [
    "The section says the project is additional without the analysis steps",
    "Barriers are asserted at a high level with no support",
    "Method citation is present but project facts are thin",
  ],
  rejectSignals: [
    "Only methodology boilerplate is present",
    "The analysis does not connect to the actual project activity",
    "The section omits the decisive test or conclusion",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the additionality analysis needed for this rule.",
  clientAction: "Add the project-specific additionality analysis, the decisive tests used, and the citations supporting the conclusion.",
  supportsNotApplicable: false,
});

const LEAKAGE_CONTRACT = defineContract({
  id: "family:leakage",
  label: "Leakage",
  appliesToFamily: "Leakage restriction, identification, and quantification rules",
  pddSectionsToSearch: [
    "S-5-3 Leakage",
    "S-1 Applicability Conditions",
    "Leakage management sections",
    "Leakage appendices",
  ],
  strongEvidenceSignals: [
    "Leakage sources or restrictions are named for the project activity",
    "Leakage modules, prevention measures, or displacement pathways are described with project facts",
    "The PDD distinguishes activity-shifting, market, or WRC leakage components",
  ],
  weakEvidenceSignals: [
    "Leakage is mentioned generally without naming the project pathway",
    "Leakage controls are listed without saying where or how they operate",
    "A summary table appears without supporting narrative",
  ],
  rejectSignals: [
    "Leakage text is copied from methodology language only",
    "The project activity named in the PDD does not match the leakage pathway described",
    "No leakage components, restriction checks, or management logic are shown",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the leakage evidence needed for this rule.",
  clientAction: "Add the leakage pathway assessment, the restriction or management logic, and the citations tied to the project area and activity.",
  supportsNotApplicable: false,
});

const CARBON_POOLS_CONTRACT = defineContract({
  id: "family:carbon-pools-ghg-sources",
  label: "Carbon pools / GHG sources",
  appliesToFamily: "Carbon pool and GHG source selection rules",
  pddSectionsToSearch: [
    "S-2-3 Carbon Pools",
    "S-2-4 Sources of GHG Emissions",
    "S-5 Quantification",
    "Module-selection tables",
  ],
  strongEvidenceSignals: [
    "Included and excluded pools or sources are named with project-specific justification",
    "Baseline, project, and leakage treatment is kept consistent across the same pool or source",
    "The selected pools or sources match the activity type and modules used",
  ],
  weakEvidenceSignals: [
    "Pool names are listed without inclusion or exclusion reasoning",
    "A source list appears without significance testing or activity linkage",
    "Module names are present but the pool or source decision is unclear",
  ],
  rejectSignals: [
    "Pool or source treatment changes across sections with no explanation",
    "The PDD names modules but not the underlying pool or source decision",
    "Only methodology defaults are shown with no project-specific screening",
  ],
  notApplicableSignals: [
    "A pool or source is excluded because the project activity does not create that pathway",
    "The project scope excludes the wetland or tidal activity that would trigger the pool or source",
  ],
  defaultGapMessage: "PDD does not yet show the pool or GHG source selection evidence needed for this rule.",
  clientAction: "Add the include or exclude decision for each relevant pool or source, the reason for that decision, and the citations supporting it.",
  supportsNotApplicable: true,
});

const QUANTIFICATION_CONTRACT = defineContract({
  id: "family:quantification",
  label: "Quantification",
  appliesToFamily: "Equations, emission-reduction totals, and calculation inputs",
  pddSectionsToSearch: [
    "S-5 Quantification of Estimated GHG Emission Reductions and Removals",
    "S-5-1 Baseline Emissions",
    "S-5-2 Project Emissions",
    "S-5-4 Summary of GHG Emission Reduction and/or Removals",
  ],
  strongEvidenceSignals: [
    "The PDD shows the equation, variables, and project inputs used",
    "Calculation outputs are tied to named modules or tools",
    "Buffer, VCU, or net-emission totals are shown with project context",
  ],
  weakEvidenceSignals: [
    "Results are stated without showing the key inputs",
    "Equation text appears without project values",
    "Tables summarize totals with little narrative support",
  ],
  rejectSignals: [
    "Quantification language is only a methodology excerpt",
    "Project totals cannot be traced back to inputs or modules",
    "Key variables or assumptions are omitted",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the quantification evidence needed for this rule.",
  clientAction: "Add the calculation pathway, the key variables and assumptions, and the citations that let a reviewer trace the stated result.",
  supportsNotApplicable: false,
});

const MONITORING_CONTRACT = defineContract({
  id: "family:monitoring",
  label: "Monitoring",
  appliesToFamily: "Monitoring-plan design and implementation rules",
  pddSectionsToSearch: [
    "S-6 Monitoring",
    "S-6-1 Data and Parameters Available at Validation",
    "S-6-2 Data and Parameters Monitored",
    "S-6-3 Description of the Monitoring Plan",
  ],
  strongEvidenceSignals: [
    "Monitoring tasks, parameters, frequency, and responsibilities are described clearly",
    "QA or QC, archiving, SOPs, and data sources are stated for the project",
    "The monitoring plan explains how project, baseline, or leakage data will be collected",
  ],
  weakEvidenceSignals: [
    "Monitoring is described generally without task-by-task detail",
    "Parameters are listed but collection procedures are thin",
    "Responsibilities or QA steps are implied rather than stated",
  ],
  rejectSignals: [
    "The monitoring section is a methodology summary only",
    "Tasks or parameters are missing from the project monitoring plan",
    "The plan does not show who collects data or how records are kept",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the monitoring-plan evidence needed for this rule.",
  clientAction: "Add the monitoring tasks, data collection procedures, QA or QC controls, and responsibility assignments for the project.",
  supportsNotApplicable: false,
});

const UNCERTAINTY_CONTRACT = defineContract({
  id: "family:uncertainty",
  label: "Uncertainty",
  appliesToFamily: "Uncertainty adjustment and uncertainty-reduction rules",
  pddSectionsToSearch: [
    "S-5 Quantification of Estimated GHG Emission Reductions and Removals",
    "S-6 Monitoring",
    "Uncertainty appendices",
  ],
  strongEvidenceSignals: [
    "The uncertainty method, threshold, or deduction is stated clearly",
    "Sampling, measurement, or data-quality steps are tied to uncertainty reduction",
    "The PDD explains how uncertainty affects issuance or reported results",
  ],
  weakEvidenceSignals: [
    "Uncertainty is mentioned but the method is not explained",
    "Sampling detail appears without the uncertainty consequence",
    "A result table includes an adjustment with little narrative support",
  ],
  rejectSignals: [
    "No uncertainty method or reduction path is shown",
    "The stated adjustment cannot be traced to a calculation or protocol",
    "The monitoring plan omits the data-quality steps tied to uncertainty control",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the uncertainty evidence needed for this rule.",
  clientAction: "Add the uncertainty method, the reduction steps or deductions used, and the citations linking those choices to the project data.",
  supportsNotApplicable: false,
});

const MODULE_SELECTION_CONTRACT = defineContract({
  id: "family:module-selection",
  label: "Module selection",
  appliesToFamily: "Rules that require selecting and justifying the correct VM0007 modules or tools",
  pddSectionsToSearch: [
    "S-3 Baseline Scenario",
    "S-5 Quantification of Estimated GHG Emission Reductions and Removals",
    "Module-selection tables",
    "Application of methodology sections",
  ],
  strongEvidenceSignals: [
    "The PDD names the selected modules or tools and explains why each one applies",
    "Module choices line up with the project activity type, pools, and leakage pathways",
    "Cross-references between sections show consistent module use",
  ],
  weakEvidenceSignals: [
    "Modules are listed with little justification",
    "Tool names appear in tables but not in the narrative",
    "The activity type is clear but the module-selection rationale is thin",
  ],
  rejectSignals: [
    "Module names are copied from the methodology without project linkage",
    "Selected modules conflict with the described project activity",
    "The PDD omits why other relevant modules were not used",
  ],
  notApplicableSignals: [
    "A module is outside project scope because the triggering activity or pathway is absent",
  ],
  defaultGapMessage: "PDD does not yet show the module-selection rationale needed for this rule.",
  clientAction: "Add the selected modules or tools, the project-specific reason each one applies, and the citations supporting those choices.",
  supportsNotApplicable: true,
});

const FOREST_DEFINITION_CONTRACT = defineContract({
  id: "rule:R-1-0001",
  label: "R-1-0001 forest definition",
  appliesToRuleIds: ["R-1-0001"],
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "Forest definition sections",
    "Land-use history annexes",
  ],
  strongEvidenceSignals: [
    "Host-country or VCS forest definition thresholds are stated clearly",
    "The PDD shows the land qualified as forest for at least 10 years before project start",
    "Mangrove treatment is stated when mangroves are in scope",
  ],
  weakEvidenceSignals: [
    "Forest definition is named without numeric thresholds",
    "Land history is described generally with no time-bound support",
    "Forest qualification is asserted without area-specific evidence",
  ],
  rejectSignals: [
    "The PDD does not tie the forest definition to the project area",
    "The 10-year history is missing or conflicts with other land-use claims",
    "Mangrove handling is omitted where relevant",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the forest-definition thresholds and the 10-year land-history evidence for the project area.",
  clientAction: "Add the governing forest definition, the numeric thresholds, and the evidence showing the project land met that definition for the 10 years before project start.",
  supportsNotApplicable: false,
});

const BASELINE_DEFORESTATION_CATEGORY_CONTRACT = defineContract({
  id: "rule:R-1-0002",
  label: "R-1-0002 baseline deforestation category",
  appliesToRuleIds: ["R-1-0002"],
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "S-3 Baseline Scenario",
    "Land-use and legal context sections",
  ],
  strongEvidenceSignals: [
    "PDD names AUDef or APDef explicitly",
    "The chosen category is supported by legal-rights and deforestation-driver evidence",
    "The category aligns with the baseline modules selected later in the PDD",
  ],
  weakEvidenceSignals: [
    "The project describes deforestation pressure without naming AUDef or APDef",
    "Legal context is present but does not close the category decision",
    "Module references suggest a category but the narrative does not state it",
  ],
  rejectSignals: [
    "Category is ambiguous or changes across sections",
    "The named category conflicts with the legal-rights evidence",
    "The PDD cites AUDef or APDef only in copied methodology text",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show whether baseline deforestation is categorized as AUDef or APDef with supporting project evidence.",
  clientAction: "State the baseline deforestation category explicitly and add the legal-rights and driver evidence that supports that category choice.",
  supportsNotApplicable: false,
});

const APDEF_LEGAL_AUTHORIZATION_CONTRACT = defineContract({
  id: "rule:R-1-0004",
  label: "R-1-0004 APDef legal authorization",
  appliesToRuleIds: ["R-1-0004"],
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "Legal framework sections",
    "Permits and concession annexes",
  ],
  strongEvidenceSignals: [
    "Conversion authorization is documented by a named permit, concession, or official approval",
    "The authorization covers the project area and timeframe",
    "The PDD links APDef treatment to the named legal instrument",
  ],
  weakEvidenceSignals: [
    "The narrative says conversion is legal without citing the instrument",
    "A general land-use right is described but not the conversion authorization",
    "The document names an approval body without the document itself",
  ],
  rejectSignals: [
    "No legal instrument is identified",
    "The authorization does not match the area or dates used for APDef",
    "The PDD relies on unsupported assertions about legal conversion",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the legal authorization that supports APDef treatment for the project area.",
  clientAction: "Add the conversion authorization document, the issuing authority, the area and dates it covers, and the citation tying it to APDef.",
  supportsNotApplicable: false,
});

const NITROGEN_FERTILIZER_PROHIBITION_CONTRACT = defineContract({
  id: "rule:R-1-0007",
  label: "R-1-0007 nitrogen fertilizer prohibition",
  appliesToRuleIds: ["R-1-0007"],
  pddSectionsToSearch: [
    "S-1-3 WRC",
    "Project activity description",
    "Land management and input-use sections",
  ],
  strongEvidenceSignals: [
    "The PDD states nitrogen fertilizer is not used in the project area during the crediting period",
    "Management plans or input records support the no-fertilizer claim",
    "The statement is tied to the wetland activity area and timing",
  ],
  weakEvidenceSignals: [
    "The PDD says fertilizer use is limited but not prohibited",
    "Input management is mentioned without identifying nitrogen fertilizer",
    "A management narrative exists with no date or area linkage",
  ],
  rejectSignals: [
    "Any nitrogen fertilizer, manure, or similar input is allowed in the project area",
    "The no-fertilizer statement is missing the crediting-period scope",
    "Evidence comes only from methodology text",
  ],
  notApplicableSignals: [
    "Project does not include WRC or wetland activities that trigger this rule",
    "PDD states no rewetting or wetland restoration scope for the area in question",
  ],
  defaultGapMessage: "PDD does not yet show whether nitrogen fertilizer is prohibited for the relevant wetland project area during the crediting period.",
  clientAction: "State whether this wetland rule applies, and if it does, add the no-fertilizer commitment and the land-management evidence supporting it.",
  supportsNotApplicable: true,
});

const LEAKAGE_PREVENTION_RESTRICTIONS_CONTRACT = defineContract({
  id: "rule:R-1-0015",
  label: "R-1-0015 leakage prevention restrictions",
  appliesToRuleIds: ["R-1-0015"],
  pddSectionsToSearch: [
    "S-1 Applicability Conditions",
    "S-5-3 Leakage",
    "Livelihood or leakage management sections",
  ],
  strongEvidenceSignals: [
    "Leakage prevention activities are described and screened against the prohibited activity list",
    "Agricultural and livestock responses to project restrictions are discussed explicitly",
    "The PDD shows how leakage prevention avoids flooding farmland and feed-lot or manure-lagoon intensification",
  ],
  weakEvidenceSignals: [
    "Leakage prevention is described broadly without testing the prohibited activities",
    "Livelihood support measures are listed with no restriction screening",
    "Agriculture or livestock activities are mentioned but not evaluated against the rule",
  ],
  rejectSignals: [
    "The project relies on flooding farmland to raise production",
    "The project relies on feed-lots or manure lagoons to intensify livestock production",
    "The PDD does not screen the prohibited activities at all",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show that leakage prevention measures were screened against the prohibited activity list.",
  clientAction: "Add the leakage prevention measures used by the project and show explicitly that the prohibited agricultural and livestock responses are not part of that plan.",
  supportsNotApplicable: false,
});

const CARBON_POOL_SELECTION_CONTRACT = defineContract({
  id: "rule:R-2-0007",
  label: "R-2-0007 carbon pool selection",
  appliesToRuleIds: ["R-2-0007"],
  pddSectionsToSearch: [
    "S-2-3 Carbon Pools",
    "S-5 Quantification",
    "Module-selection tables",
  ],
  strongEvidenceSignals: [
    "Each carbon pool is marked included or excluded with a reason",
    "Pool treatment stays consistent across baseline, project, and leakage where required",
    "Selected pools match the activity type and the modules used",
  ],
  weakEvidenceSignals: [
    "Pool names are listed without reasons",
    "The section implies significance without the actual inclusion decision",
    "Baseline and project pool treatment can only be inferred",
  ],
  rejectSignals: [
    "A pool is included in baseline but not treated consistently elsewhere",
    "The inclusion or exclusion logic conflicts across sections",
    "The PDD does not say why a pool is included or excluded",
  ],
  notApplicableSignals: [
    "A pool is out of scope because the project activity does not create that carbon stock pathway",
  ],
  defaultGapMessage: "PDD does not yet show the include or exclude decision and justification for the carbon pools used in this project.",
  clientAction: "List each relevant carbon pool, state whether it is included or excluded, and add the project-specific reason and citation for that decision.",
  supportsNotApplicable: true,
});

const BASELINE_SCENARIO_DETERMINATION_CONTRACT = defineContract({
  id: "rule:R-3-0001",
  label: "R-3-0001 baseline scenario determination",
  appliesToRuleIds: ["R-3-0001"],
  pddSectionsToSearch: [
    "S-3 Baseline Scenario",
    "S-3-1 Determination of the Most Plausible Baseline Scenario",
    "Alternative-scenario appendices",
  ],
  strongEvidenceSignals: [
    "VT0001 is applied step by step to the project",
    "Alternative scenarios are listed and one most plausible baseline is selected",
    "The decisive barrier or investment findings are tied to project evidence",
  ],
  weakEvidenceSignals: [
    "VT0001 is cited but the alternatives are thin",
    "The baseline is named without the decision path",
    "Barrier or investment discussion exists without a clear selection outcome",
  ],
  rejectSignals: [
    "No alternative scenario list is shown",
    "The PDD omits the basis for selecting the most plausible baseline",
    "The section is mostly methodology boilerplate",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the VT0001 decision path used to determine the baseline scenario.",
  clientAction: "Add the alternative scenarios considered, the VT0001 steps applied, and the project evidence supporting the chosen baseline scenario.",
  supportsNotApplicable: false,
});

const ADDITIONALITY_REQUIREMENT_CONTRACT = defineContract({
  id: "rule:R-4-0001",
  label: "R-4-0001 additionality",
  appliesToRuleIds: ["R-4-0001"],
  pddSectionsToSearch: [
    "S-4 Additionality",
    "S-4-1 Project Method",
    "Barrier or investment analysis appendices",
  ],
  strongEvidenceSignals: [
    "VT0001 is applied to the project activity and reaches an additionality conclusion",
    "The decisive barrier, investment, or common-practice findings are documented",
    "The additionality case is tied to the actual project activity and scope",
  ],
  weakEvidenceSignals: [
    "The PDD says the project is additional without enough analysis detail",
    "Barrier or finance constraints are asserted broadly",
    "The conclusion exists but the supporting tests are thin",
  ],
  rejectSignals: [
    "The additionality section is mostly copied methodology language",
    "The analysis does not correspond to the project activity in scope",
    "The decisive test or conclusion is missing",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the VT0001-based additionality case for the project.",
  clientAction: "Add the project-specific additionality tests, the decisive findings, and the citations supporting the additionality conclusion.",
  supportsNotApplicable: false,
});

const REDD_LEAKAGE_COMPONENTS_CONTRACT = defineContract({
  id: "rule:R-5-0003",
  label: "R-5-0003 REDD leakage components",
  appliesToRuleIds: ["R-5-0003"],
  pddSectionsToSearch: [
    "S-5-3 Leakage",
    "S-5 Quantification",
    "Leakage module appendices",
  ],
  strongEvidenceSignals: [
    "The PDD distinguishes the required REDD leakage components",
    "Activity-shifting and market leakage pathways are tied to the project design",
    "The selected leakage modules are named and justified",
  ],
  weakEvidenceSignals: [
    "Leakage is discussed generally without separating components",
    "Modules are named with little explanation",
    "A table lists leakage items but the narrative is thin",
  ],
  rejectSignals: [
    "Required leakage components are omitted",
    "The chosen leakage modules do not match the project pathway",
    "The section is only a methodology summary",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show how the required REDD leakage components were identified and handled for this project.",
  clientAction: "Add the project-specific leakage pathways, the modules used for each one, and the citations that support those component choices.",
  supportsNotApplicable: false,
});

const MONITORING_PLAN_FOUR_TASKS_CONTRACT = defineContract({
  id: "rule:R-6-0001",
  label: "R-6-0001 monitoring plan four tasks",
  appliesToRuleIds: ["R-6-0001"],
  pddSectionsToSearch: [
    "S-6 Monitoring",
    "S-6-3 Description of the Monitoring Plan",
    "Monitoring SOP appendices",
  ],
  strongEvidenceSignals: [
    "The monitoring plan presents all four required tasks",
    "Each task includes procedures, data needs, responsibilities, and recordkeeping",
    "The tasks are tied to project, baseline, or leakage monitoring needs",
  ],
  weakEvidenceSignals: [
    "Some tasks are implied but not enumerated clearly",
    "The plan lists tasks without the operating detail",
    "Task responsibilities or procedures are only partly described",
  ],
  rejectSignals: [
    "One or more of the four tasks is missing",
    "The monitoring plan omits how tasks will be executed",
    "The section is only a high-level methodology summary",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show all four required monitoring-plan tasks with project-specific detail.",
  clientAction: "Enumerate the four monitoring tasks and add the procedures, data, responsibilities, and recordkeeping details for each one.",
  supportsNotApplicable: false,
});

const MONITORING_PLAN_CONTENT_CONTRACT = defineContract({
  id: "rule:R-6-0002",
  label: "R-6-0002 monitoring plan content requirements",
  appliesToRuleIds: ["R-6-0002"],
  pddSectionsToSearch: [
    "S-6 Monitoring",
    "S-6-1 Data and Parameters Available at Validation",
    "S-6-2 Data and Parameters Monitored",
    "S-6-3 Description of the Monitoring Plan",
  ],
  strongEvidenceSignals: [
    "For each task, the plan states the data, methods, frequency, QA or QC, archiving, and responsibilities",
    "Parameters available at validation and parameters monitored are both covered",
    "The content elements are written for the actual project workflow",
  ],
  weakEvidenceSignals: [
    "The plan includes the right headings but limited substance under them",
    "Some content elements are present while others are only implied",
    "Parameters are listed without collection or QA detail",
  ],
  rejectSignals: [
    "Required monitoring-plan content elements are missing",
    "The plan does not show how data will be collected and retained",
    "Responsibilities or QA or QC controls are absent",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show the full monitoring-plan content required for each task.",
  clientAction: "For each monitoring task, add the required data, methods, frequency, QA or QC, archiving, and responsibility details.",
  supportsNotApplicable: false,
});

export const VM0007_EVIDENCE_CONTRACTS = Object.freeze([
  FOREST_DEFINITION_CONTRACT,
  BASELINE_DEFORESTATION_CATEGORY_CONTRACT,
  APDEF_LEGAL_AUTHORIZATION_CONTRACT,
  NITROGEN_FERTILIZER_PROHIBITION_CONTRACT,
  LEAKAGE_PREVENTION_RESTRICTIONS_CONTRACT,
  CARBON_POOL_SELECTION_CONTRACT,
  BASELINE_SCENARIO_DETERMINATION_CONTRACT,
  ADDITIONALITY_REQUIREMENT_CONTRACT,
  REDD_LEAKAGE_COMPONENTS_CONTRACT,
  MONITORING_PLAN_FOUR_TASKS_CONTRACT,
  MONITORING_PLAN_CONTENT_CONTRACT,
  REDD_ELIGIBILITY_CONTRACT,
  WRC_NA_CONTRACT,
  PROJECT_BOUNDARY_CONTRACT,
  LEGAL_RIGHTS_CONTRACT,
  BASELINE_SCENARIO_CONTRACT,
  ADDITIONALITY_CONTRACT,
  LEAKAGE_CONTRACT,
  CARBON_POOLS_CONTRACT,
  QUANTIFICATION_CONTRACT,
  MONITORING_CONTRACT,
  UNCERTAINTY_CONTRACT,
  MODULE_SELECTION_CONTRACT,
]);

export const VM0007_FALLBACK_EVIDENCE_CONTRACT = defineContract({
  id: "fallback:vm0007",
  label: "VM0007 fallback",
  appliesToFamily: "Future or uncategorized VM0007 rules",
  pddSectionsToSearch: [
    "Nearest matching methodology section",
    "Project-specific annexes",
  ],
  strongEvidenceSignals: [
    "Project-specific evidence directly addresses the rule logic",
  ],
  weakEvidenceSignals: [
    "The rule topic is mentioned but not tied to the project evidence",
  ],
  rejectSignals: [
    "Only copied methodology text is present",
  ],
  notApplicableSignals: [],
  defaultGapMessage: "PDD does not yet show project-specific evidence for this VM0007 rule.",
  clientAction: "Add the project-specific evidence, cite where it appears in the PDD, and explain how it addresses the rule logic.",
  supportsNotApplicable: false,
});

const SPECIFIC_RULE_IDS = new Set(
  VM0007_EVIDENCE_CONTRACTS.flatMap((contract) => contract.appliesToRuleIds ?? []),
);

const WRC_FAMILY_RULE_IDS = new Set([
  "R-1-0005",
  "R-1-0006",
  "R-1-0007",
  "R-1-0008",
  "R-1-0009",
  "R-1-0010",
  "R-1-0011",
  "R-1-0012",
  "R-2-0009",
  "R-5-0002",
  "R-6-0006",
]);

function hasAnyToken(rule: NormalizedRule, tokens: readonly string[]): boolean {
  return tokens.some((token) => rule.text.includes(token));
}

const CONTRACT_MATCHERS: readonly ContractMatcher[] = [
  ...VM0007_EVIDENCE_CONTRACTS
    .filter((contract) => (contract.appliesToRuleIds?.length ?? 0) > 0)
    .map((contract) => ({
      contract,
      matches: (rule: NormalizedRule) => (contract.appliesToRuleIds ?? []).includes(rule.shortId),
    })),
  {
    contract: WRC_NA_CONTRACT,
    matches: (rule) =>
      WRC_FAMILY_RULE_IDS.has(rule.shortId)
      || hasAnyToken(rule, [" wrc", "wrc ", "peatland", "tidal", "rwe "]),
  },
  {
    contract: MODULE_SELECTION_CONTRACT,
    matches: (rule) => ["R-3-0005", "R-3-0006", "R-5-0008", "R-5-0009"].includes(rule.shortId),
  },
  {
    contract: UNCERTAINTY_CONTRACT,
    matches: (rule) => ["R-5-0006", "R-6-0008"].includes(rule.shortId),
  },
  {
    contract: MONITORING_CONTRACT,
    matches: (rule) => /^R-6-\d{4}$/.test(rule.shortId),
  },
  {
    contract: ADDITIONALITY_CONTRACT,
    matches: (rule) => /^R-4-\d{4}$/.test(rule.shortId),
  },
  {
    contract: BASELINE_SCENARIO_CONTRACT,
    matches: (rule) => /^R-3-\d{4}$/.test(rule.shortId),
  },
  {
    contract: LEAKAGE_CONTRACT,
    matches: (rule) => ["R-5-0004"].includes(rule.shortId),
  },
  {
    contract: CARBON_POOLS_CONTRACT,
    matches: (rule) => /^R-2-00(07|08|09|10|11|12)$/.test(rule.shortId),
  },
  {
    contract: QUANTIFICATION_CONTRACT,
    matches: (rule) => ["R-5-0001", "R-5-0002", "R-5-0005", "R-5-0007"].includes(rule.shortId),
  },
  {
    contract: PROJECT_BOUNDARY_CONTRACT,
    matches: (rule) => /^R-2-\d{4}$/.test(rule.shortId),
  },
  {
    contract: LEGAL_RIGHTS_CONTRACT,
    matches: (rule) =>
      ["R-1-0003"].includes(rule.shortId)
      || (!SPECIFIC_RULE_IDS.has(rule.shortId) && hasAnyToken(rule, ["legal", "ownership", "right"])),
  },
  {
    contract: REDD_ELIGIBILITY_CONTRACT,
    matches: (rule) => /^R-1-\d{4}$/.test(rule.shortId),
  },
];

export function getVm0007EvidenceContract(rule: Vm0007RuleLike | string): Vm0007EvidenceContract {
  const normalized = normalizeRule(rule);
  if (typeof rule === "string" && WRC_FAMILY_RULE_IDS.has(normalized.shortId)) {
    return WRC_NA_CONTRACT;
  }
  for (const matcher of CONTRACT_MATCHERS) {
    if (matcher.matches(normalized)) return matcher.contract;
  }
  return VM0007_FALLBACK_EVIDENCE_CONTRACT;
}

export function getVm0007EvidenceContracts(): readonly Vm0007EvidenceContract[] {
  return VM0007_EVIDENCE_CONTRACTS;
}
