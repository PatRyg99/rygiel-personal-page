# Publication import notes

Last checked: 28 October 2026.

The site contains the 20 distinct research outputs listed in the supplied CV's scientific-output sections, plus the MSc thesis listed under education and publicly deposited on arXiv. Patent application families are kept separately in `_data/patents.yml`. A preprint and its later journal or proceedings version are one record with multiple resource links.

Each publication's `sources` and resource links record its evidence. DOI metadata was fetched directly from Crossref for the eleven Springer/Elsevier works and the consortium paper. ArXiv, PMLR/DMLR, MICCAI, the publisher's book contents, and Zenodo supplied other metadata. Descriptions are original summaries rather than copied abstracts.

## Attribution details

- **Core Outcome Set:** [PubMed](https://pubmed.ncbi.nlm.nih.gov/41921910/) separates 13 named primary authors from the VASCUL-AID and Expert Consensus Meeting collaborators. Patryk belongs to the collaborator list. The record preserves `authors`, `collaborators`, `corporate_authors`, and `contribution_note` separately. Crossref flattens the collaborators into its author array; that flattened representation was not adopted for the citation. Full collaborator names are retained as indexed, without guessing expansions of initials.
- **Coronary Ostia:** Miłosz Gajowczyk and Patryk Rygiel are equal contributors, as recorded in the supplied CV and [Twente bibliography](https://people.utwente.nl/p.t.rygiel).
- **TopoBench:** the full 37-author list comes from the [publisher](https://data.mlr.press/volumes/02.html). Lev Telyatnikov and Guillermo Bernárdez share first authorship according to the paper.
- **ICML challenge report:** all 73 authors are retained from [arXiv](https://arxiv.org/abs/2409.05211). The record identifies the GRaM workshop context and the report type, avoiding a claim of an independently verified archival proceedings DOI.
- **Mesh benchmark:** the journal's Crossref metadata spells Riccardo's surname “Maranga”; the preprint and CV use “Maragna.” The site's journal citation follows the journal metadata. This spelling warrants an author check if the publisher record is corrected.
- **Patent inventor:** the [WO2023166330A1 record](https://patents.google.com/patent/WO2023166330A1/en) spells the final inventor “Bartłomiej CIUPAŁ”; the CV uses “B Cupiał.” The site follows the indexed patent spelling. Patent entries identify application publications, without asserting that a family is pending or granted in any jurisdiction.

## Titles, dates, and versions

- **AB-GATr:** [arXiv v2](https://arxiv.org/abs/2605.18816) changed the title to “When Does Equivariance Help? Canonical Alignment in Neural Fluid Surrogates” on 28 September 2026. The original title is stored in `previous_titles`. It remains a preprint in the checked record.
- **Hemo-NF:** the [official MICCAI page](https://papers.miccai.org/miccai-2026-sat/Off_Grid_026.html) provides a camera-ready paper. The DOI, publication month, and page fields remain pending there; those details were not invented.
- **GReAT:** first online 5 October 2025; printed proceedings year 2026. The site uses publication year 2026, conference year 2025, and preserves the online date.
- **Beyond Pixels / Active Learning:** MLMI/STACOM 2025, proceedings publication 2026.
- **Vessel Segmentation / Neural Motion:** STACOM 2024, proceedings publication 2025.
- **Sjögren study:** online 29 December 2025; *Neuroinformatics* volume 24, article 3 is a 2026 citation.
- **Core Outcome Set:** first online 31 March 2026; volume 129, pages 275–289, August 2026.
- **MSc thesis:** completed 2023, arXiv deposit 2024. The thesis is not merged with the related CenterlinePointNet++ paper.
- **AAA-100:** `10.5281/zenodo.10932957` is release 0.1.0; `10.5281/zenodo.10932956` is the concept DOI. The bibliography cites the concrete release.

`date_precision: year` marks records where January 1 is used only as a sorting value; it is not a claim about the actual publication day. The public UI should display `publication_year`, with conference and first-online dates only when useful.

## Coverage limits

The inventory was reconciled with every entry in the CV and the accessible primary records. Google Scholar blocked automated access and ORCID's works page was not available in the text browser during the initial research. Do not claim a live synchronized bibliography or a globally exhaustive citation count. New accepted work can be added through a Markdown record without changing the template.
