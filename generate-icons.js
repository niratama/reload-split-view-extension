/**
 * Script to generate extension icons.
 * Assumes the user has downloaded a source "refresh" icon from Google Fonts
 * and placed it at `icons/refresh.svg`.
 *
 * It parses the source SVG, normalizes its viewBox to a standard 24x24 coordinate
 * system, combines two copies with staggered offsets (overlapping layout) to create
 * `icons/icon.svg`, and then renders high-quality transparent black PNGs.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const projectDir = __dirname;
const iconsDir = path.join(projectDir, 'icons');

// 1. Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

const originalSvgPath = path.join(iconsDir, 'refresh.svg');

// Default Material Symbols refresh SVG if the user hasn't downloaded one yet
const defaultOriginalSvg = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 126.5 27T718-698v-102h60v200H578v-60h104q-38-44-91.5-67T480-740q-109 0-184.5 75.5T220-480q0 109 75.5 184.5T480-220q92 0 161.5-55T731-420h61q-22 113-107.5 186.5T480-160Z"/></svg>`;

if (!fs.existsSync(originalSvgPath)) {
  console.log(`Source SVG not found at ${originalSvgPath}. Creating a default Google Fonts Material Symbols refresh icon...`);
  fs.writeFileSync(originalSvgPath, defaultOriginalSvg, 'utf8');
}

console.log(`Reading source SVG from: ${originalSvgPath}`);
const originalSvgContent = fs.readFileSync(originalSvgPath, 'utf8');

// 2. Parse viewBox from source SVG
const viewBoxRegex = /viewBox="([^"]+)"/;
const viewBoxMatch = originalSvgContent.match(viewBoxRegex);
let minX = 0, minY = 0, width = 24, height = 24;

if (viewBoxMatch) {
  const parts = viewBoxMatch[1].trim().split(/\s+/).map(Number);
  if (parts.length === 4) {
    [minX, minY, width, height] = parts;
    console.log(`Parsed original viewBox: minX=${minX}, minY=${minY}, width=${width}, height=${height}`);
  }
} else {
  console.warn('Warning: Could not parse viewBox. Defaulting to 0 0 24 24.');
}

// 3. Normalize source SVG inner content to 24x24 coordinate box starting at (0,0)
const targetSize = 24;
const scale = targetSize / Math.max(width, height);
// Translate to (0,0) and scale to 24x24
const normalizationTransform = `scale(${scale}) translate(${-minX}, ${-minY})`;

// Extract inner elements of the SVG (everything inside <svg>...</svg>)
let innerContent = originalSvgContent
  .replace(/<svg[^>]*>/i, '')
  .replace(/<\/svg>/i, '')
  .trim();

// Strip any hardcoded fill colors to allow fill inheritance from the parent <g>
innerContent = innerContent.replace(/\sfill="[^"]*"/gi, '');

// 4. Construct the overlapping double-refresh icon.svg
// Sized at 48x48. Overall bounding box of overlapping shapes is exactly 36x36 (75% size rules).
const combinedSvgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <!-- Group using black fill for the paths -->
  <g fill="#000000">
    <!-- Background / Bottom-left refresh icon (semi-transparent black) -->
    <g transform="translate(0, 12) scale(1.5)">
      <g transform="${normalizationTransform}" opacity="0.35">
        ${innerContent}
      </g>
    </g>
    <!-- Foreground / Top-right refresh icon (solid black) -->
    <g transform="translate(12, 0) scale(1.5)">
      <g transform="${normalizationTransform}">
        ${innerContent}
      </g>
    </g>
  </g>
</svg>`;

const outputSvgPath = path.join(iconsDir, 'icon.svg');
fs.writeFileSync(outputSvgPath, combinedSvgString, 'utf8');
console.log(`Successfully generated overlapping SVG: ${outputSvgPath} (${fs.statSync(outputSvgPath).size} bytes)`);

// 5. HTML content for browser rendering
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Icon Renderer</title>
  <style>
    body { margin: 0; padding: 0; background: transparent; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const svgString = \`${combinedSvgString.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    const sizes = [128, 48, 16];

    async function renderNext(index) {
      if (index >= sizes.length) {
        console.log('All sizes rendered. Notifying server...');
        await fetch('/done', { method: 'POST' });
        return;
      }
      
      const size = sizes[index];
      const canvas = document.getElementById('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, size, size);
      
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
      
      img.onload = async () => {
        ctx.drawImage(img, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/png');
        
        console.log(\`Sending size \${size}...\keys\`);
        await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ size, dataUrl })
        });
        
        renderNext(index + 1);
      };
      
      img.onerror = (err) => {
        console.error('Failed to load SVG image:', err);
      };
    }

    renderNext(0);
  </script>
</body>
</html>
`;

let chromeProcess = null;

// 6. Spin up rendering server
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
  } else if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { size, dataUrl } = JSON.parse(body);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const destPath = path.join(iconsDir, `icon-${size}.png`);
        
        fs.writeFileSync(destPath, base64Data, 'base64');
        console.log(`Successfully generated icon-${size}.png (${fs.statSync(destPath).size} bytes)`);
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Saved');
      } catch (err) {
        console.error('Failed to save icon:', err);
        res.writeHead(500);
        res.end('Error');
      }
    });
  } else if (req.method === 'POST' && req.url === '/done') {
    res.writeHead(200);
    res.end('OK');
    console.log('Rendering session completed successfully.');
    
    setTimeout(() => {
      if (chromeProcess) {
        try {
          chromeProcess.kill();
        } catch (e) {}
      }
      server.close(() => {
        console.log('Server stopped.');
        process.exit(0);
      });
    }, 500);
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Renderer server running at http://localhost:${PORT}`);
  
  // Launch Chrome pointing to local server
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const profileDir = path.join(projectDir, '.chrome-profile');
  const chromeCmd = `"${chromePath}" --headless=new --disable-gpu --user-data-dir="${profileDir}" http://localhost:${PORT}`;
  
  console.log('Launching headless Chrome to render icons...');
  chromeProcess = exec(chromeCmd, (err) => {
    if (err && !chromeProcess.killed) {
      console.error('Headless Chrome encountered an error:', err);
      server.close();
      process.exit(1);
    }
  });
});
