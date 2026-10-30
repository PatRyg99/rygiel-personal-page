# frozen_string_literal: true
# Check the actual built output: bibliography coverage, routes, links, and metadata.
require 'nokogiri'
require 'yaml'
require 'json'
require 'uri'
require 'date'
Encoding.default_external = Encoding::UTF_8
root = File.expand_path('..', __dir__)
site = File.expand_path(ARGV[0] || '_site', root)
config = YAML.safe_load(File.read(File.join(root, '_config.yml')))
base = config.fetch('baseurl', '')
errors = []
papers = Dir[File.join(root, '_publications', '*.md')].map do |path|
  YAML.safe_load(File.read(path).split(/^---\s*$/)[1], permitted_classes: [Date, Time])
end
archive = Nokogiri::HTML(File.read(File.join(site, 'publications/index.html')))
listed = archive.css('[data-publication] h3 a').map { |node| node['href'] }
expected = papers.map { |paper| base + paper['permalink'] }
errors << 'The publication archive does not contain every work exactly once' unless listed.sort == expected.sort
# Check affiliation coverage and counts against the actual rendered map and archive.
affiliations = YAML.safe_load(File.read(File.join(root, '_data/publication_affiliations.yml')))
mapped = affiliations.fetch('papers')
excluded = affiliations.fetch('excluded')
slugs = papers.map { |paper| paper.fetch('slug') }
errors << 'Every publication needs an affiliation audit or an explicit exclusion' unless (mapped.keys + excluded.keys).sort == slugs.sort
country_codes = affiliations.fetch('countries').map { |country| country.fetch('code') }
errors << 'Duplicate affiliation country definitions' unless country_codes.uniq == country_codes
mapped.each do |slug, record|
  codes = record.fetch('countries')
  evidence = record.fetch('evidence')
  errors << "Duplicate or unknown affiliation countries: #{slug}" unless codes.uniq == codes && (codes - country_codes).empty?
  errors << "Affiliation countries do not match institution evidence: #{slug}" unless evidence.map { |item| item['code'] }.sort == codes.sort
  errors << "Missing affiliation source: #{slug}" unless record['source_url']&.start_with?('https://') && record['source_section']
  evidence.each do |item|
    names = item.fetch('institutions')
    errors << "Empty or duplicate institutions: #{slug}/#{item['code']}" if names.empty? || names.uniq != names
  end
end
country_codes.each do |code|
  count = mapped.values.count { |record| record['countries'].include?(code) }
  selectors = archive.css("[data-country-select='#{code}']")
  errors << "Missing or incorrect map country count: #{code}" unless count.positive? && selectors.size == 1 && selectors.all? { |node| node['data-country-count'].to_i == count }
end
archive.css('[data-publication]').each do |node|
  paper = papers.find { |record| base + record['permalink'] == node.at_css('h3 a')['href'] }
  codes = mapped.dig(paper['slug'], 'countries') || []
  errors << "Incorrect country filter metadata: #{paper['slug']}" unless node['data-countries'].split.sort == codes.sort
