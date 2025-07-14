// Create simple colored square PNGs as placeholders
const fs = require('fs');
const path = require('path');

// Simple 1x1 purple pixel as base64
const purplePixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

// For a real extension, you'd want proper icons. These are just placeholders.
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const filename = path.join(__dirname, `icon-${size}.png`);
  fs.writeFileSync(filename, Buffer.from(purplePixel, 'base64'));
  console.log(`Created placeholder ${filename}`);
});