Jekyll::Hooks.register :site, :post_write do |site|
  css_path = File.join(site.dest, 'assets/css/main.css')
  raise "Missing CSS file" unless File.exist?(css_path)
end