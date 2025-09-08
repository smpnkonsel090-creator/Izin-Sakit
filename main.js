import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
const nisSelect = document.getElementById("nis");
const namaInput = document.getElementById("nama");
const kelasInput = document.getElementById("kelas");
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");

let siswaMap = {};
const today = new Date().toISOString().split('T')[0];
tanggalInput.value = today;

// Load siswa dari Firestore
async function loadSiswa() {
  const q = query(collection(db, "siswa"), orderBy("nama"));
  const snapshot = await getDocs(q);

  nisSelect.innerHTML = '<option value="">-- Pilih Nama --</option>';
  siswaMap = {};

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const nama = data.nama || "";
    const nis = data.nis || "";
    const kelas = data.kelas || "-";

    if (nama) {
      siswaMap[nama] = { nis, kelas };
      const option = document.createElement("option");
      option.value = nama;
      option.textContent = nama;
      nisSelect.appendChild(option);
    }
  });
}

nisSelect.addEventListener("change", () => {
  const selected = nisSelect.value;
  if (selected && siswaMap[selected]) {
    namaInput.value = selected;
    kelasInput.value = siswaMap[selected].kelas;
  } else {
    namaInput.value = "";
    kelasInput.value = "";
  }
});

// Submit form izin/sakit
document.getElementById("izinForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = namaInput.value.trim();
  const nis = siswaMap[nama]?.nis || "";
  const kelas = kelasInput.value.trim();
  const tanggal = tanggalInput.value.trim();
  const jenis = jenisSelect.value.trim();
  const keterangan = keteranganInput.value.trim();

  if (!nama || !nis || !kelas || !tanggal || !jenis || !keterangan) {
    statusP.textContent = "Semua kolom wajib diisi!";
    statusP.style.color = "red";
    return;
  }

  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    // Simpan ke Izin_Sakit/{tanggal}
    const docRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(docRef, { [nis]: dataSiswa }, { merge: true });

    // === Sekaligus update absensi/{tanggal} ===
    const absensiRef = doc(db, "absensi", tanggal);
    const absensiData = {
      [nis]: {
        nis,
        nama,
        kelas,
        status: jenis,
        keterangan,
        jamDatang: Timestamp.now(),
        jamPulang: Timestamp.now()
      }
    };
    await setDoc(absensiRef, absensiData, { merge: true });

    statusP.textContent = "✅ Izin/Sakit berhasil dicatat & absensi diperbarui";
    statusP.style.color = "green";

    // Reset form
    nisSelect.value = "";
    namaInput.value = "";
    kelasInput.value = "";
    jenisSelect.value = "";
    keteranganInput.value = "";
    tanggalInput.value = today;

  } catch (err) {
    statusP.textContent = `❌ Gagal mengirim data: ${err.message}`;
    statusP.style.color = "red";
  }
});

// Panggil pertama kali
loadSiswa();
