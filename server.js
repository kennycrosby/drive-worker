import express from 'express';
import { spawn } from 'child_process';
import { rm, mkdir, readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const port = process.env.PORT || 8080;

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const processedPath = join(__dirname, 'processed.json');

// 🟡 Run Watcher
app.get('/run-watcher', (req, res) => {
  console.log("🟡 /run-watcher endpoint hit");

  const child = spawn('node', ['watcher.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });

  child.stdout.on('data', (data) => {
    console.log(`📤 watcher.js stdout: ${data.toString().trim()}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`⚠️ watcher.js stderr: ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error('❌ watcher.js spawn error:', err);
  });

  child.unref(); // Let it keep running in background
  res.status(200).send({
    success: true,
    message: "Watcher started in background.",
  });
});



app.get('/reset-processed', async (req, res) => {
  try {
    // Clear processed.json
    await writeFile(processedPath, JSON.stringify({ processed_files: [] }, null, 2));

    // Remove ./tmp/input and ./tmp/output
    const inputPath = join(__dirname, 'tmp', 'input');
    const outputPath = join(__dirname, 'tmp', 'output');

    await rm(inputPath, { recursive: true, force: true });
    await rm(outputPath, { recursive: true, force: true });

    // Recreate empty folders
    await mkdir(inputPath, { recursive: true });
    await mkdir(outputPath, { recursive: true });

    console.log("🧹 Reset processed.json and cleared tmp folders.");
    res.status(200).send("✅ Reset completed: processed.json, input/, and output/ cleared.");
  } catch (err) {
    console.error("❌ Reset failed:", err);
    res.status(500).send("❌ Reset failed.");
  }
});



// 📄 Read processed.json
app.get('/processed-status', async (req, res) => {
  try {
    const contents = await readFile(processedPath, 'utf8');
    res.status(200).send(contents);
  } catch (err) {
    console.error("❌ Could not read processed.json:", err);
    res.status(500).send("Error reading file.");
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
