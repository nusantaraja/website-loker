// File: pages/api/submit-lamaran.js
// Versi ini sudah memperbaiki typo `upload_dir` menjadi `uploadDir`

import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const uploadDir = '/tmp/uploads';
  ensureDirExists(uploadDir);

  try {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const form = new IncomingForm({
      uploadDir: uploadDir, // <--- SUDAH DIPERBAIKI
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024,
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // =================================================================
    // >>>>>>>>>> BLOK DEBUGGING TETAP DIPERTAHANKAN <<<<<<<<<<
    // =================================================================
    console.log("--- DEBUGGING FORM DATA ---");
    console.log("Isi dari 'fields':", JSON.stringify(fields, null, 2));
    console.log("Isi dari 'files':", JSON.stringify(files, null, 2));
    console.log("--- END DEBUGGING ---");
    // =================================================================

    const cvFile = Array.isArray(files.cv) ? files.cv[0] : files.cv;

    if (!cvFile || !cvFile.filepath) {
      console.error('Kondisi !cvFile || !cvFile.filepath terpenuhi. File tidak valid.');
      return res.status(400).json({ message: 'File CV tidak valid atau gagal diunggah.' });
    }

    const { nama, no_hp, email, posisi } = fields;
    
    if (!nama || !no_hp || !email || !posisi) {
      return res.status(400).json({ message: 'Semua data formulir wajib diisi.' });
    }
    
    const fileExtension = path.extname(cvFile.originalFilename || 'file');
    const fileName = `${Array.isArray(nama) ? nama[0] : nama} - ${Array.isArray(posisi) ? posisi[0] : posisi} - CV${fileExtension}`;

    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    };

    const media = {
      mimeType: cvFile.mimetype,
      body: fs.createReadStream(cvFile.filepath),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    fs.unlinkSync(cvFile.filepath);

    const fileLink = driveResponse.data.webViewLink;

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const range = 'DataRekapPelamar!A:F';

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            Array.isArray(nama) ? nama[0] : nama,
            Array.isArray(no_hp) ? no_hp[0] : no_hp,
            Array.isArray(email) ? email[0] : email,
            Array.isArray(posisi) ? posisi[0] : posisi,
            fileLink,
          ],
        ],
      },
    });

    return res.status(200).json({ message: 'Lamaran berhasil dikirim!' });

  } catch (error) {
    console.error('Error saat memproses lamaran:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Terjadi kesalahan pada server.';
    return res.status(500).json({ message: errorMessage });
  }
}

export default handler;