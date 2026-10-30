# Patryk Rygiel — research website

A personal academic website built from Academic Pages with Jekyll. It contains a complete publication archive, an expanded AB-GATr project page, a download of the supplied CV, and talks/community activities. Content is maintained locally in Markdown and structured data; visitors need no account or JavaScript to read it.

## Local development

Use Ruby with Bundler, then:

```sh
bundle install
ruby -EUTF-8 scripts/sync_publications.rb
bundle exec jekyll serve --port 4000
```

Open `http://127.0.0.1:4000/rygiel-personal-page/`. No npm installation is needed for the website. JavaScript is plain, unbundled browser code.

The default configuration matches this repository's GitHub Pages project URL. For a custom domain or a root-level site, change `url` and `baseurl` in `_config.yml`. All internal links and assets use Jekyll URL filters.

## Check a production build

```sh
ruby -EUTF-8 scripts/sync_publications.rb
JEKYLL_ENV=production bundle exec jekyll build
bundle exec ruby -EUTF-8 scripts/check_site.rb
```

The checks verify publication coverage, unique identifiers, matching citation downloads, internal links and anchors, structured metadata, and exclusion of template/private files. The build output is `_site/`.

For browser checks, start the preview server in another terminal, then run:

```sh
node scripts/browser-check.mjs
```

This requires Node 22+ and Google Chrome. Set `CHROME_PATH` for a nonstandard Chrome location and `SITE_PREVIEW_URL` if the preview address differs. The script checks six routes at desktop/tablet/mobile widths, figure loading on all 21 publication pages, the photography gallery and keyboard controls, filters, previous-title search, theme persistence, citation copying, and reading without JavaScript. It saves screenshots to the system temporary directory, checks grouped activity dates, and verifies that the downloaded CV is identical to the supplied PDF. It never edits or regenerates the CV.

## AB-GATr interactive viewer

The AB-GATr project page includes an on-demand 3D viewer, linked from the home-page feature. Choose a dataset and sample: ANEUMO (777, 832, 845), SynthBifCor (1815, 1847, 1962), or AAA-100 (021, time-resolved). It compares CFD, a chosen prediction, and the corresponding absolute-error field with synchronized rotation, zoom, and pan. X/Y/Z slicing offers 15 positions per axis, with a translucent original vessel wall. The six model choices include the rotation-trained (`-180`) AB-UPT and Transolver++ variants. `Transolver` field names are displayed as Transolver++, following the supplied model identification.

AAA-100 uses `AAA021-T-combined.vtu` and is the default example: all 21 supplied timesteps play in a loop, synchronized across the three panels. An accessible play/pause icon button, a timestep slider, and playback speed controls allow inspection of individual frames. Camera position is retained as time advances, and velocity/error scales stay fixed across the entire cycle and all models. Playback starts when the case loads, except when the visitor prefers reduced motion, and suspends while the browser tab is hidden. The source provides frame indices rather than physical timestamps, so playback speed is a presentation setting. The former averaged AAA cases are no longer included.

The source files (`777-combined.vtu`, etc.; `sample-1815-combined.vtu`, etc.; `AAA021-T-combined.vtu`) remain local. All `.vtu` files are ignored by Git and excluded from Jekyll output. Regenerate the browser assets with Python and VTK (tested with 9.6.1; no NumPy required):

```sh
python3 scripts/prepare_aneumo.py
```

Commit the resulting `assets/data/abgatr-demo/` directory. GitHub Pages does not need VTK or a Python build step. The manifest records model fields, fixed per-sample scales, source hashes, and the common geometry transform. The scalar values are already **cm/s**, as confirmed by the dataset owner, and are not rescaled. Positions are centered and uniformly scaled only for display.

Cuts interpolate the supplied three-component vectors, then store their L2 magnitudes as float32. The error view uses the supplied componentwise absolute-error vectors, not the absolute difference between scalar speeds. Original volume cells without a successful direct contour are selectively tetrahedralized; conversion checks positive volumes, volume conservation, and complete intersected-cell coverage. The original surface supplies the translucent wall. Unused source points do not affect the mesh or color ranges. `audit.json` records the validation and any fallback cells. No mesh decimation or synthetic field values are used.

