---
layout: "publication"
title: "When Does Equivariance Help? Canonical Alignment in Neural Fluid Surrogates"
slug: "abgatr"
permalink: "/publications/abgatr/"
authors:
  - "Patryk Rygiel"
  - "Julian Suk"
  - "Kak Khee Yeung"
  - "Christoph Brune"
  - "Jelmer M. Wolterink"
publication_year: 2026
date: "2026-09-28"
date_precision: "day"
venue: "arXiv"
type: "preprint"
status: "Preprint"
topics:
  - "geometry"
  - "surrogates"
featured: true
project_page: true
summary: "When should a fluid surrogate preserve geometric symmetries? AB-GATr studies the role of equivariance and orientation distributions while predicting coupled surface and volume fields."
bibtex_type: "misc"
bibtex_key: "abgatr2026"
resources:
  - label: "DOI"
    url: "https://doi.org/10.48550/arXiv.2605.18816"
  - label: "Code"
    url: "https://github.com/PatRyg99/abgatr"
  - label: "Paper"
    url: "https://arxiv.org/abs/2605.18816"
  - label: "PDF"
    url: "https://arxiv.org/pdf/2605.18816"
first_online: "2026-05-12"
modified: "2026-09-28"
arxiv: "2605.18816"
doi: "10.48550/arXiv.2605.18816"
previous_titles:
  - "Symmetry in the Wild: The Role of Equivariance in Neural Fluid Surrogates"
feature_order: 1
sources:
  - "https://doi.org/10.48550/arXiv.2605.18816"
  - "https://arxiv.org/abs/2605.18816"
social_image: /images/research/abgatr-equivariance.png
related_publications:
  - active-learning
  - wall-shear-stress-aaa
  - vessel-segmentation
---

<p class="lead">Can a model learn the physics of blood flow without relearning it for every orientation? AB-GATr explores how geometric symmetry and the way data is aligned affect neural fluid surrogates.</p>

<figure class="research-figure">
  <a href="{{ '/images/research/abgatr-equivariance.png' | relative_url }}"><img src="{{ '/images/research/abgatr-equivariance.png' | relative_url }}" width="2046" height="815" alt="CFD reference and model predictions for a rotated vessel, comparing the equivariant AB-GATr with the non-equivariant AB-UPT." loading="eager"></a>
  <figcaption>Predictions under changes in vessel orientation. The comparison illustrates the consistency that explicit equivariance brings to this example. Figure 1, Rygiel et al., <a href="https://arxiv.org/abs/2605.18816v2">arXiv v2</a>, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>. Select any figure to view it at full resolution.</figcaption>
</figure>

## Why geometry matters

Computational fluid dynamics provides detailed physical simulations, but generating enough examples to train a neural surrogate is expensive. Symmetry offers a useful prior: changing the orientation of a vessel should transform its predicted flow consistently. Yet training datasets may have preferred orientations, making the benefit of that prior task-dependent.

## The Anchored-Branched Geometric Algebra Transformer

AB-GATr combines sparse geometric anchors with connected branches for surface and volume quantities. Its geometric algebra representation preserves E(3) equivariance while the branched architecture handles different prediction targets, such as velocity within a vessel and shear stress at its wall.

<figure class="research-figure">
  <a href="{{ '/images/research/abgatr-architecture.png' | relative_url }}"><img src="{{ '/images/research/abgatr-architecture.png' | relative_url }}" width="1485" height="527" alt="AB-GATr architecture: surface and volume inputs, a shared attention body, and separate velocity and wall-shear-stress decoders." loading="lazy"></a>
  <figcaption>The encoder, attention body, and branched decoders. Figure 2, Rygiel et al., <a href="https://arxiv.org/abs/2605.18816v2">arXiv v2</a>, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>.</figcaption>
</figure>

## What we found

<div class="findings">
  <div class="finding"><h3>Symmetry helps blood-flow prediction</h3><p>Explicit equivariance improves performance across the evaluated hemodynamic benchmarks.</p></div>
  <div class="finding"><h3>Alignment changes the picture</h3><p>A controlled automotive experiment shows that strong canonical alignment can favor non-equivariant models.</p></div>
  <div class="finding"><h3>Augmentation is not equivalent</h3><p>Rotational augmentation does not consistently reproduce the benefits of an equivariant architecture.</p></div>
</div>

<figure class="research-figure">
  <a href="{{ '/images/research/abgatr-results.png' | relative_url }}"><img src="{{ '/images/research/abgatr-results.png' | relative_url }}" width="2041" height="574" alt="Reference and predicted velocity fields for SynthBifCor, ANEUMO, and AAA-100 vascular geometries, with color scales and example-specific relative errors." loading="lazy"></a>
  <figcaption>Example predictions across three vascular datasets; the AAA-100 example shows time-averaged flow. The displayed errors describe these examples, not aggregate benchmark scores. Figure 4, Rygiel et al., <a href="https://arxiv.org/abs/2605.18816v2">arXiv v2</a>, <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>.</figcaption>
</figure>

## Scope and reproducibility

The conclusions depend on the evaluated tasks and orientation distributions. They do not establish that equivariance is universally beneficial. The paper reports the experiments and limitations in detail.

The [official implementation](https://github.com/PatRyg99/abgatr) contains the model and instructions for running the experiments. For the vascular geometry dataset, see [AAA-100]({{ '/publications/aaa-100/' | relative_url }}).

## Manuscript history

- **28 September 2026:** revised manuscript under the current title, with extended alignment analysis.
- **12 May 2026:** first preprint, *Symmetry in the Wild: The Role of Equivariance in Neural Fluid Surrogates*.

This page follows the [September 2026 revision](https://arxiv.org/abs/2605.18816v2). Figures by Patryk Rygiel, Julian Suk, Kak Khee Yeung, Christoph Brune, and Jelmer M. Wolterink are reproduced unchanged.
