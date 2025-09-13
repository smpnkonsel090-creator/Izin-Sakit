import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
const namaInput = document.getElementById("nama");
const namaList = document.getElementById("namaList");
const nisInput = document.getElementById("nis");
const kelasInput = document.getElementById("kelas");
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");

let siswaMap = {}; // key = nama lowercase, value = {nis, kelas}
const today = new Date().toISOString().split('T')[0];
tanggalInput.value = today;

// Load siswa dari Firestore
async function loadSiswa() {
  const snapshot = await getDocs(collection(db, "siswa"));
  siswaMap = {};
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const nama = (data.nama || "").trim();
    const nis = (data.nis || "").trim();
    const kelas = (data.kelas || "-").trim();
    if (nama) siswaMap[nama.toLowerCase()] = { nis, kelas };
  });
}
loadSiswa();

// Filter & show autocomplete
namaInput.addEventListener("input", () => {
  const val = namaInput.value.toLowerCase();
  namaList.innerHTML = "";
  if (!val) { namaList.style.display = "none"; return; }

  const filtered = Object.keys(siswaMap).filter(n => n.includes(val));
  if (filtered.length === 0) { namaList.style.display = "none"; return; }

  filtered.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    li.addEventListener("click", () => {
      namaInput.value = n;
      nisInput.value = siswaMap[n].nis;
      kelasInput.value = siswaMap[n].kelas;
      namaList.style.display = "none";
    });
    namaList.appendChild(li);
  });
  namaList.style.display = "block";
});

// Submit form
document.getElementById("izinForm").addEventListener("submit", async e => {
  e.preventDefault();
  const nama = namaInput.value.trim();
  const nis = nisInput.value.trim();
  const kelas = kelasInput.value.trim();
  const tanggal = tanggalInput.value.trim();
  const jenis = jenisSelect.value.trim();
  const keterangan = keteranganInput.value.trim();

  if (!nama || !nis || !kelas || !tanggal || !jenis || !keterangan) {
    statusP.textContent = "Semua kolom wajib diisi!";
    statusP.style.color = "red";
    return;
  }

  const now = new Date(), todayStr = now.toISOString().split('T')[0], cutoffHour = 10;
  if (tanggal === todayStr && now.getHours() >= cutoffHour) {
    statusP.textContent = "❌ Batas waktu pengiriman izin hari ini telah lewat!";
    statusP.style.color = "red";
    return;
  }

  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    const izinRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(izinRef, { [nis]: dataSiswa }, { merge: true });

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

    namaInput.value = "";
    nisInput.value = "";
    kelasInput.value = "";
    jenisSelect.value = "";
    keteranganInput.value = "";
    tanggalInput.value = today;

  } catch (err) {
    statusP.textContent = `❌ Gagal mengirim data: ${err.message}`;
    statusP.style.color = "red";
  }
});