`assets/js/aneumo-viewer.js` handles rendering and interaction; `_includes/aneumo-viewer.html` and `assets/css/aneumo-viewer.scss` define the interface. Three.js and OrbitControls are pinned and served locally under `assets/js/vendor/three/`, with their license and provenance. Cases and slices load on demand; opening the page does not download the geometry or start WebGL. Velocity uses Cool to Warm (Extended); absolute error uses Turbo.

Temporal geometry is stored once per slice. Separate bundles hold all 21 CFD frames and each model's prediction/error frames, so changing models downloads only the selected model's bundle. Float32 values use lossless XOR deltas and gzip compression; the browser keeps a bounded cache and updates colors without rebuilding the mesh each frame. Manifest version 2 adds `timeSteps`, `seriesEncoding`, and per-slice `series` paths while retaining the static binary format for ANEUMO and SynthBifCor.

With the local preview running, check real WebGL renders and controls using:

```sh
node scripts/aneumo-browser-check.mjs
```

This uses Chrome's software WebGL renderer to test all cases/model variants, slicing, synchronized cameras, keyboard and pinch controls, mobile/dark layouts, request cancellation, and error recovery. `SITE_PREVIEW_URL` can select a different preview address.

## Publication country map

The Publications page includes a world map and a closer Europe view. Hover, keyboard focus, or a tap shows a country's institutions and their paper counts. Selecting a country filters the archive and works alongside the search, output type, and topic filters.

Maintain `_data/publication_affiliations.yml` when adding a paper. Under `papers`, use its publication slug and record ISO country codes, the paper's affiliation source URL and section, and `evidence` containing each country's canonical institution names. Reuse existing institution names so their counts combine correctly. Group departments and campus locations under their parent institution; count each paper once per country and institution. Include credited consortium contributions, but not editors, conference locations, acknowledgements, or authors' later jobs. Use `excluded` with a reason for datasets, the single-author thesis, or papers without verifiable affiliations. Add newly represented countries to `countries`.

Counts are calculated from these records and embedded in the server-rendered map. The expandable source list is readable without JavaScript. The site checker validates audit coverage, country counts, source links, and filtering metadata. Browser checks cover institution popups, keyboard access, combined filters, and the no-JavaScript fallback.

`_data/world_map.json` contains locally served, public-domain Natural Earth geometry. It requires no map service, API key, or build-time network access. To refresh the geometry, download the pinned source specified in `scripts/prepare_world_map.py` and run that script with the local GeoJSON path. Publication updates do not require regenerating the geometry.

## Photography

The gallery lives at `/photography/`, grouped by year (newest first), then region and place (alphabetically). Edit `_data/photography.yml` to change regions, places, countries, years, and accessible image descriptions; the first data entry is featured at full width within its region. Captions show only the place, country, and year. The `alt` descriptions are used for accessibility.

To add photos, put the originals in `images/photography/`, add an entry with `file`, `region`, `place`, `country`, `year`, and `alt` to `_data/photography.yml`, then run:

```sh
ruby -EUTF-8 scripts/prepare_photography.rb
```

This requires ImageMagick (`magick`; on macOS, install with `brew install imagemagick`). It creates 800px and 2048px JPEG copies in `images/gallery/`, applies the camera orientation, removes embedded metadata, and updates the dimensions in the data file. Originals remain local, are ignored by Git, and are excluded from the built website. Commit the generated web images and updated data file with the page changes; GitHub Pages does not need to run the image preparation script.

## Add or update a publication

