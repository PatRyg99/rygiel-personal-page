---
layout: "publication"
title: "Coronary Ostia Localization Using Residual U-Net with Heatmap Matching and 3D DSNT"
slug: "coronary-ostia"
permalink: "/publications/coronary-ostia/"
authors:
  - "Miłosz Gajowczyk"
  - "Patryk Rygiel"
  - "Piotr Gródek"
  - "Adrian Korbecki"
  - "Michał Sobański"
  - "Przemysław Podgórski"
  - "Tomasz Konopczyński"
publication_year: 2022
date: "2022-12-16"
date_precision: "day"
venue: "Machine Learning in Medical Imaging (MLMI)"
type: "conference"
parent_conference: MICCAI
status: "Published"
topics:
  - "imaging"
featured: false
project_page: false
summary: "A residual U-Net and differentiable coordinate transform locate coronary ostia directly in three-dimensional medical images."
bibtex_type: "inproceedings"
bibtex_key: "coronaryostia2022"
resources:
  - label: "Publisher"
    url: "https://doi.org/10.1007/978-3-031-21014-3_33"
doi: "10.1007/978-3-031-21014-3_33"
pages: "318--327"
first_online: "2022-12-16"
equal_contribution:
  - "Miłosz Gajowczyk"
  - "Patryk Rygiel"
conference_year: 2022
sources:
  - "https://doi.org/10.1007/978-3-031-21014-3_33"
figure:
  src: "/images/research/coronary-ostia.png"
  alt: "A residual U-Net predicts heatmaps and a DSNT layer converts them into coronary ostium coordinates, trained against annotated CT scans."
  caption: "The residual U-Net predicts landmark heatmaps and a 3D DSNT layer converts them to coordinates. Method diagram reproduced from the authors’ ML in PL 2022 poster."
  source_url: "https://docs.mlinpl.org/conference/2022/cfc/posters/poster_23.pdf"
  source_label: "Method diagram · Gajowczyk et al. (2022), conference poster"
  credit: "Gajowczyk, Rygiel et al. · authors’ ML in PL 2022 poster"
  width: 2200
  height: 1058
---

## From an image volume to landmark coordinates

The method learns a heatmap for the coronary origins and converts that spatial distribution into coordinates with a differentiable spatial-to-numerical transform. This provides a single trainable pipeline for landmark localization.

The study evaluates localization on coronary and aortic CT angiography datasets. Miłosz Gajowczyk and Patryk Rygiel contributed equally.

Presented at the MLMI workshop held with MICCAI 2022 in Singapore.
