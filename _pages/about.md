---
layout: profile
title: Patryk Rygiel — AI for science and health
permalink: /
redirect_from:
  - /about/
  - /about.html
---
<section class="hero">
  <p class="eyebrow">Geometric deep learning · Scientific machine learning · Neural surrogates · Cardiovascular modelling</p>
  <h1>Geometric deep learning<br>for science and health.</h1>
  <p class="intro">I am a PhD candidate at the <a href="https://www.utwente.nl/en/eemcs/mia/">University of Twente</a>, working on geometric deep learning for science and health. I develop neural surrogates for complex physical simulations, with a focus on cardiovascular blood flow, generalization, and learning from limited data.</p>
  <p class="bio-secondary">My research is part of the EU Horizon project <a href="https://vascul-aid.eu/">VASCUL-AID</a>, supervised by <a href="https://scholar.google.com/citations?user=xzlXuWoAAAAJ">Dr. Jelmer Wolterink</a>, <a href="https://scholar.google.com/citations?user=QkD3WhsAAAAJ">Prof. Dr. Christoph Brune</a>, and <a href="https://www.amsterdamumc.org/en/research/researchers/kak-khee-yeung">Prof. Dr. Kak Khee Yeung</a>. I collaborate with Amsterdam UMC and TU Delft, and am a visiting PhD researcher at <a href="https://cimim.org/people/">CIMIM, University of Manchester</a>, with <a href="https://scholar.google.com/citations?user=9fGrB0sAAAAJ">Prof. Dr. Alejandro Frangi</a>.</p>
  <p class="bio-secondary">Previously, I worked on medical imaging at <a href="https://hemolens.com/">Hemolens Diagnostics</a> under <a href="https://scholar.google.com/citations?user=NOBU0BoAAAAJ">Dr. Tomasz Konopczyński</a> and was a visiting student at <a href="https://www.nvidia.com/">NVIDIA</a>. I earned my BSc in Algorithmic Computer Science and MSc in Artificial Intelligence at Wrocław University of Science and Technology, with both theses supervised by <a href="https://scholar.google.com/citations?user=XmOBJZYAAAAJ">Prof. Dr. Maciej Zięba</a>.</p>
  <p class="bio-secondary">I am a member of the <a href="https://conference.mlinpl.org/2026/#organizers">ML in PL Association</a> and a co-organizer of the <a href="https://www.logml.ai/people/team/patryk.html">London Geometry and Machine Learning Summer School (LOGML)</a>. Outside research, I enjoy climbing, skiing, hiking, and <a href="{{ '/photography/' | relative_url }}">photography</a>.</p>
</section>
{% assign flagship = site.publications | where: 'slug', 'abgatr' | first %}
<section class="feature" aria-labelledby="feature-title">
  <a class="feature-image" href="{{ flagship.url | relative_url }}" aria-label="Explore the AB-GATr project"><img src="{{ '/images/research/abgatr-equivariance.png' | relative_url }}" width="2046" height="815" alt="Figure 1: CFD reference and model predictions under vessel rotation, comparing equivariant AB-GATr with non-equivariant AB-UPT"></a>
  <p class="feature-credit">Figure 1: Rygiel et al., <a href="https://arxiv.org/abs/2605.18816v2">2026</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a></p>
  <div class="feature-body">
    <div class="feature-topline"><p class="eyebrow">Featured research <span class="eyebrow-dot">/</span> AB-GATr</p><span class="feature-year">2026</span></div>
    <h2 id="feature-title"><a href="{{ flagship.url | relative_url }}">When does equivariance help?</a></h2>
    <p>Learning fluid dynamics from geometry. We study how orientation and symmetry shape neural surrogate performance, and introduce a scalable geometric algebra transformer for coupled surface and volume predictions.</p>
    <div class="resource-links"><a class="resource-link primary" href="{{ flagship.url | relative_url }}">Explore the project <span aria-hidden="true">↗</span></a><a class="resource-link" href="{{ flagship.url | relative_url }}#aneumo-demo">3D viewer <span aria-hidden="true">↗</span></a><a class="resource-link" href="https://arxiv.org/abs/2605.18816">Read the paper <span aria-hidden="true">↗</span></a><a class="resource-link" href="https://github.com/PatRyg99/abgatr">Code <span aria-hidden="true">↗</span></a></div>
  </div>
</section>
<section class="content-section" aria-labelledby="research-title">
  <div class="section-heading"><h2 id="research-title">Research interests</h2></div>
  <div class="research-topics">
    <div><span class="topic-number">01</span><h3><a href="{{ '/publications/?topic=geometry' | relative_url }}">Geometry & symmetry</a></h3><p>Building inductive biases into learning on meshes, point clouds, and geometric structures.</p></div>
    <div><span class="topic-number">02</span><h3><a href="{{ '/publications/?topic=surrogates' | relative_url }}">Neural physics surrogates</a></h3><p>Making complex simulations efficient, scalable, and useful when training data is limited.</p></div>
    <div><span class="topic-number">03</span><h3><a href="{{ '/publications/?topic=imaging' | relative_url }}">Cardiovascular imaging</a></h3><p>Connecting medical images, vascular geometry, and patient-specific blood-flow modelling.</p></div>
  </div>
</section>
<section class="content-section" aria-labelledby="selected-title">
  <div class="section-heading"><div><p class="section-kicker">A few more things I work on</p><h2 id="selected-title">Selected publications</h2></div><a href="{{ '/publications/' | relative_url }}">All publications <span aria-hidden="true">↗</span></a></div>
  {% assign selected = site.publications | where: 'featured', true | sort: 'feature_order' %}
  {% for paper in selected %}{% unless paper.slug == 'abgatr' %}{% include publication-item.html paper=paper show_summary=true %}{% endunless %}{% endfor %}
</section>
<section class="content-section" aria-labelledby="news-title">
  <div class="section-heading"><h2 id="news-title">Recently</h2></div>
  <ul class="news-list">
    <li><time datetime="2026-10">Oct 2026</time><span>Co-organised ML in PL Conference 2026 and hosted  tutorial on <a href="https://conference.mlinpl.org/2026/program">physics neural surrogates for engineering and healthcare</a>, together with Julian Suk.</span></li>
    <li><time datetime="2026-09">Sep 2026</time><span><a href="https://arxiv.org/abs/2605.18816v2">AB-GATr preprint</a>: a closer look at canonical alignment and when equivariance helps.</span></li>
    <li><time datetime="2026-07">Jul 2026</time><span>Co-organized the <a href="https://www.logml.ai/people/team/patryk.html">London Geometry and Machine Learning Summer School</a> at Imperial College London as part of the speakers and mentors team.</span></li>
  </ul>
</section>
{% assign grants = site.data.cv.sections | where: 'id', 'grants' | first %}
<section id="grants" class="content-section" aria-labelledby="grants-title">
  <div class="section-heading"><h2 id="grants-title">Research grants</h2></div>
  <ul class="news-list">
    {% for grant in grants.items %}
    {% capture grant_name_link %}<a href="{{ grant.title_link_url | escape }}">{{ grant.title_link_text }}</a>{% endcapture %}
    <li><time datetime="{{ grant.period }}">{{ grant.period }}</time><span><strong>{% if grant.title_link_url %}{{ grant.title | replace_first: grant.title_link_text, grant_name_link }}{% else %}{{ grant.title }}{% endif %}</strong><br>{% if grant.organization_url %}<a href="{{ grant.organization_url | escape }}">{{ grant.organization }}</a>{% else %}{{ grant.organization }}{% endif %} · {{ grant.description }}</span></li>
    {% endfor %}
  </ul>
</section>
