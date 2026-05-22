// ==========================================
// KUNCI INTEGRASI CLOUD GOOGLE WORKSPACE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjkSV5Xttfq0W-g-0463y4twYwgaYiFYC9_SvjySWkjOMPjNo3lzK0wn1ms5GGWpdAog/exec";
const PIN_KEAMANAN_KPU = "657139"; // PIN internal KPU Kuningan

// Inisialisasi Elemen HTML Front-End
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const btnSnap = document.getElementById('btn-snap');
const btnRetry = document.getElementById('btn-retry');
const form = document.getElementById('guest-form');
const btnExport = document.getElementById('btn-export');

// Inisialisasi Elemen Modal PIN Bootstrap
const pinModal = new bootstrap.Modal(document.getElementById('pinModal'));
const inputPin = document.getElementById('input-pin');
const btnVerifyPin = document.getElementById('btn-verify-pin');
const pinError = document.getElementById('pin-error');
const inputPinAction = document.getElementById('pin-action');
const inputPinIndex = document.getElementById('pin-index');

let tumpukanFotoBase64 = "";
let memoriCloudLokal = []; // Menyimpan data dari Cloud Spreadsheet secara real-time
let keyWaktuEditCloud = ""; // Kunci utama (Timestamp) untuk menandai data yang di-edit

// 1. Jalankan Kamera Otomatis Saat Aplikasi Dibuka
navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => { video.srcObject = stream; })
    .catch(err => { alert("Mohon aktifkan izin kamera pada perangkat tablet front office."); });

// 2. Ambil Gambar dari Kamera
btnSnap.addEventListener('click', () => {
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    tumpukanFotoBase64 = canvas.toDataURL('image/jpeg');
    
    video.style.display = 'none';
    photoPreview.src = tumpukanFotoBase64;
    photoPreview.style.display = 'block';
    
    btnSnap.style.display = 'none';
    btnRetry.style.display = 'inline-block';
});

// 3. Foto Ulang
btnRetry.addEventListener('click', () => {
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';
});

// 4. JEMBATAN SELEKSI URL: Mengubah Link Google Drive Biasa Menjadi Link Gambar Mentah (Direct Render)
function convertDriveUrlToDirect(url) {
    if (!url || url === "Tidak Ada Foto") return "https://placehold.co/100x100?text=No+Photo";
    if (url.startsWith("data:image")) return url; // Jika berupa base64 (saat preview edit)
    
    // Ekstrak ID unik file dari URL Google Drive
    const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
    if (match && match[1]) {
        return `https://docs.google.com/uc?export=view&id=${match[1]}`;
    }
    return url;
}