1. Add `_publications/<stable-slug>.md`. Copy a similar existing record and change its metadata.
2. Keep a single record for a paper's preprint and published versions. Update `status`, `venue`, `publication_year`, and `doi` after acceptance; keep the arXiv identifier and resource links.
3. Keep `conference_year` separate from `publication_year` where proceedings appear later. `date` controls ordering; set `date_precision` to `year`, `month`, or `day` rather than inventing precision.
4. Put the expandable project narrative below the front matter. Images, tables, videos, extra experiments, and ordinary Markdown can be added here without changing layouts.
5. Add its verified affiliation evidence (or an explicit exclusion) to `_data/publication_affiliations.yml`, as described above.
6. Run the sync script and build checks above. Commit the generated `_pages/bibtex/` wrappers together with the publication. These wrappers contain references only; citation content is generated from the same publication metadata as the page.

Core fields:

```yaml
layout: publication
title: "Paper title"
slug: stable-slug
permalink: /publications/stable-slug/
authors:
  - Patryk Rygiel
publication_year: 2026
date: "2026-01-01"
date_precision: year
venue: arXiv
type: preprint
status: Preprint
summary: "An original short description of the work."
bibtex_type: misc
bibtex_key: rygiel2026example
resources:
  - label: Paper
    url: https://example.org/paper
topics:
  - geometry
featured: false
```

Types: `journal`, `conference`, `preprint`, `report`, `chapter`, `dataset`, `thesis`. Topics: `geometry`, `surrogates`, `imaging`. Only add links that exist. `featured: true` and `feature_order` place a work in the homepage selection; AB-GATr has a dedicated feature block. For a workshop held at MICCAI, set `parent_conference: MICCAI` and the actual `conference_year`; the archive and detail pages display the parent conference and search includes it. Publication pages support `previous_titles`, `equal_contribution`, `collaborators`, `corporate_authors`, and `related_publications` (stable slugs). Keep corporate/consortium attribution separate from individual authorship.

A publication can include a `figure` object with `src`, `alt`, `caption`, `source_url`, `source_label`, and `credit`. Store the actual paper figure in `images/research/`; the shared layout displays it above the narrative with source attribution. The AB-GATr page keeps its richer sequence of inline figures.

`_includes/bibtex-entry.txt` is the single citation template used by page previews and downloads. Full names and Unicode are preserved. There is no second manually maintained `.bib` database.

## Edit other content

- Homepage and dated news: `_pages/about.md`.
- Homepage research grants: the `grants` section of `_data/cv.json`; other background data is retained for reference, and reviewing roles are not displayed on the website.
- CV download: `files/patryk-rygiel-cv.pdf`, an unchanged copy of the supplied `Patryk_Rygiel_CV.pdf`. Replace both when you provide a newer CV; there is no separate CV page.
- Talks and community roles: `_data/activities.yml`. Talks are individual entries, including ML in PL, with dates written as month and year (for example, `Oct 2026`). Each record accepts a `dates` list; use `appearances` with `date`, `title`, `description`, and optional `url`/`type` for grouped community roles (as with ML in PL organization). Community roles may retain year-only dates.
- Patent application families: `_data/patents.yml`.
- Identity, email, social profiles, hosting URL: `_config.yml`.
- Main navigation: `_data/navigation.yml`.
- Styles and interaction: `assets/css/site.scss`, `assets/js/site.js`.

The root CV is excluded to avoid a duplicate URL. The downloadable copy preserves the original PDF exactly, as requested. Updating website content does not modify the PDF. To replace the download after updating the root file, run `cp Patryk_Rygiel_CV.pdf files/patryk-rygiel-cv.pdf`.

## Research sources and assets

Source records and editorial decisions are kept in `_planning/`, which is excluded from the built site:

- `website-plan.md`: original implementation plan and completion note.
- `publication-sources.md`: publication metadata and attribution decisions.
- `assets-and-manchester.md`: CIMIM appointment details, image sources, and manuscript version/figure credits.
- `figures-assets.md` and `figures-content.md`: sources, manuscript versions, and credits for the other 20 publication visuals; two figures come from the authors’ official slides/poster when the paper full text was unavailable.

The professional portrait comes from the official CIMIM people page. AB-GATr figures are unchanged originals from arXiv v2, credited on the site under CC BY-NC-SA 4.0. The template's MIT license does not supersede the licenses of research figures or the portrait.

The site is prepared for static hosting. No hosting service, domain, or repository settings are changed by a local build.
