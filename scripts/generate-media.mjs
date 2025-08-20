#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
let sourceFile;
let outputFile;
let outputType = 'webm'; // webm or svg
let port = 5173;
let speed = 1; // Animation speed multiplier

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source-file' && args[i + 1]) {
    sourceFile = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFile = args[i + 1];
    i++;
  } else if (args[i] === '--type' && args[i + 1]) {
    outputType = args[i + 1].toLowerCase();
    i++;
  } else if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--speed' && args[i + 1]) {
    speed = parseFloat(args[i + 1]);
    i++;
  }
}

if (!sourceFile) {
  console.error('Usage: pnpm generate-webm --source-file path/to/file.excalidraw [--output path/to/output.webm] [--type webm|svg] [--speed 1.0]');
  process.exit(1);
}

// Resolve paths
sourceFile = path.resolve(sourceFile);
if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

// Default output file based on input file
if (!outputFile) {
  const dir = path.dirname(sourceFile);
  const basename = path.basename(sourceFile, '.excalidraw');
  outputFile = path.join(dir, `${basename}.${outputType}`);
} else {
  outputFile = path.resolve(outputFile);
}

console.log(`📝 Source: ${sourceFile}`);
console.log(`🎬 Output: ${outputFile} (${outputType})`);
if (speed !== 1) {
  console.log(`⚡ Speed: ${speed}x`);
}

// Check if server is already running
async function isServerRunning(port) {
  try {
    const response = await fetch(`http://localhost:${port}`);
    return response.ok;
  } catch {
    return false;
  }
}

(async () => {
  let devServer;
  let serverStarted = false;

  try {
    // Check if dev server is already running
    const serverRunning = await isServerRunning(port);
    
    if (!serverRunning) {
      // Start dev server in background
      console.log('🚀 Starting development server...');
      devServer = spawn('pnpm', ['dev'], {
        cwd: process.cwd(),
        detached: false,
        stdio: 'pipe'
      });

      // Wait for server to start
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 30000);
        
        devServer.stdout?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Local:') || output.includes('http://localhost')) {
            clearTimeout(timeout);
            serverStarted = true;
            console.log('✅ Server started');
            resolve();
          }
        });

        devServer.stderr?.on('data', (data) => {
          console.error('Server error:', data.toString());
        });
      });

      // Give server a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('✅ Using existing dev server');
    }

    // Launch browser
    console.log('🌐 Launching browser...');
    const browser = await chromium.launch({
      headless: outputType === 'svg', // Can be headless for SVG export
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ...(outputType === 'webm' && {
        recordVideo: {
          dir: path.dirname(outputFile),
          size: { width: 1280, height: 720 }
        }
      })
    });

    const page = await context.newPage();

    // Navigate to the app with the file path, headless mode, and speed
    console.log('📊 Loading animation...');
    const url = `http://localhost:${port}/#file=${encodeURIComponent(sourceFile)}&headless=true&speed=${speed}`;
    await page.goto(url);

    // Wait for SVG to load
    await page.waitForSelector('svg', { timeout: 15000 });
    console.log('✅ Animation loaded');
    
    // Wait a bit for animations to be injected
    await page.waitForTimeout(1000);

    // Get animation duration
    const animationInfo = await page.evaluate(() => {
      const svgElements = document.querySelectorAll('svg');
      let maxDuration = 0;
      let svgCount = svgElements.length;
      let animationCount = 0;
      
      svgElements.forEach((svg) => {
        // Check for animation elements
        const animateElements = svg.querySelectorAll('animate, animateMotion, animateTransform');
        animationCount += animateElements.length;
        
        animateElements.forEach((animate) => {
          const beginStr = animate.getAttribute('begin') || '0';
          const durStr = animate.getAttribute('dur') || '0';
          
          // Parse values (handle 'ms' suffix)
          const begin = parseFloat(beginStr.replace('ms', ''));
          const dur = parseFloat(durStr.replace('ms', ''));
          
          maxDuration = Math.max(maxDuration, begin + dur);
        });
        
        // Also check SVG's duration if set
        if (svg.getCurrentTime) {
          try {
            // Try to get total animation duration from SVG
            const svgDuration = svg.getTotalLength ? svg.getTotalLength() : 0;
            if (svgDuration > maxDuration) {
              maxDuration = svgDuration;
            }
          } catch (e) {
            // Ignore if method doesn't exist
          }
        }
      });
      
      // Default to 5 seconds if no animations found
      if (maxDuration === 0 && svgCount > 0) {
        maxDuration = 5000;
      }
      
      return { duration: maxDuration, count: svgCount, animations: animationCount };
    });

    console.log(`⏱️  Animation duration: ${animationInfo.duration}ms (${animationInfo.count} SVG(s), ${animationInfo.animations} animations)`);

    if (outputType === 'svg') {
      // Export SVG
      console.log('💾 Exporting SVG...');
      
      // Click export button or directly get SVG content
      const svgContent = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        if (!svg) throw new Error('No SVG found');
        
        // Reset animation to beginning
        svg.setCurrentTime(0);
        
        // Serialize the SVG
        return new XMLSerializer().serializeToString(svg);
      });

      fs.writeFileSync(outputFile, svgContent);
      console.log(`✅ SVG saved to: ${outputFile}`);
      
    } else if (outputType === 'webm') {
      // Check if animation needs to be started
      const needsClick = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        return svg && svg.getAttribute('style')?.includes('cursor: pointer');
      });

      if (needsClick) {
        console.log('▶️  Starting animation...');
        await page.click('svg');
      }

      // Wait for animation to complete (with some buffer)
      const recordDuration = animationInfo.duration + 2000;
      console.log(`🎥 Recording for ${recordDuration}ms...`);
      await page.waitForTimeout(recordDuration);

      // Close context to save video
      console.log('💾 Saving video...');
      await context.close();

      // Wait a bit for video to be written
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find and rename the video file
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
    }

    await browser.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    // Kill dev server if we started it
    if (devServer && serverStarted) {
      console.log('🛑 Stopping server...');
      devServer.kill();
      // Give it time to clean up
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    process.exit(0);
  }
})();