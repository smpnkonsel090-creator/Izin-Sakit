import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, doc, setDoc, getDoc, query, orderBy, Timestamp 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// ===== Firebase Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== DOM Elements =====
const nisSelect = document.getElementById("nis"); // data source
const namaInput = document.getElementById("nama"); // input nama siswa
const kelasInput = document.getElementById("kelas");
const tanggalInput = document.getElementById("tanggal");
const jenisSelect = document.getElementById("jenis");
const keteranganInput = document.getElementById("keterangan");
const statusP = document.getElementById("status");

// ===== Variables =====
let siswaMap = {};
const today = new Date().toISOString().split('T')[0];
tanggalInput.value = today;
tanggalInput.setAttribute("min", today); // tidak bisa pilih tanggal lewat

// ===== Load Siswa =====
async function loadSiswa() {
  const q = query(collection(db, "siswa"), orderBy("nama"));
  const snapshot = await getDocs(q);

  nisSelect.innerHTML = '';
  siswaMap = {};

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const nama = (data.nama || "").trim();
    const nis = (data.nis || "").trim();
    const kelas = (data.kelas || "-").trim();

    if (nama) {
      siswaMap[nama.toLowerCase()] = { nis, kelas, namaAsli: nama };
      const option = document.createElement("option");
      option.value = nama.toLowerCase();
      option.textContent = nama;
      nisSelect.appendChild(option);
    }
  });
  console.log("Siswa loaded:", siswaMap);
}

// ===== AutoComplete Nama =====
namaInput.addEventListener("input", () => {
  const input = namaInput.value.toLowerCase();
  const options = Array.from(nisSelect.options);
  const filtered = options.filter(opt => opt.value.includes(input));
  const dropdown = filtered.map(opt => opt.textContent);
  showSuggestions(dropdown);
});

function showSuggestions(list) {
  let dataList = document.getElementById("suggestions");
  if (!dataList) {
    dataList = document.createElement("div");
    dataList.id = "suggestions";
    dataList.style.border = "1px solid #ccc";
    dataList.style.position = "absolute";
    dataList.style.background = "white";
    dataList.style.zIndex = 1000;
    dataList.style.maxHeight = "150px";
    dataList.style.overflowY = "auto";
    namaInput.parentNode.appendChild(dataList);
  }
  dataList.innerHTML = "";

  list.forEach(name => {
    const div = document.createElement("div");
    div.textContent = name;
    div.style.padding = "5px";
    div.style.cursor = "pointer";
    div.addEventListener("click", () => {
      namaInput.value = name;
      kelasInput.value = siswaMap[name.toLowerCase()].kelas;
      dataList.innerHTML = "";
    });
    dataList.appendChild(div);
  });
}

// ===== Hide Suggestions Klik Di Luar =====
document.addEventListener("click", (e) => {
  if (e.target !== namaInput) {
    const dataList = document.getElementById("suggestions");
    if (dataList) dataList.innerHTML = "";
  }
});

// ===== Pilih Nama Via Dropdown (Backup) =====
nisSelect.addEventListener("change", () => {
  const selected = nisSelect.value.toLowerCase();
  if (selected && siswaMap[selected]) {
    namaInput.value = siswaMap[selected].namaAsli;
    kelasInput.value = siswaMap[selected].kelas;
  } else {
    namaInput.value = "";
    kelasInput.value = "";
  }
});

// ===== Form Submit =====
document.getElementById("izinForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const nama = namaInput.value.trim();
  const nis = siswaMap[nama.toLowerCase()]?.nis || "";
  const kelas = kelasInput.value.trim();
  const tanggal = tanggalInput.value.trim();
  const jenis = jenisSelect.value.trim();
  const keterangan = keteranganInput.value.trim();

  // Validasi wajib isi
  if (!nama || !nis || !kelas || !tanggal || !jenis || !keterangan) {
    statusP.textContent = "Semua kolom wajib diisi!";
    statusP.style.color = "red";
    return;
  }

  // ===== Validasi Tanggal & Jam =====
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const selectedDate = new Date(tanggal + "T00:00:00");
  const todayDate = new Date(todayStr + "T00:00:00");
  const cutoffHour = 9; // batas jam 09:00

  if (selectedDate < todayDate) {
    statusP.textContent = "❌ Tanggal yang dipilih sudah lewat. Silakan pilih hari ini atau tanggal mendatang.";
    statusP.style.color = "red";
    return;
  }

  if (tanggal === todayStr && now.getHours() >= cutoffHour) {
    statusP.textContent = "❌ Batas waktu pengiriman izin hari ini telah lewat! (Sampai jam 09:00)";
    statusP.style.color = "red";
    return;
  }

  const dataSiswa = { nama, nis, kelas, jenis, keterangan, tanggal, timestamp: Timestamp.now() };

  try {
    // Simpan ke Izin_Sakit
    const docRef = doc(db, "Izin_Sakit", tanggal);
    await setDoc(docRef, { [nis]: dataSiswa }, { merge: true });

    // Update absensi
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
    tanggalInput.value = today;

  } catch (err) {
    statusP.textContent = `❌ Gagal mengirim data: ${err.message}`;
    statusP.style.color = "red";
  }
});

// ===== Load Data Siswa Awal =====
loadSiswa();
