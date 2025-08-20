#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let sourceFile: string | undefined;
let outputFile: string | undefined;
let duration: number = 10000; // Default 10 seconds
let width: number = 1280;
let height: number = 720;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source-file' && args[i + 1]) {
    sourceFile = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFile = args[i + 1];
    i++;
  } else if (args[i] === '--duration' && args[i + 1]) {
    duration = parseInt(args[i + 1]);
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
  console.error('Usage: pnpm generate-webm --source-file path/to/file.excalidraw [--output path/to/output.webm] [--duration ms] [--width px] [--height px]');
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
  outputFile = path.join(dir, `${basename}.webm`);
} else {
  outputFile = path.resolve(outputFile);
}

console.log('Generating WebM animation...');
console.log(`Source: ${sourceFile}`);
console.log(`Output: ${outputFile}`);
console.log(`Duration: ${duration}ms`);
console.log(`Resolution: ${width}x${height}`);

(async () => {
  // Read the excalidraw file
  const excalidrawData = fs.readFileSync(sourceFile, 'utf-8');
  
  // Start dev server in background
  console.log('Starting development server...');
  const { spawn } = await import('child_process');
  const devServer = spawn('pnpm', ['dev'], {
    cwd: path.join(__dirname, '..'),
    detached: false,
    stdio: 'pipe'
  });

  // Wait for server to start
  await new Promise<void>((resolve) => {
    devServer.stdout?.on('data', (data) => {
      if (data.toString().includes('Local:')) {
        console.log('Server started');
        resolve();
      }
    });
  });

  try {
    // Launch browser
    console.log('Launching browser...');
    const browser = await chromium.launch({
      headless: false // Video recording requires non-headless mode
    });
    
    const context = await browser.newContext({
      viewport: { width, height },
      recordVideo: {
        dir: path.dirname(outputFile),
        size: { width, height }
      }
    });

    const page = await context.newPage();

    // Navigate to the app with the excalidraw data
    console.log('Loading animation...');
    const encodedData = encodeURIComponent(excalidrawData);
    await page.goto(`http://localhost:5173/#json=${encodedData}`);

    // Wait for animation to load
    await page.waitForSelector('svg', { timeout: 10000 });
    
    // Get actual animation duration from the page
    const animationDuration = await page.evaluate(() => {
      const svgElements = document.querySelectorAll('svg');
      let maxDuration = 0;
      svgElements.forEach((svg: any) => {
        const animateElements = svg.querySelectorAll('animate, animateMotion, animateTransform');
        animateElements.forEach((animate: any) => {
          const begin = parseFloat(animate.getAttribute('begin') || '0');
          const dur = parseFloat(animate.getAttribute('dur') || '0');
          maxDuration = Math.max(maxDuration, begin + dur);
        });
      });
      return maxDuration;
    });

    const totalDuration = animationDuration > 0 ? animationDuration + 2000 : duration;
    console.log(`Animation duration: ${totalDuration}ms`);

    // Start animations by clicking if needed
    const needsClick = await page.evaluate(() => {
      const svgElements = document.querySelectorAll('svg');
      return svgElements.length > 0 && svgElements[0].getAttribute('style')?.includes('cursor: pointer');
    });

    if (needsClick) {
      console.log('Starting animation...');
      await page.click('svg');
    }

    // Wait for animation to complete
    console.log('Recording animation...');
    await page.waitForTimeout(totalDuration);

    // Close browser to save video
    console.log('Saving video...');
    await context.close();
    await browser.close();

    // Wait for video to be saved and rename it
    const videos = fs.readdirSync(path.dirname(outputFile)).filter(name => name.endsWith('.webm') && name !== path.basename(outputFile));
    const latestVideo = videos.sort((a, b) => {
      const statA = fs.statSync(path.join(path.dirname(outputFile), a));
      const statB = fs.statSync(path.join(path.dirname(outputFile), b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    })[0];

    if (latestVideo) {
      const tempPath = path.join(path.dirname(outputFile), latestVideo);
      fs.renameSync(tempPath, outputFile);
      console.log(`✅ WebM saved to: ${outputFile}`);
    } else {
      console.error('Video file not found');
    }

  } finally {
    // Kill dev server
    console.log('Stopping server...');
    devServer.kill();
  }

  process.exit(0);
})().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});