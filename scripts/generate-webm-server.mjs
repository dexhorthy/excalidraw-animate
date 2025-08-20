#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let sourceFile;
let outputFile;
let width = 1280;
let height = 720;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source-file' && args[i + 1]) {
    sourceFile = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFile = args[i + 1];
    i++;
  } else if (args[i] === '--width' && args[i + 1]) {
    width = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--height' && args[i + 1]) {
    height = parseInt(args[i + 1]);
    i++;
  }
}

if (!sourceFile) {
  console.error('Usage: pnpm generate-webm --source-file path/to/file.excalidraw [--output path/to/output.webm]');
  process.exit(1);
}

// Resolve paths
sourceFile = path.resolve(sourceFile);
if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

// Default output file
if (!outputFile) {
  const dir = path.dirname(sourceFile);
  const basename = path.basename(sourceFile, '.excalidraw');
  outputFile = path.join(dir, `${basename}.webm`);
} else {
  outputFile = path.resolve(outputFile);
}

console.log('📝 Source:', sourceFile);
console.log('🎬 Output:', outputFile);

// Read excalidraw data
const excalidrawData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));

// Create HTML page that loads the animation
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Excalidraw Animation</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: white;
    }
    #app {
      width: 100%;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    svg {
      max-width: 100%;
      max-height: 100%;
    }
  </style>
</head>
<body>
  <div id="app">Loading...</div>
  <script type="module">
    import { exportToSvg, restoreElements } from 'https://unpkg.com/@excalidraw/excalidraw@0.15.2/dist/excalidraw.production.min.js';
    
    // Excalidraw data embedded directly
    const excalidrawData = ${JSON.stringify(excalidrawData)};
    
    // Animation function (simplified version)
    function animateSvg(svg, elements) {
      const SVG_NS = "http://www.w3.org/2000/svg";
      let current = 1000; // 1 sec margin
      const groupDur = 3000;
      const individualDur = 300;
      
      // Simple opacity animation for all elements
      svg.querySelectorAll('g').forEach((g, index) => {
        g.setAttribute('opacity', '0');
        const animate = document.createElementNS(SVG_NS, 'animate');
        animate.setAttribute('attributeName', 'opacity');
        animate.setAttribute('from', '0');
        animate.setAttribute('to', '1');
        animate.setAttribute('begin', \`\${current + index * individualDur}ms\`);
        animate.setAttribute('dur', \`\${individualDur}ms\`);
        animate.setAttribute('fill', 'freeze');
        g.appendChild(animate);
      });
      
      return { finishedMs: current + (svg.querySelectorAll('g').length * individualDur) + 1000 };
    }
    
    async function loadAnimation() {
      try {
        const elements = restoreElements(excalidrawData.elements || [], null);
        const nonDeletedElements = elements.filter(el => !el.isDeleted);
        
        const svg = await exportToSvg({
          elements: nonDeletedElements,
          files: excalidrawData.files || {},
          appState: excalidrawData.appState || {},
          exportPadding: 30,
        });
        
        // Apply animations
        const result = animateSvg(svg, nonDeletedElements);
        
        // Replace content with SVG
        const app = document.getElementById('app');
        app.innerHTML = '';
        app.appendChild(svg);
        
        // Start animation
        svg.pauseAnimations();
        svg.setCurrentTime(0);
        svg.unpauseAnimations();
        
        console.log('Animation loaded, duration:', result.finishedMs);
        window.animationDuration = result.finishedMs;
      } catch (error) {
        console.error('Error loading animation:', error);
        document.getElementById('app').innerHTML = 'Error loading animation: ' + error.message;
      }
    }
    
    loadAnimation();
  </script>
</body>
</html>`;

// Start a temporary server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(htmlContent);
});

const PORT = 8765;
server.listen(PORT, async () => {
  console.log(`🚀 Temporary server running on http://localhost:${PORT}`);

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
      headless: false // Video recording requires non-headless
    });

    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: {
        dir: path.dirname(outputFile),
        size: { width, height }
      }
    });

    const page = await context.newPage();

    // Navigate to temporary page
    console.log('📊 Loading animation...');
    await page.goto(`http://localhost:${PORT}`);

    // Wait for animation to load
    await page.waitForFunction(() => window.animationDuration !== undefined, { timeout: 10000 });
    
    const duration = await page.evaluate(() => window.animationDuration);
    console.log(`⏱️  Animation duration: ${duration}ms`);

    // Record the animation
    console.log('🎥 Recording...');
    await page.waitForTimeout(duration + 1000);

    // Close to save video
    console.log('💾 Saving video...');
    await context.close();
    await browser.close();

    // Wait for video file
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find and rename video
    const videos = fs.readdirSync(path.dirname(outputFile))
      .filter(name => name.endsWith('.webm') && name !== path.basename(outputFile))
      .map(name => ({
        name,
        path: path.join(path.dirname(outputFile), name),
        mtime: fs.statSync(path.join(path.dirname(outputFile), name)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (videos.length > 0) {
      fs.renameSync(videos[0].path, outputFile);
      console.log(`✅ WebM saved to: ${outputFile}`);
    } else {
      console.error('❌ Video file not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    server.close();
    process.exit(0);
  }
});