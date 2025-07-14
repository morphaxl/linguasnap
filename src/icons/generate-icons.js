// Simple script to generate placeholder icons
// In a real project, you would create proper icons with a design tool

const fs = require('fs');
const path = require('path');

// Create a simple SVG icon
const createIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#gradient)"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}px" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">LS</text>
</svg>`;
};

// Generate icons
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svg = createIcon(size);
  const filename = path.join(__dirname, `icon-${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created ${filename}`);
});

console.log('Icons generated! Convert to PNG using an image editor or online tool.');