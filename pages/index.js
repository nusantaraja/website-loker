// File: pages/index.js

import { useState } from 'react';
import styles from '../styles/Home.module.css'; // Contoh penggunaan CSS modules

export default function HomePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setIsError(false);

    const formData = new FormData(event.target);

    // Validasi sederhana untuk file
    const file = formData.get('cv');
    if (file.size === 0) {
        setMessage('Mohon unggah file CV Anda.');
        setIsError(true);
        setIsSubmitting(false);
        return;
    }

    try {
      const response = await fetch('/api/submit-lamaran', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Terjadi kesalahan saat mengirim lamaran.');
      }

      setMessage('Lamaran berhasil dikirim! Terima kasih telah melamar.');
      setIsError(false);
      event.target.reset(); // Mengosongkan formulir setelah berhasil
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>Formulir Lamaran Pekerjaan</h1>
        <p className={styles.description}>
          Silakan isi data diri dan unggah CV Anda (format PDF).
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="nama">Nama Lengkap</label>
            <input type="text" id="nama" name="nama" required />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="no_hp">No HP / WhatsApp</label>
            <input type="tel" id="no_hp" name="no_hp" required />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email">Alamat Email</label>
            <input type="email" id="email" name="email" required />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="posisi">Posisi yang Dilamar</label>
            <input type="text" id="posisi" name="posisi" required />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="cv">Upload CV (PDF, max 5MB)</label>
            <input type="file" id="cv" name="cv" accept=".pdf" required /> // Menambahkan atribut accept
          </div>

          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Mengirim...' : 'Kirim Lamaran'}
          </button>
        </form>

        {message && (
          <p className={`${styles.message} ${isError ? styles.error : styles.success}`}>
            {message}
          </p>
        )}
      </main>
    </div>
  );
}