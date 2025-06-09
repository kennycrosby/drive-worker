import express from 'express';
import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
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

// 🔄 Reset processed.json
app.get('/reset-processed', async (req, res) => {
  try {
    await writeFile(processedPath, JSON.stringify({ processed_files: [] }, null, 2), 'utf8');
    console.log("🧹 processed.json has been reset.");
    res.status(200).send("processed.json reset.");
  } catch (err) {
    console.error("❌ Failed to reset processed.json:", err);
    res.status(500).send("Failed to reset.");
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
