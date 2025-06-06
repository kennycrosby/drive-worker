import express from 'express';
import { exec } from 'child_process';
import util from 'util';

const app = express();
const port = process.env.PORT || 8080;
const execAsync = util.promisify(exec);

app.get('/run-watcher', async (req, res) => {
  console.log("🟡 /run-watcher endpoint hit");
  try {
    const { stdout, stderr } = await execAsync('node watcher.js');

    console.log("✅ watcher.js output:", stdout);
    console.error("⚠️ watcher.js stderr:", stderr);

    res.status(200).send({
      success: true,
      output: stdout,
      error: stderr || null,
    });
  } catch (err) {
    console.error("❌ watcher.js error:", err);
    res.status(500).send({
      success: false,
      error: err.message || "Unknown error",
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
