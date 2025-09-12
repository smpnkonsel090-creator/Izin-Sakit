import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, getDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// ================= Init Firebase =================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ================= DOM elements =================
const namaSelect = document.getElementById("nama"); // dropdown pilih nama
const nisInput = document.getElementById("nis");
const kelasInput = document.getElementById("kelas");
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");

let siswaMap = {}; // key = nama → { nis, kelas }

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

  namaSelect.innerHTML = '<option value="">-- Pilih Nama --</option>';
  siswaMap = {};

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const nama = data.nama || "";
    const nis = data.nis || "";
    const kelas = data.kelas || "-";

    if (nama && nis) {
      siswaMap[nama] = { nis, kelas };
      const option = document.createElement("option");
      option.value = nama;        // dropdown = nama
      option.textContent = nama;
      namaSelect.appendChild(option);
    }
  });
}

// ================= Update NIS & Kelas saat pilih nama =================
namaSelect.addEventListener("change", () => {
  const nama = namaSelect.value;
  if (nama && siswaMap[nama]) {
    nisInput.value = siswaMap[nama].nis;
    kelasInput.value = siswaMap[nama].kelas;
  } else {
    nisInput.value = "";
    kelasInput.value = "";
  }
});

// ================= Submit =================
document.getElementById("izinForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = namaSelect.value.trim();
  const nis = siswaMap[nama]?.nis || "";
  const kelas = siswaMap[nama]?.kelas || "";
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
    namaSelect.value = "";
    nisInput.value = "";
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
