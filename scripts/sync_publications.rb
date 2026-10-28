# frozen_string_literal: true
# Generate tiny Jekyll wrappers; all citation content stays in publication metadata.
require 'yaml'
require 'date'
require 'fileutils'
Encoding.default_external = Encoding::UTF_8
root = File.expand_path('..', __dir__)
records = Dir[File.join(root, '_publications', '*.md')].map do |path|
  data = YAML.safe_load(File.read(path).split(/^---\s*$/)[1], permitted_classes: [Date, Time])
  abort "Missing metadata in #{path}" unless data.is_a?(Hash)
  %w[title slug permalink authors publication_year type status summary resources bibtex_key].each do |key|
    abort "Missing #{key}: #{path}" if data[key].nil? || data[key].respond_to?(:empty?) && data[key].empty?
  end
  abort "Unsafe slug in #{path}" unless data['slug'].match?(/\A[a-z0-9-]+\z/)
  data
end
%w[slug permalink bibtex_key doi arxiv].each do |key|
  values = records.map { |p| p[key] }.compact
  abort "Duplicate #{key}" unless values.uniq.size == values.size
end
folder = File.join(root, '_pages', 'bibtex')
FileUtils.mkdir_p(folder)
records.each do |paper|
  slug = paper.fetch('slug')
  File.write(File.join(folder, "#{slug}.bib"), <<~BIB)
    ---
    layout: null
    permalink: /files/bibtex/#{slug}.bib
    sitemap: false
    ---
    {% assign paper = site.publications | where: 'slug', '#{slug}' | first %}{% include bibtex-entry.txt paper=paper %}
  BIB
end
# Remove obsolete generated wrappers when a publication is renamed or merged.
valid = records.map { |p| "#{p['slug']}.bib" }
Dir[File.join(folder, '*.bib')].each do |path|
  File.delete(path) unless valid.include?(File.basename(path))
end
puts "Validated #{records.size} publications and synchronized citation downloads."
