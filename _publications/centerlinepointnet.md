---
layout: "publication"
title: "CenterlinePointNet++: A New Point Cloud Based Architecture for Coronary Artery Pressure Drop and vFFR Estimation"
slug: "centerlinepointnet"
permalink: "/publications/centerlinepointnet/"
authors:
  - "Patryk Rygiel"
  - "Paweł Płuszka"
  - "Maciej Zięba"
  - "Tomasz Konopczyński"
publication_year: 2023
date: "2023-10-01"
date_precision: "day"
venue: "Medical Image Computing and Computer Assisted Intervention (MICCAI)"
type: "conference"
status: "Published"
topics:
  - "geometry"
  - "surrogates"
featured: true
project_page: false
summary: "CenterlinePointNet++ adapts point-cloud learning to coronary anatomy for pressure-drop and virtual fractional flow reserve estimation."
bibtex_type: "inproceedings"
bibtex_key: "centerlinepointnet2023"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-031-43990-2_73"
  - label: "Slides"
    url: "https://conference2023.mlinpl.org/docs/cfc_talk_18.pdf"
doi: "10.1007/978-3-031-43990-2_73"
pages: "781--790"
first_online: "2023-10-01"
conference_year: 2023
feature_order: 4
sources:
  - "https://doi.org/10.1007/978-3-031-43990-2_73"
related_publications:
  - ffr-thesis
  - eigenvector-grouping
figure:
  src: "/images/research/centerlinepointnet.png"
  alt: "CenterlinePointNet++ uses a surface point cloud and centerline with encoder and decoder blocks to predict coronary hemodynamics."
  caption: "CenterlinePointNet++ combines the vessel surface and centerline graph. Architecture diagram reproduced from the authors’ ML in PL 2023 presentation."
  source_url: "https://conference2023.mlinpl.org/docs/cfc_talk_18.pdf#page=15"
  source_label: "Architecture diagram · Rygiel et al. (2023), slide 15"
  credit: "© 2023 Hemolens Diagnostics Sp. z o.o. · authors’ conference slides"
  width: 2200
  height: 667
---

## Learning along the vessel tree

Nearby points in Euclidean space do not necessarily belong to the same artery branch. CenterlinePointNet++ incorporates vessel-centerline information into point-cloud processing to better reflect the structure of the coronary tree.

The model predicts pressure drop and virtual fractional flow reserve from vessel geometry. Its evaluation explores neural estimation as an alternative to running a full flow simulation for each new case.

The accompanying MSc thesis provides a longer account of this research.

Presented as a poster at MICCAI 2023 in Vancouver. See the [conference programme](https://conferences.miccai.org/2023/files/downloads/MICCAI2023-Main-Conference-Oral-and-Poster-Program.pdf#page=4).
