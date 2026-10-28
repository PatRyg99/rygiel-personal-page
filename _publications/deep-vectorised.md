---
layout: "publication"
title: "Deep vectorised operators for pulsatile hemodynamics estimation in coronary arteries from a steady-state prior"
slug: "deep-vectorised"
permalink: "/publications/deep-vectorised/"
authors:
  - "Julian Suk"
  - "Guido Nannini"
  - "Patryk Rygiel"
  - "Christoph Brune"
  - "Gianluca Pontone"
  - "Alberto Redaelli"
  - "Jelmer M. Wolterink"
publication_year: 2025
date: "2025-11-01"
date_precision: "month"
venue: "Computer Methods and Programs in Biomedicine"
type: "journal"
status: "Published"
topics:
  - "surrogates"
  - "geometry"
featured: false
project_page: false
summary: "Deep vectorised operators estimate pulsatile coronary blood flow from a steady-state prior while allowing changes in the spatial discretization."
bibtex_type: "article"
bibtex_key: "deepvectorised2025"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1016/j.cmpb.2025.108958"
  - label: "Paper"
    url: "https://arxiv.org/abs/2410.11920"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2410.11920"
doi: "10.1016/j.cmpb.2025.108958"
volume: "271"
article_number: "108958"
arxiv: "2410.11920"
sources:
  - "https://doi.org/10.1016/j.cmpb.2025.108958"
  - "https://arxiv.org/abs/2410.11920"
figure:
  src: "/images/research/deep-vectorised.png"
  alt: "A conditional neural field uses steady flow, point coordinates, boundary conditions and time to predict pulsatile coronary hemodynamics."
  caption: "The deep vectorised operator combines steady-state flow, relational point encoding and time-dependent conditions to predict pulsatile hemodynamics."
  source_url: "https://arxiv.org/html/2410.11920v2#S2.F2"
  source_label: "Figure 2 · Suk et al. (2024)"
  credit: "Suk et al. · CC BY-NC-ND 4.0 · reproduced unchanged"
  width: 825
  height: 304
---

## From steady flow to a pulse

This work introduces a neural operator formulation for estimating time-dependent velocity and pressure in coronary arteries. A neural field is conditioned on hemodynamic boundary conditions and uses a steady-state solution as prior information.

The formulation supports message-passing and attention mechanisms while retaining permutation equivariance. Experiments on patient-specific arteries examine both prediction accuracy and sensitivity to resampling the input domain.
