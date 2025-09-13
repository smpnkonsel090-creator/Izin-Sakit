import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, getDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Firebase init
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

// Load siswa
async function loadSiswa() {
  const q = query(collection(db, "siswa"), orderBy("nama"));
  const snapshot = await getDocs(q);

  nisSelect.innerHTML = '<option value="">-- Pilih Nama --</option>';
  siswaMap = {};

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const nama = (data.nama || "").trim();
    const nis = (data.nis || "").trim();
    const kelas = (data.kelas || "-").trim();

    if (nama) {
      siswaMap[nama.toLowerCase()] = { nis, kelas };
      const option = document.createElement("option");
      option.value = nama.toLowerCase();
      option.textContent = nama;
      nisSelect.appendChild(option);
    }
  });
  console.log("Siswa loaded:", siswaMap);
}

// Pilih nama
nisSelect.addEventListener("change", () => {
  const selected = nisSelect.value.toLowerCase();
  if (selected && siswaMap[selected]) {
    namaInput.value = Object.keys(siswaMap).find(k => k === selected);
    kelasInput.value = siswaMap[selected].kelas;
  } else {
    namaInput.value = "";
    kelasInput.value = "";
  }
});

// Submit form
document.getElementById("izinForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = namaInput.value.trim();
  const nis = siswaMap[nama.toLowerCase()]?.nis || "";
  const kelas = kelasInput.value.trim();
  const tanggal = tanggalInput.value.trim();
  const jenis = jenisSelect.value.trim();
  const keterangan = keteranganInput.value.trim();

  if (!nama || !nis || !kelas || !tanggal || !jenis || !keterangan) {
    statusP.textContent = "Semua kolom wajib diisi!";
    statusP.style.color = "red";
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const cutoffHour = 10;

  if (tanggal === todayStr && now.getHours() >= cutoffHour) {
    statusP.textContent = "❌ Batas waktu pengiriman izin hari ini telah lewat!";
    statusP.style.color = "red";
    return;
  }

  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    const docRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(docRef, { [nis]: dataSiswa }, { merge: true });

    const absensiRef = doc(db, "absensi", tanggal);
    const absensiDoc = await getDoc(absensiRef);
    const existingData = absensiDoc.exists() ? absensiDoc.data() : {};

    const absensiHariIni = existingData[nis] ? { ...existingData[nis] } : {};
    absensiHariIni.status = jenis;
    absensiHariIni.keterangan = keterangan;
    absensiHariIni.nama = nama;
    absensiHariIni.nis = nis;
    absensiHariIni.kelas = kelas;

    if (!absensiHariIni.jamDatang) absensiHariIni.jamDatang = Timestamp.now();
    if (!absensiHariIni.jamPulang) absensiHariIni.jamPulang = Timestamp.now();

    await setDoc(absensiRef, { [nis]: absensiHariIni }, { merge: true });

    statusP.textContent = "✅ Izin/Sakit berhasil dicatat & absensi diperbarui";
    statusP.style.color = "green";

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

loadSiswa();
