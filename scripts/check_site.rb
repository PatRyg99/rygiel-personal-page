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
errors << 'Original simulation volumes must not be published' if Dir[File.join(site, '**/*.vtu')].any?
demo_root = File.join(site, 'assets/data/abgatr-demo')
demo = JSON.parse(File.read(File.join(demo_root, 'manifest.json')))
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
puts "Built site: #{(site_bytes / 1024.0**2).round(2)} MiB; #{((1_000_000_000 - site_bytes) / 1024.0**2).round(2)} MiB available within the Pages budget."
