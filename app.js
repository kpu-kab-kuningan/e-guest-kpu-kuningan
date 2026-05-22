// ==========================================
// KUNCI INTEGRASI CLOUD GOOGLE WORKSPACE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjkSV5Xttfq0W-g-0463y4twYwgaYiFYC9_SvjySWkjOMPjNo3lzK0wn1ms5GGWpdAog/exec";
const PIN_KEAMANAN_KPU = "2324"; // PIN rahasia Peserta

// Inisialisasi Elemen HTML
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const btnSnap = document.getElementById('btn-snap');
const btnRetry = document.getElementById('btn-retry');
const form = document.getElementById('guest-form');
const btnExport = document.getElementById('btn-export');

let tumpukanFotoBase64 = "";
let memoriCloudLokal = []; // Menyimpan salinan data dari cloud
let keyWaktuEditCloud = ""; // Menyimpan kunci waktu data yang sedang di-edit
let indeksAksiDipilih = null; 
let tipeAksiInternal = ""; // Penanda jenis aksi: "EDIT", "DELETE", atau "CLEAR"

// 1. Jalankan Kamera Otomatis Saat Aplikasi Dibuka
if (video) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(stream => { video.srcObject = stream; })
        .catch(err => { console.warn("Mohon aktifkan izin kamera pada perangkat.", err); });
}

// 2. Ambil Gambar dari Kamera
btnSnap?.addEventListener('click', () => {
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    tumpukanFotoBase64 = canvas.toDataURL('image/jpeg');
    
    video.style.display = 'none';
    photoPreview.src = tumpukanFotoBase64;
    photoPreview.style.display = 'block';
    
    btnSnap.style.display = 'none';
    btnRetry.style.display = 'inline-block';
});

// 3. Foto Ulang (Perbaikan Typo Sintaks)
btnRetry?.addEventListener('click', () => {
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';
});

// 4. Manajemen Submit Form (Tambah Baru / Edit di Cloud)
form?.addEventListener('submit', async (e) => {
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
        foto: tumpukanFotoBase64
    };

    const btnSubmit = document.getElementById('btn-submit');
    const originalBtnText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Memproses Cloud...`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataTamu)
        });
        
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        alert(`✓ Sukses! ${dataTamu.action === "EDIT" ? "Data berhasil diperbarui" : "Data baru tercatat"} di Cloud KPU.`);
        cancelEdit();
        loadDashboard();

    } catch (error) {
        console.error("Error sinkronisasi cloud:", error);
        alert("⚠️ Gagal memproses data ke Cloud Google. Periksa koneksi internet.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
    }
});

// Fungsi bantuan konversi link gambar drive
function convertDriveUrlToDirect(url) {
    if (!url || url === "Tidak Ada Foto") return "https://placehold.co/100x100?text=No+Photo";
    if (url.startsWith("data:image")) return url;
    const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
    return match && match[1] ? `https://docs.google.com/uc?export=view&id=${match[1]}` : url;
}

