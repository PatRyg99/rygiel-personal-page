# frozen_string_literal: true
# Run with: ruby -EUTF-8 scripts/prepare_photography.rb
# Requires ImageMagick (magick). Originals are never overwritten.
require 'yaml'
require 'fileutils'
require 'open3'

root = File.expand_path('..', __dir__)
data_path = File.join(root, '_data/photography.yml')
photos = YAML.safe_load(File.read(data_path))
output_dir = File.join(root, 'images/gallery')
FileUtils.mkdir_p(output_dir)
abort 'Install ImageMagick to prepare the photographs (magick was not found).' unless system('magick', '-version', out: File::NULL)
seen = []
photos.each do |photo|
  file = photo.fetch('file')
  abort "Invalid or duplicate photograph filename: #{file}" unless file.match?(/\A[A-Za-z0-9_-]+\.(?:jpe?g|png)\z/i) && !seen.include?(file)
  seen << file
  abort "Add an image description for #{file}." if photo['alt'].to_s.strip.empty?
  %w[region place country year].each do |field|
    abort "Add #{field} for #{file}." if photo[field].to_s.strip.empty?
  end
  source = File.join(root, 'images/photography', file)
  abort "Missing original: #{source}" unless File.file?(source)
  stem = File.basename(file, '.*')
  [800, 2048].each do |size|
    output = File.join(output_dir, "#{stem}-#{size}.jpg")
    next if File.file?(output) && File.mtime(output) >= File.mtime(source)
    success = system('magick', source, '-auto-orient', '-resize', "#{size}x#{size}>", '-strip', '-quality', size == 800 ? '82' : '86', output)
    abort "Could not prepare #{file}." unless success
  end
  dimensions, status = Open3.capture2('magick', 'identify', '-format', '%w %h', File.join(output_dir, "#{stem}-2048.jpg"))
  abort "Could not read dimensions for #{file}." unless status.success?
  photo['width'], photo['height'] = dimensions.split.map(&:to_i)
  thumbnail_dimensions, status = Open3.capture2('magick', 'identify', '-format', '%w', File.join(output_dir, "#{stem}-800.jpg"))
  abort "Could not read thumbnail dimensions for #{file}." unless status.success?
  photo['thumbnail_width'] = thumbnail_dimensions.to_i
end
header = "# Photos are grouped by year and region; the first data entry is featured within its region.\n"
File.write(data_path, header + YAML.dump(photos).sub(/\A---\n/, ''))
puts "Prepared #{photos.size} photographs at 800px and 2048px. Originals unchanged."
