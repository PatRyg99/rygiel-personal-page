---
layout: "publication"
title: "Beyond Pixels: Medical Image Quality Assessment with Implicit Neural Representations"
slug: "beyond-pixels"
permalink: "/publications/beyond-pixels/"
authors:
  - "Caner Özer"
  - "Patryk Rygiel"
  - "Bram de Wilde"
  - "İlkay Öksüz"
  - "Jelmer M. Wolterink"
publication_year: 2026
date: "2026-01-02"
date_precision: "day"
venue: "Machine Learning in Medical Imaging (MLMI)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "imaging"
featured: false
project_page: false
summary: "Image-quality models operate on implicit neural representations of medical images, allowing compact representations to carry information about imaging artifacts."
bibtex_type: "inproceedings"
bibtex_key: "beyondpixels2026"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-032-09513-8_35"
  - label: "Paper"
    url: "https://arxiv.org/abs/2508.05168"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2508.05168"
doi: "10.1007/978-3-032-09513-8_35"
pages: "359--368"
first_online: "2026-01-02"
conference_year: 2025
arxiv: "2508.05168"
sources:
  - "https://doi.org/10.1007/978-3-032-09513-8_35"
  - "https://arxiv.org/abs/2508.05168"
figure:
  src: "/images/research/beyond-pixels.png"
  width: 850
  height: 640
  alt: "A two-stage workflow fits cardiac MRI slices with SIREN networks, then uses their weights as the input to an image-quality classifier."
  caption: "Cardiac images are first represented by implicit neural networks; a second model classifies image quality directly from those networks’ parameters."
  source_url: "https://arxiv.org/html/2508.05168v1#S2.F1"
  source_label: "Figure 1 · Özer et al. (2025 preprint)"
  credit: "Özer et al. · CC BY 4.0. Original figure from arXiv:2508.05168v1."
---

## Assessing images through their neural representations

An implicit neural representation stores an image as a function of spatial coordinates. This work asks whether the parameters of that function can reveal image quality, avoiding the need to process every pixel or voxel directly.

The study evaluates weight-space networks, graph networks, and attention-based models on cardiac images with synthetic artifacts. It compares their ability to recognize image quality using compact representations.