// 5. Muat KPI Dashboard & Isi Tabel
async function loadDashboard() {
    const tbody = document.getElementById('tabel-tamu-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary" role="status"></span> Mengambil data dari Cloud KPU...</td></tr>`;

    try {
        const response = await fetch(SCRIPT_URL);
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        memoriCloudLokal = hasil.data; 
        const todayStr = new Date().toLocaleDateString('id-ID');

        const tamuHariIni = memoriCloudLokal.filter(item => item.waktu && item.waktu.includes(todayStr)).length;
        document.getElementById('dash-total').textContent = memoriCloudLokal.length;
        document.getElementById('dash-today').textContent = tamuHariIni;

        tbody.innerHTML = "";

        if (memoriCloudLokal.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Belum ada data kunjungan tamu di Cloud.</td></tr>`;
            return;
        }

        memoriCloudLokal.forEach((item, index) => {
            const nomorUrut = index + 1;
            const linkFotoDirect = convertDriveUrlToDirect(item.foto);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center fw-bold text-secondary">${nomorUrut}</td>
                <td class="text-center">
                    <img src="${linkFotoDirect}" class="img-table" onclick="viewPhoto('${linkFotoDirect}')" onerror="this.src='https://placehold.co/100x100?text=Error+Image'">
                </td>
                <td class="small fw-semibold text-secondary text-center">${item.waktu}</td>
                <td class="fw-bold">${item.nama}</td>
                <td><span class="badge bg-light text-dark border">${item.instansi}</span></td>
                <td>${item.whatsapp}</td>
                <td class="small">${item.tujuan}</td>
                <td>${item.keperluan}</td>
                <td>
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-warning btn-round text-dark shadow-sm" onclick="bukaModalPinKpu(${index}, 'EDIT')" title="Edit Data">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-danger btn-round shadow-sm" onclick="bukaModalPinKpu(${index}, 'DELETE')" title="Hapus Data">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Gagal memuat dashboard cloud:", error);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">⚠️ Gagal memuat data dari Cloud KPU. Silakan periksa jaringan internet tablet.</td></tr>`;
    }
}

// ==========================================
// JALUR VALIDASI INTERFACES MODAL PIN DIGITAL
// ==========================================
function bukaModalPinKpu(index, aksi) {
    indeksAksiDipilih = index;
    tipeAksiInternal = aksi;
    
    document.getElementById('input-pin').value = "";
    document.getElementById('pin-error').classList.add('d-none');
    
    const pinModal = new bootstrap.Modal(document.getElementById('pinModal'));
    pinModal.show();
}

// Handler Validasi saat Tombol "Verifikasi" di Modal di-Klik
document.getElementById('btn-verify-pin')?.addEventListener('click', () => {
    const inputPin = document.getElementById('input-pin').value;
    
    if (inputPin !== PIN_KEAMANAN_KPU) {
        document.getElementById('pin-error').classList.remove('d-none');
        return;
    }

    // Jika PIN benar, tutup modal secara aman
    const pinModalElement = document.getElementById('pinModal');
    const modalInstance = bootstrap.Modal.getInstance(pinModalElement);
    modalInstance.hide();

    // Alihkan ke fungsi eksekusi yang sesuai
    if (tipeAksiInternal === "EDIT") {
        eksekusiEditCloud(indeksAksiDipilih);
    } else if (tipeAksiInternal === "DELETE") {
        eksekusiDeleteCloud(indeksAksiDipilih);
    } else if (tipeAksiInternal === "CLEAR") {
        eksekusiClearData();
    }
});

// 6. Jalur Eksekusi Form Edit
function eksekusiEditCloud(index) {
    const item = memoriCloudLokal[index];

    document.getElementById('edit-index').value = index;
    keyWaktuEditCloud = item.waktu;

    document.getElementById('nama').value = item.nama;
    document.getElementById('instansi').value = item.instansi;
    document.getElementById('whatsapp').value = item.whatsapp;
    document.getElementById('tujuan').value = item.tujuan;
    document.getElementById('keperluan').value = item.keperluan;
    
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

    const formTab = new bootstrap.Tab(document.getElementById('pills-form-tab'));
    formTab.show();
}

// 7. Fungsi Batalkan Edit
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

// 8. Jalur Eksekusi Hapus Berkas Cloud
async function eksekusiDeleteCloud(index) {
    const item = memoriCloudLokal[index];
    if (!confirm(`Apakah Peserta yakin ingin menghapus kunjungan dari "${item.nama}" secara permanen?`)) return;

    const tbody = document.getElementById('tabel-tamu-body');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-danger" role="status"></span> Menghapus data dari Cloud...</td></tr>`;

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

        alert("✓ Sukses! Data & Foto berhasil dimusnahkan dari Cloud Google.");
        loadDashboard();

    } catch (error) {
        console.error("Gagal menghapus data:", error);
        alert("⚠️ Gagal menghapus data dari server Cloud. Periksa koneksi internet.");
        loadDashboard();
    }
}

// 9. Preview Foto Besar
function viewPhoto(base64Src) {
    document.getElementById('modal-img-view').src = base64Src;
    const photoModal = new bootstrap.Modal(document.getElementById('photoModal'));
    photoModal.show();
}

// 10. Bersihkan Seluruh Database Perangkat (Terproteksi Modal PIN)
function clearData() {
    bukaModalPinKpu(null, 'CLEAR');
}

function eksekusiClearData() {
    localStorage.removeItem('kpu_guestbook');
    alert("Local storage berhasil dibersihkan.");
    loadDashboard();
}

// 11. GENERATE ZIP DATA CLOUD
btnExport?.addEventListener('click', () => {
    if (memoriCloudLokal.length === 0) return alert("Tidak ada data kunjungan untuk diekspor.");

    const zip = new JSZip();
    let csvContent = "\uFEFFsep=,\nWaktu Kunjungan,Nama Lengkap,Instansi / Asal,No. Whatsapp,Tujuan,Keperluan,Tautan Foto Cloud\n";

    memoriCloudLokal.forEach((item, index) => {
        let row = `"${item.waktu}","${item.nama.replace(/"/g, '""')}","${item.instansi.replace(/"/g, '""')}","${item.whatsapp}","${item.tujuan.replace(/"/g, '""')}","${item.keperluan.replace(/"/g, '""')}","${item.foto}"`;
        csvContent += row + "\n";
    });

    zip.file("Data_Tamu_Cloud_KPU_Kuningan.csv", csvContent);
    zip.generateAsync({ type: "blob" }).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Rekap_Buku_Tamu_Cloud_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

// Jalankan fungsi dashboard saat halaman selesai dimuat pertama kali
document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});
