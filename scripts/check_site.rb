# frozen_string_literal: true
# Check the actual built output: bibliography coverage, routes, links, and metadata.
require 'nokogiri'
require 'yaml'
require 'json'
require 'uri'
require 'date'
Encoding.default_external = Encoding::UTF_8
root = File.expand_path('..', __dir__)
site = File.join(root, ARGV[0] || '_site')
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
%w[Patryk_Rygiel_CV.pdf _planning files/paper1.pdf portfolio teaching year-archive markdown].each do |private_path|
  errors << "Unexpected template/private output: #{private_path}" if File.exist?(File.join(site, private_path))
end
if errors.any?
  warn errors.uniq.join("\n")
  abort "Site validation failed with #{errors.uniq.size} issues."
end
puts "Verified #{papers.size} publication pages, complete BibTeX exports, #{html_files.size} HTML routes, all internal links/anchors, metadata, and template exclusions."