// 5. Manajemen Submit Form (Tambah Baru / Kirim Edit Langsung Ke Cloud Google)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!tumpukanFotoBase64) {
        return alert("Ambil foto tamu terlebih dahulu sebagai bukti kehadiran!");
    }

    const editIndex = document.getElementById('edit-index').value;

    const dataTamu = {
        action: editIndex !== "" ? "EDIT" : "ADD",
        waktu: editIndex !== "" ? keyWaktuEditCloud : new Date().toLocaleString('id-ID'),
        nama: document.getElementById('nama').value,
        instansi: document.getElementById('instansi').value,
        whatsapp: document.getElementById('whatsapp').value,
        tujuan: document.getElementById('tujuan').value,
        keperluan: document.getElementById('keperluan').value,
        foto: tumpukanFotoBase64 // Dikirim dalam bentuk Base64, nanti didecode oleh GAS menjadi file di Drive
    };

    const btnSubmit = document.getElementById('btn-submit');
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses Cloud KPU...`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataTamu)
        });
        
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        alert(`✓ Sukses! Data berhasil ${dataTamu.action === "EDIT" ? "diperbarui" : "tercatat"} di Cloud Google Sheets & Drive.`);
        cancelEdit();
        
        // Pindah ke tab dashboard secara otomatis untuk melihat hasilnya
        const idTabDashboard = document.getElementById('pills-dashboard-tab');
        const pemicuTab = new bootstrap.Tab(idTabDashboard);
        pemicuTab.show();
        loadDashboard();

    } catch (error) {
        console.error("Error sinkronisasi cloud:", error);
        alert("⚠️ Gagal memproses data ke Cloud Google. Periksa koneksi internet.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
    }
});

// 6. TAMPILKAN DATA REAL-TIME DARI CLOUD GOOGLE SPREADSHEET & DRIVE
async function loadDashboard() {
    const tbody = document.getElementById('tabel-tamu-body');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary" role="status"></span> Menghubungkan ke Cloud KPU Kuningan...</td></tr>`;

    try {
        // Ambil data langsung dari fungsi doGet Apps Script
        const response = await fetch(SCRIPT_URL);
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        memoriCloudLokal = hasil.data; 
        const todayStr = new Date().toLocaleDateString('id-ID');

        // Hitung statistik tamu khusus hari ini
        const tamuHariIni = memoriCloudLokal.filter(item => item.waktu && item.waktu.includes(todayStr)).length;
        document.getElementById('dash-total').textContent = memoriCloudLokal.length;
        document.getElementById('dash-today').textContent = tamuHariIni;

        tbody.innerHTML = "";

        if (memoriCloudLokal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Belum ada riwayat kunjungan tamu di Cloud KPU.</td></tr>`;
            return;
        }

        // Susun baris tabel data tamu
        memoriCloudLokal.forEach((item, index) => {
            const nomorUrut = index + 1;
            // Konversi link Drive internal menjadi link gambar aktif bypass korup
            const linkFotoDirect = convertDriveUrlToDirect(item.foto);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center fw-bold text-secondary">${nomorUrut}</td>
                <td class="text-center">
                    <img src="${linkFotoDirect}" class="img-table" onclick="viewPhoto('${linkFotoDirect}')" onerror="this.src='https://placehold.co/100x100?text=Error+Drive'">
                </td>
                <td class="small fw-semibold text-secondary text-center">${item.waktu}</td>
                <td class="fw-bold">${item.nama}</td>
                <td><span class="badge bg-light text-dark border">${item.instansi}</span></td>
                <td>${item.whatsapp}</td>
                <td class="small">${item.tujuan}</td>
                <td>${item.keperluan}</td>
                <td>
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-warning btn-round text-dark shadow-sm" onclick="openPinModal('EDIT', ${index})" title="Edit Data">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-danger btn-round shadow-sm" onclick="openPinModal('DELETE', ${index})" title="Hapus Data">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Gagal memuat dashboard cloud:", error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">⚠️ Gagal mengambil data Cloud. Pastikan Deployment GAS disetel "Anyone".</td></tr>`;
    }
}

// 7. Logika Pemanggil Modal PIN Otomatis
function openPinModal(action, index) {
    inputPinAction.value = action;
    inputPinIndex.value = index;
    inputPin.value = ""; 
    pinError.classList.add('d-none'); 
    pinModal.show();
}

// Tombol Trigger Khusus untuk Clear Data LocalStorage (Jika Diperlukan)
function openPinModalForClear() {
    inputPinAction.value = 'CLEAR_ALL';
    inputPinIndex.value = ''; 
    inputPin.value = "";
    pinError.classList.add('d-none');
    pinModal.show();
}

// 8. Validasi PIN saat tombol di dalam Modal diklik
btnVerifyPin.addEventListener('click', () => {
    const enteredPin = inputPin.value;
    const action = inputPinAction.value;
    const index = inputPinIndex.value;

    if (enteredPin === PIN_KEAMANAN_KPU) {
        pinModal.hide(); // Tutup modal jika PIN klop
        
        if (action === 'EDIT') {
            executeEditData(index);
        } else if (action === 'DELETE') {
            executeDeleteData(index);
        } else if (action === 'CLEAR_ALL') {
            localStorage.removeItem('kpu_guestbook');
            alert("Local storage dibersihkan.");
            loadDashboard();
        }
    } else {
        pinError.classList.remove('d-none'); // Tampilkan teks merah
        inputPin.value = ""; 
    }
});

