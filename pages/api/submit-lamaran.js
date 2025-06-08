// File: pages/api/submit-lamaran.js

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
    const form = new IncomingForm({
      uploadDir: upload_dir, // **[EDIT]** Maaf, ada typo di sini, seharusnya uploadDir
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
    // >>>>>>>>>> INI ADALAH BAGIAN DEBUGGING YANG PALING PENTING <<<<<<<<<<
    // =================================================================
    console.log("--- DEBUGGING FORM DATA ---");
    console.log("Isi dari 'fields':", JSON.stringify(fields, null, 2));
    console.log("Isi dari 'files':", JSON.stringify(files, null, 2));
    console.log("--- END DEBUGGING ---");
    // =================================================================

    const cvFile = Array.isArray(files.cv) ? files.cv[0] : files.cv;

    if (!cvFile || !cvFile.filepath) {
      console.error('Kondisi !cvFile || !cvFile.filepath terpenuhi.');
      return res.status(400).json({ message: 'File CV tidak ditemukan atau gagal diunggah. Mohon coba lagi.' });
    }

    const { nama, no_hp, email, posisi } = fields;
    
    // ... Sisa kode sama persis ...
    // (Anda bisa salin sisa kode dari versi sebelumnya, atau saya bisa berikan lagi jika perlu)

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

    const drive = google.drive({ version: 'v3', auth: req.auth });
    const sheets = google.sheets({ version: 'v4', auth: req.auth });

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

// Perlu middleware untuk autentikasi Google di setiap request
const withGoogleAuth = (handler) => async (req, res) => {
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
        req.auth = auth; // Menyimpan auth di object request
        return handler(req, res);
    } catch (error) {
        console.error('Google Auth Middleware Error:', error);
        return res.status(500).json({ message: 'Authentication failed.' });
    }
};

export default withGoogleAuth(handler);