end
errors << 'Missing public affiliation sources' unless archive.css('[data-affiliation-source]').map { |node| node['data-affiliation-source'] }.sort == mapped.keys.sort
bib = File.read(File.join(site, 'files/publications.bib'))
errors << 'The complete bibliography has a missing or duplicate entry' unless bib.scan(/^@\w+\{/).size == papers.size
papers.each do |paper|
  page = File.join(site, paper['permalink'], 'index.html')
  unless File.file?(page)
    errors << "Missing paper page: #{paper['slug']}"
    next
  end
  doc = Nokogiri::HTML(File.read(page))
  citation = doc.at_css('#bibtex')&.text&.strip
  download = File.join(site, 'files/bibtex', "#{paper['slug']}.bib")
  errors << "Citation and download differ: #{paper['slug']}" unless File.file?(download) && File.read(download).strip == citation
  errors << "No summary: #{paper['slug']}" unless doc.at_css('.paper-content')&.text&.strip&.length.to_i > 50
end
html_files = Dir[File.join(site, '**/*.html')]
html_files.each do |path|
  doc = Nokogiri::HTML(File.read(path))
  relative = path.delete_prefix(site)
  # Jekyll's redirect pages have their own small markup.
  unless doc.at_css('meta[http-equiv="refresh"]')
    errors << "Expected one H1: #{relative}" unless doc.css('h1').size == 1
    errors << "Missing canonical URL: #{relative}" unless doc.at_css('link[rel="canonical"]')
    errors << "Missing description: #{relative}" unless doc.at_css('meta[name="description"]')
  end
  doc.css('script[type="application/ld+json"]').each do |node|
    begin
      JSON.parse(node.text)
    rescue JSON::ParserError
      errors << "Invalid structured metadata: #{relative}"
    end
  end
  ids = doc.css('[id]').map { |node| node['id'] }
  errors << "Duplicate element IDs: #{relative}" unless ids.uniq.size == ids.size
  doc.css('img').each { |img| errors << "Missing image alternative: #{relative}" unless img.key?('alt') }
  doc.css('a[href], img[src], script[src], link[href]').each do |node|
    href = node['href'] || node['src']
    if href.empty?
      errors << "Empty link: #{relative}"
      next
    end
    next if href.match?(/\A(?:https?:|mailto:|tel:|data:|\/\/)/)
    begin
      uri = URI.parse(href)
      local_path = uri.path
      if local_path.empty?
        target = path
      elsif local_path.start_with?('/')
        unless base.empty? || local_path == base || local_path.start_with?(base + '/')
          errors << "Link ignores baseurl: #{relative} -> #{href}"
          next
        end
        target = File.join(site, local_path.delete_prefix(base))
      else
        target = File.expand_path(local_path, File.dirname(path))
      end
      target = File.join(target, 'index.html') if File.directory?(target)
      unless File.file?(target)
        errors << "Broken local link: #{relative} -> #{href}"
        next
      end
      if uri.fragment && !uri.fragment.empty? && target.end_with?('.html')
        destination = target == path ? doc : Nokogiri::HTML(File.read(target))
        errors << "Missing fragment: #{relative} -> #{href}" unless destination.css('[id]').any? { |n| n['id'] == URI.decode_www_form_component(uri.fragment) }
      end
    rescue URI::InvalidURIError
      errors << "Malformed link: #{relative} -> #{href}"
    end
  end
  errors << "Template content remains: #{relative}" if doc.text.match?(/Your Sidebar Name|Paper Title Number|GitHub Journal of Bugs|Red Brick University/)
end
%w[Patryk_Rygiel_CV.pdf _planning files/paper1.pdf images/photography portfolio teaching year-archive markdown].each do |private_path|
  errors << "Unexpected template/private output: #{private_path}" if File.exist?(File.join(site, private_path))
end
errors << 'Original simulation meshes must not be published' if Dir[File.join(site, '**/*.{vtu,vtp}')].any?
demo_root = File.join(site, 'assets/data/abgatr-demo')
demo = JSON.parse(File.read(File.join(demo_root, 'manifest.json')))
metrics = JSON.parse(File.read(File.join(demo_root, 'metrics.json')))
errors << 'Unexpected viewer error metric definition' unless metrics['version'] == 4 &&
  metrics['definition'] == '100 * norm(GT - prediction) / norm(GT)' &&
  metrics['zeroReferencePolicy'] == 'include zero-GT prediction errors'
errors << 'Viewer error metrics must cover exactly the published samples' unless metrics.fetch('samples').keys.sort == demo['samples'].map { |sample| sample['id'] }.sort
errors << 'Demo velocity units must be cm/s' unless demo['units'] == 'cm/s'
demo_datasets = { 'aneumo' => %w[777 832 845], 'synthbifcor' => %w[1815 1847 1962], 'aaa-100' => %w[AAA021-T AAA048-T AAA090-T] }
errors << 'Demo datasets are incomplete' unless demo['datasets'].map { |dataset| dataset['id'] }.sort == demo_datasets.keys.sort
demo_datasets.each do |dataset, ids|
  samples = demo['samples'].select { |sample| sample['dataset'] == dataset }
  actual_ids = samples.map { |sample| sample['id'] }
  valid = dataset == 'aaa-100' ? (ids - actual_ids).empty? && actual_ids.all? { |id| id.match?(/\AAAA\d+-T\z/) } : actual_ids.sort == ids.sort
  errors << "Demo samples are incomplete: #{dataset}" unless valid && actual_ids.uniq == actual_ids
end
aaa = demo['datasets'].find { |dataset| dataset['id'] == 'aaa-100' }
errors << 'AAA-100 must identify its time-resolved data' unless aaa && aaa['timeResolved'] && !aaa['timeAveraged']
%w[AAA021 AAA048 AAA090].each do |old_sample|
  errors << "Obsolete static AAA geometry is still published: #{old_sample}" if File.directory?(File.join(demo_root, old_sample))
end
demo['samples'].each do |sample|
  record = metrics.fetch('samples').fetch(sample['id'])
  frames = sample.fetch('timeSteps', 1)
  errors << "Stale error metrics: #{sample['id']}" unless record['sourceSha256'] == sample['source']['sha256'] && record['frameCount'] == frames
  errors << "Incomplete error metric models: #{sample['id']}" unless record.fetch('models').keys.sort == demo['models'].map { |model| model['id'] }.sort
  check_metric = lambda do |values, counts, scope, expected_frames = frames|
    valid_counts = counts.is_a?(Array) && counts.length == expected_frames && counts.all? { |count| count.is_a?(Integer) && count >= 0 }
    valid_values = values.is_a?(Array) && values.length == expected_frames && valid_counts && values.each_with_index.all? do |value, index|
      counts[index].zero? ? value.nil? : value.is_a?(Numeric) && value.finite? && value >= 0
    end
    errors << "Invalid relative error percentages or reference counts: #{sample['id']}/#{scope}" unless valid_values
  end
  counts = record.fetch('counts').fetch('volume')
  reference_norms = record.fetch('volumeReferenceNorms')
  valid_norms = lambda do |values|
    values.is_a?(Array) && values.length == frames && values.all? { |value| value.is_a?(Numeric) && value.finite? && value >= 0 }
  end
  reference_valid = valid_norms.call(reference_norms) && reference_norms.each_with_index.all? { |value, index| counts[index].zero? ? value.zero? : value.positive? }
  errors << "Invalid reference L2 norms: #{sample['id']}" unless reference_valid
  norm = ->(values) { values.reduce(0.0) { |total, value| Math.hypot(total, value) } }
  close = ->(actual, expected) { actual.is_a?(Numeric) && actual.finite? && (actual - expected).abs <= 1e-12 * [1, expected].max }
  errors << "Incorrect space-time reference count: #{sample['id']}" unless record.dig('counts', 'volumeAllFrames') == counts.sum
  record.fetch('models').each do |model, values|
    check_metric.call(values['volume'], counts, "#{model}/volume")
    check_metric.call([values['volumeRelativeL2']], [counts.sum], "#{model}/space-time", 1)
    error_norms = values.fetch('volumeErrorNorms')
    errors_valid = valid_norms.call(error_norms)
    errors << "Invalid error L2 norms: #{sample['id']}/#{model}" unless errors_valid
    if reference_valid && errors_valid
      reference_norms.each_with_index do |reference, index|
        next if reference.zero?
        expected = 100 * error_norms[index] / reference
        errors << "Incorrect per-frame L2 ratio: #{sample['id']}/#{model}/#{index}" unless close.call(values['volume'][index], expected)
      end
      reference = norm.call(reference_norms)
      expected = reference.positive? ? 100 * norm.call(error_norms) / reference : nil
      matches = expected.nil? ? values['volumeRelativeL2'].nil? : close.call(values['volumeRelativeL2'], expected)
      errors << "Incorrect full-volume L2 ratio: #{sample['id']}/#{model}" unless matches
    end
    %w[x y z].each do |axis|
      slices = values.fetch('slices').fetch(axis)
      slice_counts = record.fetch('counts').fetch('slices').fetch(axis)
      errors << "Incomplete relative error slices: #{sample['id']}/#{model}/#{axis}" unless slices.length == sample['slices'][axis].length && slice_counts.length == slices.length
      slice_reference_norms = record.fetch('sliceReferenceNorms').fetch(axis)
      slice_error_norms = values.fetch('sliceErrorNorms').fetch(axis)
      aggregates = values.fetch('slicesRelativeL2').fetch(axis)
      errors << "Incomplete slice norm provenance: #{sample['id']}/#{model}/#{axis}" unless [slice_reference_norms, slice_error_norms, aggregates].all? { |entries| entries.length == slices.length }
      slices.each_with_index do |slice, index|
        label = "#{sample['id']}/#{model}/#{axis}/#{index}"
        check_metric.call(slice, slice_counts[index], label)
        check_metric.call([aggregates[index]], [slice_counts[index].sum], "#{label}/space-time", 1)
        references = slice_reference_norms[index]
        residuals = slice_error_norms[index]
        slice_reference_valid = valid_norms.call(references) && references.each_with_index.all? { |value, frame| slice_counts[index][frame].zero? ? value.zero? : value.positive? }
        unless slice_reference_valid && valid_norms.call(residuals)
          errors << "Invalid slice norm provenance: #{label}"
          next
        end
        references.each_with_index do |reference, frame|
          next if reference.zero?
          errors << "Incorrect slice L2 ratio: #{label}/#{frame}" unless close.call(slice[frame], 100 * residuals[frame] / reference)
        end
        reference = norm.call(references)
        expected = reference.positive? ? 100 * norm.call(residuals) / reference : nil
        matches = expected.nil? ? aggregates[index].nil? : close.call(aggregates[index], expected)
        errors << "Incorrect full-cycle slice L2 ratio: #{label}" unless matches
      end
    end
  end
  assets = [sample['shell']] + sample['slices'].values.flatten
  if sample['dataset'] == 'aaa-100'
    errors << 'AAA-100 needs all 21 timesteps' unless sample['timeSteps'] == 21 && !sample['timeAveraged'] && %w[xor-float32-v1 uint16-delta-v1].include?(sample['seriesEncoding'])
    %w[x y z].each do |axis|
      entries = sample.fetch('series').fetch(axis)
      errors << "Temporal slices differ from geometry: #{axis}" unless entries.length == sample['slices'][axis].length
      entries.each do |series|
        errors << 'Temporal model coverage is incomplete' unless series['models'].keys.sort == demo['models'].map { |model| model['id'] }.sort
        assets += [series['gt']] + series['models'].values
      end
    end
  end
  assets.each { |asset| errors << "Missing prepared geometry: #{asset}" unless asset && File.file?(File.join(demo_root, asset)) }
end
references = JSON.parse(File.read(File.join(root, 'scripts/fixtures/aaa-relative-l2.json'))).fetch('samples')
references.each do |sample_id, reference|
  record = metrics.fetch('samples').fetch(sample_id)
  errors << "AAA reference source changed: #{sample_id}" unless record['sourceSha256'] == reference['sourceSha256']
  reference.fetch('ratios').each do |model, expected|
    actual = record.fetch('models').fetch(model)['volumeRelativeL2']
    errors << "L2 ratio differs from supplied reference: #{sample_id}/#{model}" unless actual.is_a?(Numeric) && (actual / 100.0).round(6) == expected
  end
end
wss_root = File.join(site, 'assets/data/wss-demo')
wss = JSON.parse(File.read(File.join(wss_root, 'manifest.json')))
errors << 'WSS viewer must convert dyn/cm² to Pa' unless wss['version'] == 2 && wss['units'] == 'Pa' && wss['sourceUnits'] == 'dyn/cm²' && wss['unitScale'] == 0.1
errors << 'WSS examples must use LaB-GATr' unless wss['model'] == 'LaB-GATr'
expected_challenges = { 'topology' => %w[base extended], 'boundary-conditions' => %w[base boundary-1], 'remodelling' => %w[p6-earlier p6-later] }
errors << 'WSS generalisation challenges are incomplete' unless wss.fetch('challenges').map { |challenge| challenge['id'] }.sort == expected_challenges.keys.sort
wss['challenges'].each do |challenge|
  cases = challenge['cases'].map { |item| item['sample'] }
  valid = cases == expected_challenges[challenge['id']] && cases.all? { |id| wss['samples'].any? { |sample| sample['id'] == id } } &&
    %w[wss error].all? { |key| challenge['displayRanges'][key][0] == 0 && challenge['displayRanges'][key][1].is_a?(Numeric) && challenge['displayRanges'][key][1] > 0 }
  errors << "Invalid WSS challenge: #{challenge['id']}" unless valid
end
wss['samples'].each do |sample|
  %w[geometry vectors].each do |key|
    errors << "Missing WSS #{key}: #{sample['id']}" unless File.file?(File.join(wss_root, sample.fetch(key)))
  end
  valid = sample['frameCount'] == 21 && sample['metrics']['relativeL2'].length == 21 &&
    sample['metrics']['relativeL2'].all? { |value| value.is_a?(Numeric) && value.finite? && value >= 0 } &&
    sample['metrics']['relativeL2AllFrames'].is_a?(Numeric)
  errors << "Incomplete WSS heart-cycle metrics: #{sample['id']}" unless valid
end
wss_page = Nokogiri::HTML(File.read(File.join(site, 'publications/wall-shear-stress-aaa/index.html')))
errors << 'WSS viewer is missing from its publication page' unless wss_page.at_css('[data-wss-demo]')
errors << 'WSS challenge selector is missing' unless wss_page.at_css('[data-wss-challenge]')
%w[wss-viewer.js wss-loader.js wss-codec.js viewer-palettes.js].each do |asset|
  errors << "Missing WSS viewer module: #{asset}" unless File.file?(File.join(site, 'assets/js', asset))
end
%w[three.module.min.js three.core.min.js OrbitControls.js LICENSE].each do |asset|
  errors << "Missing local viewer dependency: #{asset}" unless File.file?(File.join(site, 'assets/js/vendor/three', asset))
end
site_bytes = Dir[File.join(site, '**/*')].sum { |path| File.file?(path) ? File.size(path) : 0 }
errors << 'Built site exceeds the conservative 1,000,000,000-byte GitHub Pages budget' if site_bytes > 1_000_000_000
if errors.any?
  warn errors.uniq.join("\n")
  abort "Site validation failed with #{errors.uniq.size} issues."
end
puts "Verified #{papers.size} publication pages, complete BibTeX exports, #{html_files.size} HTML routes, all internal links/anchors, metadata, and template exclusions."
puts 'Viewer metrics match all 18 supplied AAA reference ratios to six decimal places.'
puts "Built site: #{(site_bytes / 1024.0**2).round(2)} MiB; #{((1_000_000_000 - site_bytes) / 1024.0**2).round(2)} MiB available within the Pages budget."
