import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { execFile } from 'child_process';
import util from 'util';
import dotenv from 'dotenv';
dotenv.config();


console.log("GOOGLE_SERVICE_ACCOUNT:", process.env.GOOGLE_SERVICE_ACCOUNT?.slice(0, 100));
if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT environment variable is not set.");
}

const execFileAsync = util.promisify(execFile);

const INPUT_FOLDER_ID = process.env.INPUT_FOLDER_ID;
const OUTPUT_FOLDER_ID = process.env.OUTPUT_FOLDER_ID;

const INPUT_DIR = './tmp/input';
const OUTPUT_DIR = './tmp/output';
const PROCESSED_JSON = './processed.json';

fs.mkdirSync(INPUT_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
  scopes: ['https://www.googleapis.com/auth/drive'],
});


const drive = google.drive({ version: 'v3', auth });

function loadProcessed() {
  if (!fs.existsSync(PROCESSED_JSON)) return { processed_files: [] };
  return JSON.parse(fs.readFileSync(PROCESSED_JSON, 'utf8'));
}

function saveProcessed(data) {
  fs.writeFileSync(PROCESSED_JSON, JSON.stringify(data, null, 2));
}

async function listSubfolders(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });
  return res.data.files;
}

async function listFilesInFolder(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
  });
  return res.data.files;
}

async function downloadFile(fileId, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    res.data
      .on('end', () => resolve(destPath))
      .on('error', reject)
      .pipe(dest);
  });
}

async function uploadFile(filePath, folderId) {
  const fileName = path.basename(filePath);
  const fileMetadata = { name: fileName, parents: [folderId] };
  const media = { mimeType: 'application/octet-stream', body: fs.createReadStream(filePath) };
  await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
}

async function ensureDriveFolder(folderName, parentId) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata = {
    name: folderName,
    parents: [parentId],
    mimeType: 'application/vnd.google-apps.folder',
  };

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
  });

  return folder.data.id;
}

async function run() {
  const processed = loadProcessed();
  const processedIds = new Set(processed.processed_files.map(f => f.id));

  const stopFolders = await listSubfolders(INPUT_FOLDER_ID);
  for (const folder of stopFolders) {
    const stopName = folder.name; // e.g., "stop1"
    const images = await listFilesInFolder(folder.id);

    // Ensure Drive folder structure: output/stop1/videos and output/stop1/thumbnails
    const stopDriveFolderId = await ensureDriveFolder(stopName, OUTPUT_FOLDER_ID);
    const videoDriveFolderId = await ensureDriveFolder("videos", stopDriveFolderId);
    const thumbDriveFolderId = await ensureDriveFolder("thumbnails", stopDriveFolderId);

    for (const file of images) {
      if (processedIds.has(file.id)) {
        console.log(`Already processed: ${file.name}`);
        continue;
      }

      const inputPath = path.join(INPUT_DIR, stopName, file.name);
      console.log(`Downloading ${stopName}/${file.name}...`);
      await downloadFile(file.id, inputPath);
      console.log(`✅ Downloaded: ${file.name}`);



      console.log(`Running converter for ${stopName}/${file.name}...`);
      await new Promise((resolve, reject) => {
        const child = spawn('python3', ['imgconverter.py']);

        child.stdout.on('data', (data) => {
          console.log("📤 Python stdout:", data.toString().trim());
        });

        child.stderr.on('data', (data) => {
          console.error("⚠️ Python stderr:", data.toString().trim());
        });

        child.on('error', (err) => {
          console.error('❌ Python spawn error:', err);
          reject(err);
        });

        child.on('close', (code) => {
          if (code === 0) {
            console.log("✅ Python script completed successfully.");
            resolve(null);
          } else {
            reject(new Error(`imgconverter.py exited with code ${code}`));
          }
        });
      });


      const baseName = path.parse(file.name).name;
      const videoName = `${stopName}_${baseName}.mp4`;
      const thumbName = `${stopName}_${baseName}.jpg`;

      console.log(`Uploading ${videoName} and ${thumbName}...`);
      await uploadFile(`./tmp/output/${stopName}/videos/${videoName}`, videoDriveFolderId);
      await uploadFile(`./tmp/output/${stopName}/thumbnails/${thumbName}`, thumbDriveFolderId);

      processed.processed_files.push({
        id: file.id,
        name: file.name,
        folder: stopName,
        timestamp: new Date().toISOString(),
      });
      saveProcessed(processed);

      console.log(`✅ Finished: ${stopName}/${file.name}`);
    }
  }
}

run().catch(err => {
  console.error("❌ Fatal error:", err);
});
