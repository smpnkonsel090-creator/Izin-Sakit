import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, getDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// ================= Init Firebase =================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= DOM elements =================
const nisSelect = document.getElementById("nis");
const namaInput = document.getElementById("nama");
const kelasInput = document.getElementById("kelas");
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

let siswaMap = {};

// ================= Helper WITA =================
function nowWITA() {
  const nowUTC = new Date();
  const witaOffset = 8 * 60; // WITA = UTC+8
  return new Date(nowUTC.getTime() + witaOffset * 60000);
}

// ================= Set default tanggal =================
const todayWITA = nowWITA().toISOString().split("T")[0];
tanggalInput.value = todayWITA;
tanggalInput.min = todayWITA;

// ================= Load siswa dari Firestore =================
async function loadSiswa() {
  const q = query(collection(db, "siswa"), orderBy("nama"));
  const snapshot = await getDocs(q);

  nisSelect.innerHTML = '<option value="">-- Pilih Nama --</option>';
  siswaMap = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const nama = data.nama || "";
    const nis = data.nis || "";
    const kelas = data.kelas || "-";

    if (nis && nama) {
      siswaMap[nis] = { nama, kelas }; // simpan dengan key = NIS
      const option = document.createElement("option");
      option.value = nis;              // VALUE = NIS
      option.textContent = nama;       // TAMPILAN = Nama
      nisSelect.appendChild(option);
    }
  });
}

// ================= Update nama & kelas saat pilih siswa =================
nisSelect.addEventListener("change", () => {
  const nis = nisSelect.value;
  if (nis && siswaMap[nis]) {
    namaInput.value = siswaMap[nis].nama;
    kelasInput.value = siswaMap[nis].kelas;
  } else {
    namaInput.value = "";
    kelasInput.value = "";
  }
});

// ================= Cek batas waktu & disable tombol =================
function cekBatasWaktu() {
  const now = nowWITA();
  const todayStr = now.toISOString().split("T")[0];
  const cutoffHour = 10;

  if (tanggalInput.value < todayStr) {
    submitBtn.disabled = true;
    submitBtn.textContent = "❌ Tanggal sudah lewat";
  } else if (tanggalInput.value === todayStr && now.getHours() >= cutoffHour) {
    submitBtn.disabled = true;
    submitBtn.textContent = "⏰ Batas waktu WITA sudah lewat";
  } else {
    submitBtn.disabled = false;
    submitBtn.textContent = "Kirim";
  }
}

// Panggil saat load halaman & saat tanggal diubah
cekBatasWaktu();
tanggalInput.addEventListener("change", cekBatasWaktu);
setInterval(cekBatasWaktu, 60000); // update tiap 1 menit

// ================= Submit form izin/sakit =================
document.getElementById("izinForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nis = nisSelect.value.trim();
  const nama = siswaMap[nis]?.nama || "";
  const kelas = siswaMap[nis]?.kelas || "";
  const tanggal = tanggalInput.value.trim();
  const jenis = jenisSelect.value.trim();
  const keterangan = keteranganInput.value.trim();

  if (!nama || !nis || !kelas || !tanggal || !jenis || !keterangan) {
    statusP.textContent = "Semua kolom wajib diisi!";
    statusP.style.color = "red";
    return;
  }

  const now = nowWITA();
  const todayStr = now.toISOString().split("T")[0];
  const cutoffHour = 10;

  // === Batasan: tanggal sudah lewat ===
  if (tanggal < todayStr) {
    statusP.textContent = "❌ Tanggal yang dipilih sudah lewat (WITA).";
    statusP.style.color = "red";
    return;
  }

  // === Batasan: hari ini tapi lewat jam 10 WITA ===
  if (tanggal === todayStr && now.getHours() >= cutoffHour) {
    statusP.textContent = "❌ Batas waktu pengiriman izin/sakit hari ini telah lewat!";
    statusP.style.color = "red";
    return;
  }

  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    // Simpan ke Izin_Sakit/{tanggal}
    const docRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(docRef, { [nis]: dataSiswa }, { merge: true });

    // Update absensi/{tanggal}
    const absensiRef = doc(db, "absensi", tanggal);
    const absensiDoc = await getDoc(absensiRef);
    const existingData = absensiDoc.exists() ? absensiDoc.data() : {};

    const absensiHariIni = existingData[nis] ? { ...existingData[nis] } : {};

    // Update status & keterangan
    absensiHariIni.status = jenis;
    absensiHariIni.keterangan = keterangan;
    absensiHariIni.nama = nama;
    absensiHariIni.nis = nis;
    absensiHariIni.kelas = kelas;

    // Jika jamDatang/jamPulang masih null, isi Timestamp.now()
    if (!absensiHariIni.jamDatang) absensiHariIni.jamDatang = Timestamp.now();
    if (!absensiHariIni.jamPulang) absensiHariIni.jamPulang = Timestamp.now();

    const absensiData = { [nis]: absensiHariIni };
    await setDoc(absensiRef, absensiData, { merge: true });

    statusP.textContent = "✅ Izin/sakit berhasil dicatat & absensi diperbarui";
    statusP.style.color = "green";

    // Reset form
    nisSelect.value = "";
    namaInput.value = "";
    kelasInput.value = "";
    jenisSelect.value = "";
    keteranganInput.value = "";
    tanggalInput.value = todayWITA;

    cekBatasWaktu();

  } catch (err) {
    statusP.textContent = `❌ Gagal mengirim data: ${err.message}`;
    statusP.style.color = "red";
  }
});

// ================= Panggil pertama kali =================
loadSiswa();
