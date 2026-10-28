---
layout: "publication"
title: "Eigenvector Grouping for Point Cloud Vessel Labeling"
slug: "eigenvector-grouping"
permalink: "/publications/eigenvector-grouping/"
authors:
  - "Patryk Rygiel"
  - "Maciej Zięba"
  - "Tomasz Konopczyński"
publication_year: 2022
date: "2022-11-18"
date_precision: "day"
venue: "Geometric Deep Learning in Medical Image Analysis (GeoMedIA)"
type: "conference"
status: "Published"
topics:
  - "geometry"
  - "imaging"
featured: false
project_page: false
summary: "Eigenvector Grouping adapts point neighborhoods to tubular vessel structures and improves anatomical labeling of coronary artery segmentations."
bibtex_type: "inproceedings"
bibtex_key: "eigenvectorgrouping2022"
resources:
  - label: "Paper"
    url: "https://proceedings.mlr.press/v194/rygiel22a.html"
  - label: "PDF"
    url: "https://proceedings.mlr.press/v194/rygiel22a/rygiel22a.pdf"
  - label: "Code"
    url: "https://github.com/PatRyg99/eigenvector-grouping"
conference_year: 2022
volume: "194"
pages: "72--84"
publisher: "PMLR"
sources:
  - "https://proceedings.mlr.press/v194/rygiel22a.html"
figure:
  src: "/images/research/eigenvector-grouping.png"
  alt: "A U-Net coronary segmentation is converted to a point cloud, labeled with Eigenvector Grouping and refined with component voting."
  caption: "The workflow refines an initial coronary segmentation using PointNet++ with Eigenvector Grouping and component-wise voting."
  source_url: "https://proceedings.mlr.press/v194/rygiel22a/rygiel22a.pdf#page=3"
  source_label: "Figure 1 · Rygiel et al. (2022)"
  credit: "© 2022 P. Rygiel, M. Zięba and T. Konopczyński"
  width: 1310
  height: 555
---

## Neighborhoods shaped for vessels

Point-cloud networks often aggregate information from generic local neighborhoods. Eigenvector Grouping tailors this operation to the elongated structure of blood vessels. A component-wise voting step then encourages consistent labels within connected vessel segments.

The method is evaluated on coronary CT angiography, including cases with interrupted segmentations. The official implementation accompanies the PMLR paper.

Presented as a poster at the GeoMedIA workshop in Amsterdam in November 2022.
