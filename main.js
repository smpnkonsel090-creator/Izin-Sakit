import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, getDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// ================= Init Firebase =================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= DOM elements =================
const nisSelect = document.getElementById("nis");    // dropdown pilih siswa
const namaInput = document.getElementById("nama");   // input readonly nama
const kelasInput = document.getElementById("kelas"); // input readonly kelas
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");

let siswaMap = {}; // key = nis → { nama, kelas }

// ================= Helper WITA =================
function nowWITA() {
  const nowUTC = new Date();
  const witaOffset = 8 * 60; // UTC+8
  return new Date(nowUTC.getTime() + witaOffset * 60000);
}

// ================= Set default tanggal =================
const todayWITA = nowWITA().toISOString().split("T")[0];
tanggalInput.value = todayWITA;
tanggalInput.min = todayWITA;

// ================= Load siswa =================
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

    if (nama && nis) {
      siswaMap[nis] = { nama, kelas };
      const option = document.createElement("option");
      option.value = nis;          // pakai NIS sebagai value unik
      option.textContent = nama;   // tampilkan nama di dropdown
      nisSelect.appendChild(option);
    }
  });
}

// ================= Update Nama & Kelas saat pilih siswa =================
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

// ================= Submit =================
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

  // ===== Validasi tanggal & jam (sama dengan Android) =====
  const now = nowWITA();
  const todayStr = now.toISOString().split("T")[0];
  const cutoffHour = 10;

  if (tanggal < todayStr) {
    statusP.textContent = "❌ Tanggal yang dipilih sudah lewat. Pilih hari ini atau mendatang.";
    statusP.style.color = "red";
    return;
  }
  if (tanggal === todayStr && now.getHours() >= cutoffHour) {
    statusP.textContent = "❌ Batas waktu pengiriman izin hari ini sudah lewat!";
    statusP.style.color = "red";
    return;
  }

  // ===== Data yang disimpan =====
  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    // Simpan ke Izin_Sakit/{tanggal}
    const izinRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(izinRef, { [nis]: dataSiswa }, { merge: true });

    // Update absensi/{tanggal}
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

    // Reset form
    nisSelect.value = "";
    namaInput.value = "";
    kelasInput.value = "";
    jenisSelect.value = "";
    keteranganInput.value = "";
    tanggalInput.value = todayWITA;

  } catch (err) {
    statusP.textContent = `❌ Gagal menyimpan: ${err.message}`;
    statusP.style.color = "red";
  }
});

// ================= Panggil pertama kali =================
loadSiswa();
