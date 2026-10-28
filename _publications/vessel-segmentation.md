---
layout: "publication"
title: "Global Control for Local SO(3)-Equivariant Scale-Invariant Vessel Segmentation"
slug: "vessel-segmentation"
permalink: "/publications/vessel-segmentation/"
authors:
  - "Patryk Rygiel"
  - "Dieuwertje Alblas"
  - "Christoph Brune"
  - "Kak Khee Yeung"
  - "Jelmer M. Wolterink"
publication_year: 2025
date: "2025-04-29"
date_precision: "day"
venue: "Statistical Atlases and Computational Models of the Heart (STACOM)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "geometry"
  - "imaging"
featured: false
project_page: false
summary: "A global controller and local equivariant model produce smooth vascular surfaces while letting the user choose which vessel regions to include."
bibtex_type: "inproceedings"
bibtex_key: "vesselsegmentation2025"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-031-87756-8_27"
  - label: "Code"
    url: "https://github.com/MIAGroupUT/SIRE-segmentation"
  - label: "Dataset"
    url: "https://zenodo.org/records/10932957"
  - label: "Paper"
    url: "https://arxiv.org/abs/2403.15314"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2403.15314"
doi: "10.1007/978-3-031-87756-8_27"
pages: "269--279"
first_online: "2025-04-29"
conference_year: 2024
arxiv: "2403.15314"
sources:
  - "https://doi.org/10.1007/978-3-031-87756-8_27"
  - "https://arxiv.org/abs/2403.15314"
related_publications:
  - aaa-100
  - aaa-growth
figure:
  src: "/images/research/vessel-segmentation.png"
  alt: "Vessel segmentation pipeline combining global boundary conditions, local tracking and neural-field surface reconstruction."
  caption: "SIRE combines global control with local rotation-equivariant, scale-invariant vessel segmentation and neural-field surface reconstruction."
  source_url: "https://arxiv.org/html/2403.15314v2#S1.F1"
  source_label: "Figure 1 · Rygiel et al. (2024)"
  credit: "Rygiel et al. · CC BY 4.0"
  width: 579
  height: 167
---

## Controllable vascular reconstruction

The method combines a global description of the desired vessel region with an iterative local segmentation model. Rotation equivariance and scale invariance allow the local model to handle vessels with different orientations and sizes.

The resulting representation is a smooth, watertight vascular surface. Adjusting the global controller allows vessel segments to be extended without retraining the local model.

The work received the best poster award at STACOM 2024. Its proceedings version was published in 2025, and the associated AAA-100 dataset is available separately.
