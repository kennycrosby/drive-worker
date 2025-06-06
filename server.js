import express from 'express';
import { exec } from 'child_process';
import util from 'util';

const app = express();
const port = process.env.PORT || 3000;
const execAsync = util.promisify(exec);

app.get('/run-watcher', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('node watcher.js');
    res.status(200).send({ success: true, output: stdout, error: stderr });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
