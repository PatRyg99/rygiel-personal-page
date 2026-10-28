---
layout: "publication"
title: "Geometric deep learning for local growth prediction on abdominal aortic aneurysm surfaces"
slug: "aaa-growth"
permalink: "/publications/aaa-growth/"
authors:
  - "Dieuwertje Alblas"
  - "Patryk Rygiel"
  - "Julian Suk"
  - "Kaj O. Kappe"
  - "Marieke Hofman"
  - "Christoph Brune"
  - "Kak Khee Yeung"
  - "Jelmer M. Wolterink"
publication_year: 2026
date: "2026-02-01"
date_precision: "month"
venue: "Artificial Intelligence in Medicine"
type: "journal"
status: "Published"
topics:
  - "geometry"
  - "imaging"
featured: false
project_page: false
summary: "A geometric transformer predicts where an abdominal aortic aneurysm will grow directly on its three-dimensional surface."
bibtex_type: "article"
bibtex_key: "aaagrowth2026"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1016/j.artmed.2025.103323"
  - label: "Paper"
    url: "https://arxiv.org/abs/2506.08729"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2506.08729"
doi: "10.1016/j.artmed.2025.103323"
volume: "172"
article_number: "103323"
arxiv: "2506.08729"
sources:
  - "https://doi.org/10.1016/j.artmed.2025.103323"
  - "https://arxiv.org/abs/2506.08729"
figure:
  src: "/images/research/aaa-growth.png"
  width: 825
  height: 237
  alt: "A vascular surface and local physical features enter LaB-GATr, which predicts deformation vectors and the future aneurysm surface."
  caption: "Local growth prediction combines vascular geometry, multiphysical features and the follow-up interval to estimate changes to the aneurysm surface."
  source_url: "https://arxiv.org/html/2506.08729v2#S1.F1"
  source_label: "Figure 1 · Alblas et al. (2025 preprint)"
  credit: "Alblas et al. · CC BY 4.0. Original figure from arXiv:2506.08729v2."
---

## Predicting local changes in vessel shape

This study models aneurysm progression on the vascular surface, retaining the spatial structure that a single diameter measurement cannot capture. A transformer combines geometry with local physical features to estimate growth between follow-up scans.

The method is evaluated on longitudinal CT angiography and an external hospital dataset. The work explores the potential of directional growth prediction for more individualized surveillance.
