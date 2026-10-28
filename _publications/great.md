---
layout: "publication"
title: "GReAT: Leveraging Geometric Artery Data to Improve Wall Shear Stress Assessment"
slug: "great"
permalink: "/publications/great/"
authors:
  - "Julian Suk"
  - "Jolanda J. Wentzel"
  - "Patryk Rygiel"
  - "Joost Daemen"
  - "Daniel Rueckert"
  - "Jelmer M. Wolterink"
publication_year: 2026
date: "2026-01-01"
date_precision: "year"
venue: "Shape in Medical Imaging (ShapeMI)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "geometry"
  - "surrogates"
featured: false
project_page: false
summary: "GReAT uses self-supervised learning on artery shapes to improve wall shear stress assessment when labeled clinical data are limited."
bibtex_type: "inproceedings"
bibtex_key: "great2026"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-032-06774-6_21"
  - label: "Paper"
    url: "https://arxiv.org/abs/2508.19030"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2508.19030"
doi: "10.1007/978-3-032-06774-6_21"
pages: "277--291"
first_online: "2025-10-05"
conference_year: 2025
arxiv: "2508.19030"
sources:
  - "https://doi.org/10.1007/978-3-032-06774-6_21"
  - "https://arxiv.org/abs/2508.19030"
figure:
  src: "/images/research/great.png"
  width: 580
  height: 300
  alt: "Three coronary artery surfaces display regions of low, intermediate and high wall shear stress in pink, yellow and green."
  caption: "Coronary examples from the IMPACT dataset illustrate spatial wall-shear-stress classes used in the study: right coronary, left anterior descending and left circumflex arteries."
  source_url: "https://arxiv.org/html/2508.19030v1#S3.F1"
  source_label: "Figure 1 · Suk et al. (2025 preprint)"
  credit: "Suk et al. · CC BY 4.0. Original figure from arXiv:2508.19030v1."
---

## Learning from unlabeled artery geometry

Large collections of vascular shapes can provide useful training information even without matching flow simulations. GReAT uses heat-kernel signatures as a self-supervised learning target, then transfers the resulting geometric representation to coronary wall shear stress assessment.

The downstream task identifies regions with low, medium, or high time-averaged wall shear stress. The study examines whether geometric pretraining helps when only a small patient cohort is available.
