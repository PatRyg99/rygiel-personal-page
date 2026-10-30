## Deployment

This is a Jekyll site published with GitHub Pages. The current configuration in `_config.yml` is:

```yaml
url: "https://patryg99.github.io"
baseurl: "/rygiel-personal-page"
```

Before deploying, install the Ruby dependencies and verify the build:

```sh
bundle install
ruby -EUTF-8 scripts/sync_publications.rb
JEKYLL_ENV=production bundle exec jekyll build
bundle exec ruby -EUTF-8 scripts/check_site.rb
```

The build checker validates links, publications, viewer data, and the complete site's size against a conservative 1 GB GitHub Pages budget. For a local preview, run `bundle exec jekyll serve` and open `http://127.0.0.1:4000/rygiel-personal-page/`.

Commit the source and prepared assets, then push to `master`. In the GitHub repository, select **Settings → Pages → Deploy from a branch → master → /(root)** and save. GitHub builds and publishes the site at [patryg99.github.io/rygiel-personal-page](https://patryg99.github.io/rygiel-personal-page/). See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

For another repository or domain, update `url`, `baseurl`, and `repository` in `_config.yml` before building. No npm build is required.

When adding simulation examples, prepare the assets and error metrics locally before deploying (Python with VTK required):

```sh
python3 scripts/prepare_aneumo.py
python3 scripts/prepare_viewer_metrics.py
```

For the surface WSS viewer, run `python3 scripts/prepare_wss.py`. It prepares the topology, boundary-condition, and longitudinal-remodelling comparisons from the `.vtp` files, with all 21 timesteps and surface errors. Challenge pairs, labels, and fixed color limits are defined in the generated manifest. Run `python3 scripts/test_wss_assets.py` and `node scripts/check_wss_assets.mjs` to verify the source data and browser decoder.

When adding photographs, run `ruby -EUTF-8 scripts/prepare_photography.rb` (ImageMagick required). Commit the generated files in `assets/data/abgatr-demo/`, `assets/data/wss-demo/`, and `images/gallery/`. Original `.vtu`/`.vtp` files and `images/photography/` stay local and are excluded from Git and the published site.

## Repository layout

| Path | Purpose |
| --- | --- |
| `_config.yml` | Site URL, identity, contact details, profiles, and Jekyll settings. |
| `_pages/about.md` | Homepage introduction, featured work, recent updates, and grant display. |
| `_pages/` | Publications archive, talks, photography, and generated bibliography routes. |
| `_publications/` | Publication metadata and individual project pages. |
| `_data/activities.yml` | Talks, posters, tutorials, and community roles. |
| `_data/cv.json` | Grant records and background information. |
| `_data/navigation.yml` | Main navigation. |
| `_data/photography.yml` | Photo locations, years, grouping, and accessibility text. |
| `_data/publication_affiliations.yml` | Country and institution evidence for the publication map. |
| `_data/world_map.json` | Map geometry. |
| `_layouts/`, `_includes/` | Shared page templates and components. |
| `_includes/aneumo-viewer.html` | Viewer controls, default case, slice, zoom, and colour-scale caps. |
| `_includes/wss-viewer.html` | Surface WSS viewer controls and comparison panels. |
| `assets/css/`, `assets/js/` | Styles, interactions, and the 3D viewer. |
| `assets/data/abgatr-demo/` | Prepared geometry, scalar fields, manifest, audit, and error metrics. |
| `assets/data/wss-demo/` | Full-resolution surface meshes, lossless WSS vectors, heart-cycle metrics, and source audit. |
| `images/research/`, `images/gallery/` | Publication figures and optimized photographs. |
| `files/patryk-rygiel-cv.pdf` | Downloadable CV PDF. |
| `scripts/` | Asset preparation, publication synchronization, and validation tools. |
| `_planning/` | Research sources and planning notes; excluded from publication. |
| `_site/` | Generated website; ignored by Git. |
