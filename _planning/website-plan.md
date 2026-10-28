# Patryk Rygiel — personal website plan

Drafted 28 October 2026 from the supplied CV, the local Academic Pages template, and public research and community sources. Implemented locally on the same date; the website has not been deployed. The proposal below is retained as the design record.

**Implementation completed:** the site now contains 21 scholarly-output pages, two separate patent application families, the expanded AB-GATr showcase, the supplied CV as a direct PDF download, and talks/community activities. The Manchester visit is supported by the official [CIMIM people page](https://cimim.org/people/); Patryk confirmed that the visit is ongoing, and the biography now reflects this. See `assets-and-manchester.md` for the source/date reconciliation.

**Validation:** the production Jekyll build and publication/link/metadata checks pass. Browser checks cover five routes at desktop, tablet, and mobile widths, publication filters and earlier-title search, citation copying, persistent theme selection, and the complete archive with JavaScript disabled. The CV download was verified to be byte-identical to the supplied PDF. All 21 publication pages have verified, attributed research visuals. `_config.yml` targets the repository's GitHub Pages project path; deployment and domain settings have not been changed. Editing and validation commands are documented in `README.md`.

**Subsequent refinements:** the user requested a direct download of the original CV instead of a CV tab/page, removed the monogram and name punctuation, confirmed the Manchester visit is ongoing, selected AB-GATr Figure 1 for the homepage, and requested paper figures and grouped activity dates. These requests supersede the original proposal below.

**Confirmed priority:** AB-GATr / “Symmetry in the Wild” is the main research showcase. All publications should be discoverable, and publication pages should support additional material over time.

## 1. Direction

Keep the existing Jekyll/Academic Pages foundation and develop a clear academic website around **AI for science and health**, with geometric deep learning, neural surrogates, and cardiovascular applications as its research focus. This positioning follows the supplied CV and accommodates both medical and engineering applications.

The main visitor journeys are:

1. Understand Patryk's research and current position within a few seconds.
2. Open the AB-GATr project and find its paper, code, explanation, and results.
3. Find any publication and retrieve its authoritative citation or open-access version.
4. Review experience, collaborations, talks, and community work, then find contact information.

Use an English-language site initially. Prefer a restrained visual style: off-white background, dark navy text, a muted teal accent, generous spacing, and readable typography. Use actual research figures and an existing professional portrait. Keep the template's light/dark theme capability, with consistent contrast in both modes.

## 2. What the template already provides

The checkout is an uncustomized Academic Pages site. It already includes a publication collection with page output enabled, Markdown content, responsive navigation, author profiles, CV layouts, theme styling, and sitemap support.

Relevant starting points:

- `_config.yml`: identity, affiliations, profile links, URL, collection defaults, and publication categories.
- `_data/navigation.yml`: currently links to generic teaching, portfolio, blog, and guide pages.
- `_pages/about.md`: currently the template's introductory documentation.
- `_pages/publications.html`: publication archive generated from `_publications`.
- `_publications/*.md`: sample papers, including conflicting sample permalinks.
- `_includes/archive-single.html` and `_layouts/single.html`: existing publication presentation, with repeated resource-link conditionals and generic “Published in” wording.
- `_data/cv.json`, `_pages/cv.md`, and `_pages/cv-json.md`: competing example CV formats; choose one maintained source.
- `assets/css/main.scss` and `_sass/`: existing visual system.

Build on these capabilities. A framework migration, database, or CMS is unnecessary for the requested content. Retain a static deployment compatible with the template's existing GitHub Pages approach; the actual domain and hosting configuration can be set during implementation.

## 3. Information architecture

| Page | Purpose and initial content |
| --- | --- |
| `/` — Home | Portrait, short research introduction, primary affiliation, contact/profile links, AB-GATr showcase, three additional selected papers, recent updates, and a short community section. |
| `/publications/` — Publications | Complete bibliography, newest first, grouped by year, with filters for output type and research topic. Include dedicated sections for datasets, theses, and patent applications. |
| `/publications/abgatr/` | Main project page with an expanded research narrative and room for future figures, experiments, slides, and demonstrations. |
| `/publications/<stable-slug>/` | A permanent page for every other scholarly output, initially containing citation metadata, a concise summary, and available resource links. |
| `/talks/` — Talks & Community | Talks, tutorials, posters, event organization, and research service, clearly labeled by activity. |
| `/cv/` — CV | Education, appointments, industry experience, grants, awards, service, supervision, and a downloadable public CV. Link to the full bibliography rather than duplicating its metadata manually. |

Main navigation: **Home · Publications · Talks & Community · CV**. Contact and research-profile links stay readily accessible in the profile area and footer.

Keep a compact author profile on the home and archive pages. Give research project pages a wider content area for figures. Hide empty optional sections; additional content should never require publishing “coming soon” blocks.

## 4. Homepage content

Proposed opening copy, synthesized from the supplied CV:

> I am a PhD candidate at the University of Twente working on geometric deep learning for science and health. I develop neural surrogates for complex physical simulations, with a focus on cardiovascular blood flow, generalization, and learning from limited data.

Follow with a short paragraph about the VASCUL-AID project and collaborations. Keep the main affiliation prominent; put visiting and guest roles in the biography and CV rather than making the opening line an institution list.

Recommended sequence:

1. Name, role, introduction, portrait, email, CV, Google Scholar, GitHub, LinkedIn, and ORCID.
2. AB-GATr: one substantial image, a short explanation of the research question, and links to the project, paper, and code.
3. Research themes: geometric learning and equivariance; efficient neural physics surrogates; cardiovascular imaging and modeling. Link each theme to relevant work.
4. Selected publications: active learning, vessel segmentation, and CenterlinePointNet++ as the initial supporting selection. The full bibliography remains one click away.
5. Three to five dated updates drawn from verified papers, appointments, awards, or events.
6. Community involvement and a direct contact link.

Keep selection separate from completeness: featuring a paper changes its homepage prominence, never whether it appears in the full bibliography.

## 5. AB-GATr project page

Use `/publications/abgatr/` as a stable URL independent of paper-title changes.

The latest arXiv record is titled **“When Does Equivariance Help? Canonical Alignment in Neural Fluid Surrogates”**, revised 28 September 2026. Preserve **“Symmetry in the Wild: The Role of Equivariance in Neural Fluid Surrogates”** as the earlier title in the page's version note and search metadata. Treat both as one work. The current public record is a preprint. [Latest paper](https://arxiv.org/abs/2605.18816)

Initial page structure:

1. Current title, AB-GATr name, full author list, year/status, and buttons for paper, code, and citation.
2. A short explanation of the question: when do symmetry constraints improve neural fluid surrogates?
3. An existing figure illustrating the geometry, predicted fields, or architecture, with a useful caption.
4. Method overview: explain the architecture and its surface/volume predictions in approachable language.
5. Results from the current paper version, with clearly labeled benchmarks and evidence for any numerical claims.
6. Limitations and interpretation, including how orientation distributions affect the findings.
7. Reproducibility resources: [official repository](https://github.com/PatRyg99/abgatr), available data links, and the relevant paper version.
8. BibTeX, related papers, and a short update history.

Support optional Markdown sections for extra experiments, videos, posters, presentations, and interactive demonstrations. Start with a complete static project page. Add a rotatable geometry or comparison viewer later only if suitable distributable assets are available and it adds explanatory value.

Use the current paper for the scientific narrative; the repository description and institutional profiles still carry the previous title. Do not combine claims from different manuscript versions without identifying them.

## 6. Publication inventory

The working inventory contains **21 distinct scholarly/research outputs**: the 20 entries in the CV's scientific-output sections plus the publicly available MSc thesis. There are also **two patent application families** in the CV. These counts are an implementation baseline, not an assertion that every external database is complete.

All titles below are present in the supplied CV, including the thesis title under education, except that the AB-GATr display title has been updated from the latest arXiv record. Links identify corroborating records or publication metadata. Preserve full author lists when importing; this table is a content inventory rather than a finished citation export.

| # | Work | Type and dating | Source / import note |
| --- | --- | --- | --- |
| 1 | When Does Equivariance Help? Canonical Alignment in Neural Fluid Surrogates — AB-GATr; previously “Symmetry in the Wild” | Preprint, 2026 | [arXiv](https://arxiv.org/abs/2605.18816). Main showcase; preserve title history. |
| 2 | Hemodynamic Neural Field: Continuous Blood Flow Estimation in Vessel Geometries via Global Shape Conditioning | Off-Grid at MICCAI 2026 | [MICCAI open-access record](https://papers.miccai.org/miccai-2026-sat/Off_Grid_026.html). Camera-ready paper is available; DOI, pages, and final publication month are still absent from this record. |
| 3 | A Core Outcome Set for Intact Abdominal Aortic Aneurysms Under Surveillance | Annals of Vascular Surgery, 2026 | [CORDIS project results](https://cordis.europa.eu/project/id/101080947/results). DOI `10.1016/j.avsg.2026.03.013`; preserve consortium/collaborator attribution. |
| 4 | Geometric deep learning for local growth prediction on abdominal aortic aneurysm surfaces | Artificial Intelligence in Medicine, volume year 2026 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1016/j.artmed.2025.103323`; link the preprint as another version. |
| 5 | Application of Fully Convolutional Neural Networks in the Assessment of Cerebral White Matter Involvement in Primary Sjögren’s Syndrome | Neuroinformatics, volume year 2026; online December 2025 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/s12021-025-09762-1`; preserve both relevant dates. |
| 6 | GReAT: Leveraging Geometric Artery Data to Improve Wall Shear Stress Assessment | ShapeMI 2025; proceedings 2026 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/978-3-032-06774-6_21`. |
| 7 | Beyond Pixels: Medical Image Quality Assessment with Implicit Neural Representations | MLMI 2025; proceedings 2026 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/978-3-032-09513-8_35`. |
| 8 | Active Learning for Deep Learning-Based Hemodynamic Parameter Estimation | STACOM 2025; proceedings 2026 | [Publisher metadata](https://crossmark.crossref.org/dialog/?doi=10.1007%2F978-3-032-17734-6_11), [preprint](https://arxiv.org/abs/2503.03453). One record with both links. |
| 9 | TopoBench: A Framework for Benchmarking Topological Deep Learning | Journal of Data-centric Machine Learning Research, 2025 | [Publisher volume](https://data.mlr.press/volumes/02.html). Volume 2, article 20, pages 1–39. |
| 10 | Learning Hemodynamic Scalar Fields on Coronary Artery Meshes: A Benchmark of Geometric Deep Learning Models | Computers in Biology and Medicine, 2025 | [Amsterdam UMC record](https://pure.amsterdamumc.nl/en/publications/learning-hemodynamic-scalar-fields-on-coronary-artery-meshes-a-be/). DOI `10.1016/j.compbiomed.2025.110477`; upgrade the CV's arXiv-only citation. |
| 11 | Deep vectorised operators for pulsatile hemodynamics estimation in coronary arteries from a steady-state prior | Computer Methods and Programs in Biomedicine, 2025 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1016/j.cmpb.2025.108958`; retain the 2024 preprint as a related version. |
| 12 | Wall Shear Stress Estimation in Abdominal Aortic Aneurysms: Towards Generalisable Neural Surrogate Models | Preprint, 2025 | [arXiv](https://arxiv.org/abs/2507.22817). |
| 13 | Global Control for Local SO(3)-Equivariant Scale-Invariant Vessel Segmentation | STACOM 2024; proceedings 2025 | [Amsterdam UMC record](https://pure.amsterdamumc.nl/en/publications/global-control-for-local-so3-equivariant-scale-invariant-vessel-s/). DOI `10.1007/978-3-031-87756-8_27`; link AAA-100 and the associated code. |
| 14 | Neural Fields for Continuous Periodic Motion Estimation in 4D Cardiovascular Imaging | STACOM 2024; proceedings 2025 | [University record](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/978-3-031-87756-8_37`. |
| 15 | ICML Topological Deep Learning Challenge 2024: Beyond the Graph Domain | Challenge report, 2024 | [arXiv](https://arxiv.org/abs/2409.05211). Preserve workshop context; verify formal proceedings metadata before assigning a published venue. |
| 16 | The challenge of artificial intelligence — Enhancing clinical decision making in AAA diagnosis and treatment with AI: how can it help with prediction of AAA growth, endoleaks and spinal cord ischemia | Book chapter, 2024 | [Publisher contents](https://www.minervamedica.it/it/volumi/specialita-mediche/chirurgia-vascolare/scheda.php?cod=L10349), in *Technological leaps in vascular surgery*. Use the publisher's chapter/section distinction when finalizing the citation. |
| 17 | AAA-100: A Curated Dataset of 3D Watertight Abdominal Aortic Aneurysm Models | Dataset, 2024 | [Zenodo release 0.1.0](https://zenodo.org/records/10932957). Keep version DOI `10.5281/zenodo.10932957` distinct from concept DOI `10.5281/zenodo.10932956`. |
| 18 | Estimation of FFR in coronary arteries with deep learning | MSc thesis, 2023; public arXiv deposit 2024 | [arXiv](https://arxiv.org/abs/2405.12224), explicitly labeled “Master thesis.” Related to CenterlinePointNet++, but a separate output. |
| 19 | CenterlinePointNet++: A New Point Cloud Based Architecture for Coronary Artery Pressure Drop and vFFR Estimation | MICCAI 2023 | [Institutional bibliography](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/978-3-031-43990-2_73`. |
| 20 | Eigenvector Grouping for Point Cloud Vessel Labeling | GeoMedIA / PMLR, 2022 | [Publisher record](https://proceedings.mlr.press/v194/rygiel22a.html). |
| 21 | Coronary Ostia Localization Using Residual U-Net with Heatmap Matching and 3D DSNT | MLMI 2022 | [Institutional bibliography](https://people.utwente.nl/p.t.rygiel). DOI `10.1007/978-3-031-21014-3_33`; preserve equal contribution with Miłosz Gajowczyk. |

Patent application families, from the CV:

- `WO2024184690A1` — training a neural network for estimation of hemodynamic parameters, including related estimation methods, programs, and systems.
- `WO2023166330A1` — detection of a landmark in a volume of medical images.

Display these in a distinct patent section with inventors, publication identifiers, dates, and verified registry links. Do not infer granted status from an application publication. Associate national filings with the same family rather than counting each as a separate invention.

### Bibliography behavior

- Include every inventory item in the appropriate section. All papers get a permanent detail page.
- Order by publication year, with an explicit conference-year label where different; retain first-online and preprint dates as metadata.
- Use one record per work; attach DOI, arXiv, accepted manuscript, code, data, slides, poster, and video as resources.
- Highlight Patryk's name and retain equal-contribution and consortium attribution.
- Offer full author lists, BibTeX copy/download, and a complete bibliography download.
- Add modest client-side text/type/topic filtering; the full archive and all links remain usable without JavaScript.
- Show only resource buttons that resolve to actual material.

## 7. Biography, talks, and community evidence

Use the supplied CV as the primary source for personal chronology. Use official event and publication records to corroborate and update individual items.

| Content | Evidence and intended treatment |
| --- | --- |
| University of Twente PhD, since November 2023; VASCUL-AID | CV; [university profile](https://people.utwente.nl/p.t.rygiel) and [project page](https://www.utwente.nl/en/eemcs/mia/research/projects/projectpage-rygiel/). Main affiliation. |
| Amsterdam UMC guest researcher, since June 2024 | CV; [GHOST Day 2025 biography](https://ghostday.pl/25-edition-speakers/) and [LOGML committee](https://www.logml.ai/people.html). |
| Manchester visiting PhD, since May 2026; TU Delft guest researcher, since September 2026 | Supplied CV. Include as CV-sourced roles; this research pass did not establish independent institutional pages for these appointments. |
| MSc AI and BSc Algorithmic Computer Science at Wrocław University of Science and Technology | CV; [public LinkedIn profile](https://nl.linkedin.com/in/patryk-rygiel-7b93811b9). Use CV dates and degree wording. |
| Hemolens/LifeFlow, NVIDIA DALI visiting student, Asseco | CV. Keep NVIDIA's actual visiting-student role and dates; avoid implying a different employment title. |
| LOGML | [Official organizing committee](https://www.logml.ai/people.html) confirms 2026 organization; CV and public LinkedIn post distinguish attendance in 2025. |
| ML in PL | [2026 conference](https://conference.mlinpl.org/2026/) confirms Call for Contributions coordinator; [2025 conference](https://conference2025.mlinpl.org/) lists the CfC/tutorials team. Earlier service is documented in the CV. |
| ML in PL 2026 tutorial | [Program](https://conference.mlinpl.org/2026/program): tutorial with Julian Suk, “Introduction to Physics Neural Surrogates for Engineering and Healthcare.” |
| GHOST Day talks | [2023 speaker record](https://ghostday.pl/23-edition-speakers/) and [2025 speaker record](https://ghostday.pl/25-edition-speakers/). Treat old biographies as historical snapshots. |
| MISP² | CV: general chair in 2025 and best-talk award in 2026; the 2025 role is also in the GHOST Day biography. |
| Grants, awards, supervision, reviewing, SOLVRO, robotics volunteering | CV. Put detailed records on the CV page and selected highlights on the homepage/community page. |

Also import relevant research talks/posters from official programs: ML in PL 2021 and 2022, the 2023 CenterlinePointNet++ presentation, and conference presentations associated with the papers. A poster or tutorial is an activity, not automatically an additional peer-reviewed publication.

Known profile links:

- [University of Twente](https://people.utwente.nl/p.t.rygiel)
- [Google Scholar](https://scholar.google.nl/citations?user=9OizHmQAAAAJ)
- [GitHub](https://github.com/PatRyg99)
- [LinkedIn](https://www.linkedin.com/in/patryk-rygiel-7b93811b9/)
- [ORCID](https://orcid.org/0009-0003-8539-5581)

Use the public university email for the contact link. Prepare a public-facing CV download from the supplied document, retaining academic detail while omitting the recruitment consent paragraph and personal telephone number from the public version.

## 8. Source discrepancies and remaining verification

1. **AB-GATr title:** the CV, GitHub description, and institutional indexes use the earlier title; arXiv v2 supplies the current title. Keep a single record with an alias.
2. **Publication years:** STACOM, ShapeMI, and MLMI conference years differ from proceedings publication years. Keep both rather than forcing them into a single ambiguous date.
3. **Published journal versions:** several CV entries still link only to arXiv despite available journal DOIs. Prefer the journal citation and retain the preprint link.
4. **MICCAI STAR Award:** the CV says the 2023 award was declined for personal reasons. Preserve that qualification if listing it; older speaker biographies omit it.
5. **ICML challenge award:** a GHOST Day biography describes a challenge win, but the supplied CV does not list it among awards. Verify the precise category/team attribution before featuring an award badge.
6. **LinkedIn:** public search results and posts were accessible, but the main profile fetch was incomplete. The public extract contains a language entry inconsistent with the CV; use the supplied CV's language information.
7. **Bibliographic coverage:** Google Scholar returned 403, ORCID exposed a JavaScript-only page, and the full Twente output listing and direct DBLP page were not reliably retrievable. The CV, accessible university records, publisher pages, arXiv, MICCAI, CORDIS, and Zenodo provide the working inventory. A final bibliography reconciliation remains a release check; do not use a scraped profile's raw publication count as proof of completeness.
8. **Newest paper:** Hemo-NF has an official camera-ready record but incomplete final proceedings metadata. Do not fabricate missing DOI, pages, or month.

## 9. Implementation sequence

### Phase 1 — Normalize content

- Convert the inventory into one Markdown record per work in `_publications/`.
- Capture full authors, equal contributions, title aliases, output type, status, dates, venue, DOI/arXiv identifiers, resources, tags, and source URLs.
- Create structured biography/CV data and community records; remove the second maintained CV representation.
- Keep the source ledger and unresolved metadata in `_planning/`, away from public content.

**Result:** a complete content baseline that can generate the archive, selected work, citations, and individual pages.

### Phase 2 — Personalize and simplify the template

- Replace all sample identity, contact, social, site-title, and SEO values.
- Replace the generic homepage and navigation.
- Remove or exclude demo publications, talks, teaching entries, portfolios, posts, comments, example PDFs, and template documentation from the built site, including pages that are merely absent from navigation.
- Add the professional portrait, favicon, typography/spacing refinements, and responsive profile treatment.

**Result:** a recognizable personal website with coherent navigation and no sample content.

### Phase 3 — Build the publication system

- Add `_includes/publication-item.html` and `_includes/publication-resources.html` for consistent entries and independent resource links.
- Add `_layouts/publication.html` with a normal paper mode and an expanded project mode.
- Update `_pages/publications.html` for complete year grouping, type/topic filters, and additional research-output sections.
- Generate bibliography downloads from the same metadata used by the website.
- Use stable slugs; keep titles editable without breaking URLs.

**Result:** every paper is listed, every paper has a page, and metadata is maintained once.

### Phase 4 — Develop the main showcase

- Build AB-GATr first with the current title, earlier-title note, paper/code links, sourced summary, figures, and citation.
- Use Markdown content and reusable figure/resource components so new material can be added without layout changes.
- Populate compact pages for all other works. Give active learning, segmentation, and CenterlinePointNet++ additional visual treatment as supporting projects where assets are available.

**Result:** a substantial main project page plus a consistent foundation for future research pages.

### Phase 5 — Complete professional content

- Populate the CV, appointments, industry experience, grants, awards, reviewing, and supervision.
- Add talks/tutorials/posters and the LOGML, ML in PL, GHOST Day, and MISP² records with the correct years and roles.
- Prepare the public CV download and add real resource links to relevant publication pages.
- Add Person and scholarly-output metadata, canonical URLs, meaningful page titles, social previews, and sitemap entries.

**Result:** the site communicates both research output and professional/community activity.

### Phase 6 — Validate and prepare release

- Run the Jekyll production build and inspect the generated routes.
- Reconcile all 21 inventory records and both patent families against the rendered site. Explain any deliberately merged versions or output-category changes.
- Check duplicate DOI/arXiv identifiers, duplicate permalinks, missing authors/status, malformed citations, and broken local assets.
- Check mobile/desktop layouts, keyboard navigation, visible focus, contrast, image text alternatives, and both themes.
- Check publication filters, resource buttons, bibliography copy/download, CV download, and the no-JavaScript archive.
- Confirm actual scientific figures have captions and all quantitative claims match their source version.
- Inspect the built output for remaining template content and unintended CV/source files.
- Finalize the target URL/base path and deployment settings, then prepare the site for publication.

**Result:** a reviewed static site ready for the selected hosting target.

## 10. Maintenance contract

Store each publication's structured metadata in its Markdown front matter and its expandable narrative below. A new paper should require adding one record and any associated assets; the homepage selection, archive, page, and bibliography should derive from that record.

Suggested fields: `title`, `previous_titles`, `authors`, `equal_contribution`, `type`, `status`, `publication_year`, `conference_year`, `date`, `first_online`, `venue`, `doi`, `arxiv`, `resources`, `topics`, `featured`, `feature_order`, `project_page`, `teaser`, and `sources`.

Keep conference date, publication date, and preprint date separate. Use a stable paper identifier for deduplication and related-work links. Keep patent families in structured data with their own identifiers and status fields.

Include a short editing guide showing how to add a paper, update a preprint after acceptance, add a project figure, and add a talk or community role. Publication updates should be explicit and reviewable; the website does not need live scraping of external profiles.

## Definition of done

- All inventoried work is present with correct attribution and publication status.
- AB-GATr is the main homepage feature and has a complete, expandable project page.
- Every other paper has a stable detail page and useful resource links.
- The CV and community history reflect the supplied chronology and verified public evidence.
- No generic template identities, papers, or unused example pages are published.
- The site builds successfully and works on mobile, desktop, keyboard navigation, and without JavaScript for core content.
- Adding or expanding a publication is documented and requires no duplicate metadata entry.
