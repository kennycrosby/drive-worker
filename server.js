import express from 'express';
import { spawn } from 'child_process';

const app = express();
const port = process.env.PORT || 8080;

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

  child.unref(); // Let it keep running after response

  res.status(200).send({
    success: true,
    message: "Watcher started in background.",
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