// 9. Eksekusi Pengisian Form untuk Edit Data Cloud
function executeEditData(index) {
    const item = memoriCloudLokal[index];

    document.getElementById('edit-index').value = index;
    keyWaktuEditCloud = item.waktu; // Tanda pengenal baris di Spreadsheet

    document.getElementById('nama').value = item.nama;
    document.getElementById('instansi').value = item.instansi;
    document.getElementById('whatsapp').value = item.whatsapp;
    document.getElementById('tujuan').value = item.tujuan;
    document.getElementById('keperluan').value = item.keperluan;
    
    // Tampilkan foto lama yang ada di Drive ke box pratinjau form
    tumpukanFotoBase64 = convertDriveUrlToDirect(item.foto);
    video.style.display = 'none';
    photoPreview.src = tumpukanFotoBase64;
    photoPreview.style.display = 'block';
    btnSnap.style.display = 'none';
    btnRetry.style.display = 'inline-block';

    document.getElementById('form-title').innerHTML = `<i class="bi bi-pencil-square text-warning"></i> Edit Data Cloud: ${item.nama}`;
    document.getElementById('btn-submit').className = "btn btn-warning w-100 py-2 fw-bold text-dark";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-save-fill me-2"></i>Perbarui Kehadiran Cloud`;
    document.getElementById('btn-cancel-edit').style.display = "block";

    // Kembalikan pandangan user ke form utama
    const formTab = new bootstrap.Tab(document.getElementById('pills-form-tab'));
    formTab.show();
}

// 10. Eksekusi Perintah Ekstirpasi / Hapus Permanen Data di Cloud (Sheets & Drive)
async function executeDeleteData(index) {
    const item = memoriCloudLokal[index];
    if (!confirm(`Apakah Peserta yakin menghapus kunjungan dari "${item.nama}" secara permanen dari Cloud KPU?`)) return;

    const tbody = document.getElementById('tabel-tamu-body');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-danger" role="status"></span> Menghapus berkas di Cloud Google...</td></tr>`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "DELETE",
                waktu: item.waktu
            })
        });

        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        alert("✓ Sukses! Baris data di Spreadsheet dan File Foto di Drive berhasil dihapus.");
        loadDashboard();

    } catch (error) {
        console.error("Gagal menghapus data:", error);
        alert("⚠️ Gagal menghapus data dari server Cloud. Periksa koneksi internet.");
        loadDashboard();
    }
}

// 11. Fungsi Batalkan Komando Edit
function cancelEdit() {
    form.reset();
    document.getElementById('edit-index').value = "";
    keyWaktuEditCloud = "";
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';

    document.getElementById('form-title').textContent = "Data Kunjungan";
    document.getElementById('btn-submit').className = "btn btn-primary w-100 py-2 fw-bold";
    document.getElementById('btn-submit').style.backgroundColor = "#4f46e5";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Simpan Kehadiran`;
    document.getElementById('btn-cancel-edit').style.display = "none";
}

// 12. Preview Modal Gambar Pembesaran
function viewPhoto(base64Src) {
    document.getElementById('modal-img-view').src = base64Src;
    const photoModal = new bootstrap.Modal(document.getElementById('photoModal'));
    photoModal.show();
}

// 13. EKSPOR DATA REAL CLOUD KE CSV & ZIP
btnExport.addEventListener('click', () => {
    if (memoriCloudLokal.length === 0) return alert("Tidak ada data kunjungan untuk diekspor.");

    const zip = new JSZip();
    let csvContent = "\uFEFFsep=,\nWaktu Kunjungan,Nama Lengkap,Instansi / Asal,No. Whatsapp,Tujuan,Keperluan,Tautan Arsip Foto Cloud\n";

    memoriCloudLokal.forEach((item, index) => {
        let row = `"${item.waktu}","${item.nama.replace(/"/g, '""')}","${item.instansi.replace(/"/g, '""')}","${item.whatsapp}","${item.tujuan.replace(/"/g, '""')}","${item.keperluan.replace(/"/g, '""')}","${item.foto}"`;
        csvContent += row + "\n";
    });

    zip.file("Data_Tamu_Cloud_KPU_Kuningan.csv", csvContent);
    zip.generateAsync({ type: "blob" }).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Rekap_Buku_Tamu_Cloud_KPU_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

// Jalankan pemuatan dashboard pertama kali halaman diakses
document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});
