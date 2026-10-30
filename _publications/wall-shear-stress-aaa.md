---
layout: "publication"
title: "Wall Shear Stress Estimation in Abdominal Aortic Aneurysms: Towards Generalisable Neural Surrogate Models"
slug: "wall-shear-stress-aaa"
permalink: "/publications/wall-shear-stress-aaa/"
authors:
  - "Patryk Rygiel"
  - "Julian Suk"
  - "Christoph Brune"
  - "Kak Khee Yeung"
  - "Jelmer M. Wolterink"
publication_year: 2025
date: "2025-07-30"
date_precision: "day"
venue: "arXiv"
type: "preprint"
status: "Preprint"
topics:
  - "geometry"
  - "surrogates"
featured: true
feature_order: 3
project_page: true
stylesheets:
  - /assets/css/aneumo-viewer.css
  - /assets/css/wss-viewer.css
summary: "An equivariant neural surrogate estimates aneurysmal wall shear stress and is evaluated under changes in anatomy, boundary conditions, and mesh resolution."
bibtex_type: "misc"
bibtex_key: "wallshearstressaaa2025"
resources:
  - label: "3D viewer"
    url: "/publications/wall-shear-stress-aaa/#wss-demo"
  - label: "DOI"
    url: "https://doi.org/10.48550/arXiv.2507.22817"
  - label: "AAA-100 dataset"
    url: "https://zenodo.org/records/10932957"
  - label: "Paper"
    url: "https://arxiv.org/abs/2507.22817"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2507.22817"
arxiv: "2507.22817"
doi: "10.48550/arXiv.2507.22817"
sources:
  - "https://doi.org/10.48550/arXiv.2507.22817"
  - "https://arxiv.org/abs/2507.22817"
figure:
  src: "/images/research/wall-shear-stress-aaa.png"
  alt: "CFD and a LaB-GATr surrogate estimate transient wall shear stress; four panels show the evaluated generalization settings."
  caption: "CFD and the learned surrogate take vessel geometry and an inflow waveform as inputs. The study tests generalization across physiological conditions, remodeling, topology and mesh resolution."
  source_url: "https://arxiv.org/html/2507.22817v1#S2.F1"
  source_label: "Figure 1 · Rygiel et al. (2025)"
  credit: "Rygiel et al. · CC BY 4.0"
  width: 2047
  height: 1030
---

{% include wss-viewer.html %}

## Generalization beyond a fixed vessel model

A useful surrogate must cope with the variation encountered in vascular modeling. This study uses geometric descriptors and projective geometric algebra to predict transient wall shear stress on abdominal aortic aneurysm surfaces.

The evaluation considers external cases, remodeled geometries, changing boundary conditions, new artery branches, and different mesh resolutions. These experiments test several distinct ways a model can encounter inputs that differ from its training data.
