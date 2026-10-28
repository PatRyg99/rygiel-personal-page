---
layout: "publication"
title: "Neural Fields for Continuous Periodic Motion Estimation in 4D Cardiovascular Imaging"
slug: "neural-motion"
permalink: "/publications/neural-motion/"
authors:
  - "Simone Garzia"
  - "Patryk Rygiel"
  - "Sven Dummer"
  - "Filippo Cademartiri"
  - "Simona Celi"
  - "Jelmer M. Wolterink"
publication_year: 2025
date: "2025-04-29"
date_precision: "day"
venue: "Statistical Atlases and Computational Models of the Heart (STACOM)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "imaging"
  - "geometry"
featured: false
project_page: false
summary: "A neural field models continuous, periodic vessel-wall motion throughout the cardiac cycle using time-resolved cardiovascular images."
bibtex_type: "inproceedings"
bibtex_key: "neuralmotion2025"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-031-87756-8_37"
  - label: "Paper"
    url: "https://arxiv.org/abs/2407.20728"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2407.20728"
doi: "10.1007/978-3-031-87756-8_37"
pages: "378--389"
first_online: "2025-04-29"
conference_year: 2024
arxiv: "2407.20728"
sources:
  - "https://doi.org/10.1007/978-3-031-87756-8_37"
  - "https://arxiv.org/abs/2407.20728"
figure:
  src: "/images/research/neural-motion.jpg"
  alt: "A neural network with periodic time encoding models aortic motion throughout the cardiac cycle."
  caption: "A continuous neural velocity field with periodic time encoding describes aortic motion across the cardiac cycle."
  source_url: "https://arxiv.org/html/2407.20728v1#S2.F1"
  source_label: "Figure 1 · Garzia et al. (2024)"
  credit: "Garzia et al. · CC BY 4.0"
  width: 2200
  height: 1320
---

## Representing motion across the cardiac cycle

This method learns a time-dependent velocity field from a four-dimensional image sequence. Integrating that field produces deformations that can move images, segmentations, or surface meshes through time.

Periodicity is incorporated into the temporal representation and the deformation regularization. Experiments with synthetic sequences, gated CT, and flow MRI investigate how the method can support analysis of moving artery walls.
