---
layout: "publication"
title: "Active Learning for Deep Learning-Based Hemodynamic Parameter Estimation"
slug: "active-learning"
permalink: "/publications/active-learning/"
authors:
  - "Patryk Rygiel"
  - "Julian Suk"
  - "Kak Khee Yeung"
  - "Christoph Brune"
  - "Jelmer M. Wolterink"
publication_year: 2026
date: "2026-05-01"
date_precision: "day"
venue: "Statistical Atlases and Computational Models of the Heart (STACOM)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "surrogates"
  - "geometry"
featured: true
project_page: false
summary: "Active learning chooses which vessel geometries deserve an expensive CFD simulation, reducing the reference data needed to train hemodynamic surrogates."
bibtex_type: "inproceedings"
bibtex_key: "activelearning2026"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-032-17734-6_11"
  - label: "Paper"
    url: "https://arxiv.org/abs/2503.03453"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2503.03453"
doi: "10.1007/978-3-032-17734-6_11"
pages: "108--118"
first_online: "2026-05-01"
conference_year: 2025
arxiv: "2503.03453"
feature_order: 3
sources:
  - "https://doi.org/10.1007/978-3-032-17734-6_11"
  - "https://arxiv.org/abs/2503.03453"
related_publications:
  - abgatr
  - wall-shear-stress-aaa
figure:
  src: "/images/research/active-learning.png"
  alt: "An active-learning loop selects vessel geometries, simulates their blood flow and retrains a neural surrogate."
  caption: "The active-learning loop ranks unlabeled vessel geometries, runs CFD for the selected examples and adds them to the training pool."
  source_url: "https://arxiv.org/html/2503.03453v2#S2.F1"
  source_label: "Figure 1 · Rygiel et al. (2025)"
  credit: "Rygiel et al. · CC BY 4.0"
  width: 1660
  height: 734
---

## Choosing the next simulation

A fast neural surrogate still needs expensive simulations as training examples. This work introduces acquisition strategies based on geometry, ensemble uncertainty, and physical consistency to select informative examples before running CFD.

On synthetic coronary bifurcations, the strategies reduce the required training samples by up to 50% in the reported experiments, while improving robustness on difficult cases. This result concerns the evaluated benchmark rather than a universal reduction in simulation cost.

The work was presented at STACOM 2025; the proceedings were published in 2026.
