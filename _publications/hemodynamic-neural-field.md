---
layout: "publication"
title: "Hemodynamic Neural Field: Continuous Blood Flow Estimation in Vessel Geometries via Global Shape Conditioning"
slug: "hemodynamic-neural-field"
permalink: "/publications/hemodynamic-neural-field/"
authors:
  - "Simon Perrin"
  - "Patryk Rygiel"
  - "Amin Ranem"
  - "Bram de Wilde"
  - "Sébastien Levilly"
  - "Jelmer M. Wolterink"
  - "Harold Mouchère"
publication_year: 2026
date: "2026-01-01"
date_precision: "year"
venue: "Off-Grid · MICCAI 2026"
type: "conference"
parent_conference: MICCAI
status: "Camera-ready"
topics:
  - "surrogates"
  - "geometry"
featured: false
project_page: false
summary: "Hemo-NF represents blood velocity as a continuous field conditioned on vessel shape, connecting implicit geometry representations with hemodynamic prediction."
bibtex_type: "inproceedings"
bibtex_key: "hemodynamicneuralfield2026"
resources:
  - label: "Paper"
    url: "https://papers.miccai.org/miccai-2026-sat/Off_Grid_026.html"
  - label: "PDF"
    url: "https://papers.miccai.org/miccai-2026-sat/paper/Off_Grid_026.pdf"
  - label: "OpenReview"
    url: "https://openreview.net/forum?id=vtETPTLLN1"
conference_year: 2026
sources:
  - "https://papers.miccai.org/miccai-2026-sat/Off_Grid_026.html"
figure:
  src: "/images/research/hemodynamic-neural-field.png"
  alt: "DeepSDF encodes vessel shape and local features that condition a neural field predicting three blood-flow velocity components."
  caption: "Hemo-NF conditions a continuous velocity field on global vessel shape and local features learned by DeepSDF."
  source_url: "https://papers.miccai.org/miccai-2026-sat/paper/Off_Grid_026.pdf#page=4"
  source_label: "Figure 1 · Perrin et al. (2026)"
  credit: "Perrin et al. · official OffGrid MICCAI 2026 manuscript"
  width: 1010
  height: 325
---

## A continuous representation of flow

Hemo-NF separates vessel representation from flow prediction. A DeepSDF model encodes the geometry, and a second neural field predicts velocity at spatial coordinates. The study compares ways of conditioning the flow field on global and local shape information.

Experiments use synthetic bifurcating arteries and examine both geometry reconstruction and velocity estimation. The official MICCAI record provides the camera-ready paper; final DOI and page information have not yet been assigned there.
