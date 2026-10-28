---
layout: "publication"
title: "Learning hemodynamic scalar fields on coronary artery meshes: A benchmark of geometric deep learning models"
slug: "mesh-benchmark"
permalink: "/publications/mesh-benchmark/"
authors:
  - "Guido Nannini"
  - "Julian Suk"
  - "Patryk Rygiel"
  - "Simone Saitta"
  - "Luca Mariani"
  - "Riccardo Maranga"
  - "Andrea Baggiano"
  - "Gianluca Pontone"
  - "Jelmer M. Wolterink"
  - "Alberto Redaelli"
publication_year: 2025
date: "2025-09-01"
date_precision: "month"
venue: "Computers in Biology and Medicine"
type: "journal"
status: "Published"
topics:
  - "geometry"
  - "surrogates"
featured: false
project_page: false
summary: "A benchmark compares geometric neural networks for learning pressure-related fields and virtual fractional flow reserve on coronary artery meshes."
bibtex_type: "article"
bibtex_key: "meshbenchmark2025"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1016/j.compbiomed.2025.110477"
  - label: "Paper"
    url: "https://arxiv.org/abs/2501.09046"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2501.09046"
doi: "10.1016/j.compbiomed.2025.110477"
volume: "195"
article_number: "110477"
arxiv: "2501.09046"
sources:
  - "https://doi.org/10.1016/j.compbiomed.2025.110477"
  - "https://arxiv.org/abs/2501.09046"
figure:
  src: "/images/research/mesh-benchmark.png"
  width: 3583
  height: 3764
  alt: "A workflow connects synthetic and patient-specific coronary meshes, per-vertex features, model training and evaluation for pressure and fractional-flow-reserve prediction."
  caption: "The benchmark links experiments on synthetic bifurcations to patient-specific coronary geometries through shared surface features and evaluation measures."
  source_url: "https://arxiv.org/html/2501.09046v2#S2.F1"
  source_label: "Figure 1 · Nannini et al. (2025)"
  credit: "Nannini et al. · CC BY-NC-SA 4.0. Original figure from arXiv:2501.09046v2."
---

## Comparing geometric models for coronary flow

The study compares multiple neural backends and prediction targets on synthetic and patient-specific coronary geometries. It examines how choices such as learning pressure drop rather than pressure influence the reconstruction of virtual fractional flow reserve.

The results distinguish performance on simple synthetic vessels from performance on more varied clinical geometries. This provides a practical basis for choosing architectures and learning targets for hemodynamic surrogate models.
