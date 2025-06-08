// File: pages/api/submit-lamaran.js

import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Matikan bodyParser bawaan Next.js agar formidable bisa mem-parsing file
export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // 1. AUTENTIKASI DENGAN GOOGLE SERVICE ACCOUNT
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // Ganti literal '\n' dengan newline character asli
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.file', // Scope lebih spesifik untuk upload file
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });

    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    // 2. PARSE FORM DATA (TERMASUK FILE) MENGGUNAKAN FORMIDABLE
    const form = new IncomingForm();
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const cvFile = files.cv;
    if (!cvFile) {
      return res.status(400).json({ message: 'File CV wajib diunggah.' });
    }

    // Ambil data teks dari form
    const { nama, no_hp, email, posisi } = fields;

    // 3. UPLOAD FILE CV KE GOOGLE DRIVE
    const fileExtension = path.extname(cvFile.originalFilename);
    const fileName = `${nama} - ${posisi} - CV${fileExtension}`;

    const fileMetadata = {
      name: fileName,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // ID Folder Drive tujuan
    };

    const media = {
      mimeType: cvFile.mimetype,
      body: fs.createReadStream(cvFile.filepath),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink', // Minta link file agar bisa dicatat di Sheet
    });

    const fileLink = driveResponse.data.webViewLink;

    // 4. TULIS DATA LAMARAN KE GOOGLE SHEETS
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    // Sesuaikan dengan Nama Sheet dan Range Kolom Anda
    const range = 'DataRekapPelamar!A:F'; 

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            // Susunan harus sama persis dengan kolom di Sheet Anda
            new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }), // Kolom A: Timestamp
            nama,       // Kolom B: Nama
            no_hp,      // Kolom C: No HP/WA
            email,      // Kolom D: Email
            posisi,     // Kolom E: Posisi
            fileLink,   // Kolom F: Link CV
          ],
        ],
      },
    });

    // 5. KIRIM RESPON SUKSES KE FRONTEND
    return res.status(200).json({ message: 'Lamaran berhasil dikirim!' });

  } catch (error) {
    console.error('Error saat memproses lamaran:', error);
    // Kirim pesan error yang lebih informatif jika memungkinkan
    const errorMessage = error.response?.data?.error?.message || error.message || 'Terjadi kesalahan pada server.';
    return res.status(500).json({ message: errorMessage });
  }
}

export default handler;