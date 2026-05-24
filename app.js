// ==========================================
// KUNCI INTEGRASI CLOUD GOOGLE WORKSPACE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzLkt4uA4mphlac0wHaXOOUKusm3JIxM__AxjJNPuADHIHn3W2sFyUI0QEI3DclXYX99Q/exec";
const PIN_KEAMANAN_KPU = "657139"; // PIN rahasia Peserta (6 Digit)

// Inisialisasi Elemen Form & Kamera
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const btnSnap = document.getElementById('btn-snap');
const btnRetry = document.getElementById('btn-retry');
const form = document.getElementById('guest-form')
const btnExport = document.getElementById('btn-export');

let tumpukanFotoBase64 = "";
let memoriCloudLokal = []; 
let keyWaktuEditCloud = ""; 
let indeksAksiDipilih = null; 
let tipeAksiInternal = ""; 

// ==========================================
// FUNGSI NAVIGASI SIDEBAR (Single Page App)
// ==========================================

// Buka/Tutup Sidebar (Hamburger Menu Toggle)
document.getElementById('menu-toggle')?.addEventListener('click', function() {
    document.getElementById('wrapper').classList.toggle('toggled');
});

// Pindah Antar Layar (Dashboard vs Tambah Tamu)
function gantiTampilanUtama(namaTampilan) {
    const viewDash = document.getElementById('view-dashboard');
    const viewTambah = document.getElementById('view-tambah');
    const menuDash = document.getElementById('menu-dashboard');
    const menuTambah = document.getElementById('menu-tambah');
    const judulHeader = document.getElementById('judul-halaman');

    if (namaTampilan === 'dashboard') {
        viewDash.classList.remove('d-none');
        viewDash.classList.add('d-block');
        viewTambah.classList.remove('d-block');
        viewTambah.classList.add('d-none');
        
        menuDash.classList.add('active');
        menuTambah.classList.remove('active');
        judulHeader.innerText = "Dashboard Monitoring Tamu";
        
        // Auto tutup sidebar jika sedang diakses dari HP
        if (window.innerWidth <= 768) document.getElementById('wrapper').classList.remove('toggled');
        
    } else if (namaTampilan === 'tambah') {
        viewTambah.classList.remove('d-none');
        viewTambah.classList.add('d-block');
        viewDash.classList.remove('d-block');
        viewDash.classList.add('d-none');
        
        menuTambah.classList.add('active');
        menuDash.classList.remove('active');
        judulHeader.innerText = "Form Pendataan Tamu";
        
        if (window.innerWidth <= 768) document.getElementById('wrapper').classList.remove('toggled');
    }
}

// ==========================================
// KONTROL KAMERA & FORMULIR
// ==========================================

// Nyalakan Kamera Otomatis Saat Web Dibuka
if (video) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        .then(stream => { video.srcObject = stream; })
        .catch(err => { console.warn("Kamera tidak ditemukan atau diizinkan.", err); });
}

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

btnRetry?.addEventListener('click', () => {
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';
});

// Submit Form (Kirim ke Cloud)
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!tumpukanFotoBase64) {
        return alert("Harap ambil foto tamu terlebih dahulu!");
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
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Mengirim data...`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(dataTamu)
        });
        
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        alert(`✓ Berhasil! Data telah ${dataTamu.action === "EDIT" ? "diperbarui" : "dicatat"} ke Cloud KPU.`);
        cancelEdit();
        
        // Pindah otomatis kembali ke Dashboard setelah sukses daftar tamu
        gantiTampilanUtama('dashboard');
        loadDashboard();

    } catch (error) {
        alert("⚠️ Gagal mengirim data. Cek koneksi internet.");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
    }
});

// ==========================================
// TAMPILAN DASHBOARD DATA & KEAMANAN PIN
// ==========================================

async function loadDashboard() {
    const tbody = document.getElementById('tabel-tamu-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-primary"><span class="spinner-border spinner-border-sm" role="status"></span> Menyinkronkan Data Cloud KPU...</td></tr>`;

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
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Belum ada riwayat kunjungan.</td></tr>`;
            return;
        }

        // Render Data Berurutan (Terlama di atas, terbaru di bawah)
        memoriCloudLokal.forEach((item, index) => {
            const nomorUrut = index + 1;
            const linkFotoDirect = convertDriveUrlToDirect(item.foto);
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center fw-bold text-secondary">${nomorUrut}</td>
                <td class="text-center">
                    <img src="${linkFotoDirect}" class="img-table shadow-sm" onclick="viewPhoto('${linkFotoDirect}')" onerror="this.src='https://placehold.co/100x100?text=No+Photo'">
                </td>
                <td class="small fw-semibold text-secondary text-center">${item.waktu}</td>
                <td class="fw-bold">${item.nama}</td>
                <td><span class="badge bg-light text-dark border">${item.instansi}</span></td>
                <td><a href="https://wa.me/${item.whatsapp}" target="_blank" class="text-decoration-none text-success"><i class="bi bi-whatsapp"></i> ${item.whatsapp}</a></td>
                <td class="small fw-bold">${item.tujuan}</td>
                <td class="small">${item.keperluan}</td>
                <td>
                    <div class="d-flex justify-content-center gap-2">
                        <button class="btn btn-warning btn-sm btn-round text-dark border shadow-sm" onclick="bukaModalPinKpu(${index}, 'EDIT')" title="Edit Kunjungan">
                            <i class="bi bi-pencil-fill"></i>
                        </button>
                        <button class="btn btn-danger btn-sm btn-round shadow-sm" onclick="bukaModalPinKpu(${index}, 'DELETE')" title="Hapus Kunjungan">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">⚠️ Gagal mengambil data Cloud. Silakan refresh halaman.</td></tr>`;
    }
}

// Sistem Otorisasi PIN Modal
function bukaModalPinKpu(index, aksi) {
    indeksAksiDipilih = index;
    tipeAksiInternal = aksi;
    document.getElementById('input-pin').value = "";
    document.getElementById('pin-error').classList.add('d-none');
    
    const pinModal = new bootstrap.Modal(document.getElementById('pinModal'));
    pinModal.show();
}

document.getElementById('btn-verify-pin')?.addEventListener('click', () => {
    const inputPin = document.getElementById('input-pin').value;
    
    // Mengecek kesesuaian dengan PIN pesanan Peserta
    if (inputPin !== PIN_KEAMANAN_KPU) {
        document.getElementById('pin-error').classList.remove('d-none');
        return;
    }

    const pinModalElement = document.getElementById('pinModal');
    const modalInstance = bootstrap.Modal.getInstance(pinModalElement);
    modalInstance.hide();

    if (tipeAksiInternal === "EDIT") {
        eksekusiEditCloud(indeksAksiDipilih);
    } else if (tipeAksiInternal === "DELETE") {
        eksekusiDeleteCloud(indeksAksiDipilih);
    } else if (tipeAksiInternal === "CLEAR") {
        eksekusiClearData();
    }
});

// ==========================================
// EKSEKUTOR AKSI (TERLINDUNGI PIN)
// ==========================================

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

    document.getElementById('form-title').innerHTML = `<i class="bi bi-pencil-square text-warning me-2"></i> Mode Edit: ${item.nama}`;
    document.getElementById('btn-submit').className = "btn btn-warning w-100 py-2 fw-bold text-dark";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-save-fill me-2"></i>Perbarui Data Tamu`;
    document.getElementById('btn-cancel-edit').style.display = "block";

    // Lempar pengguna ke halaman form secara paksa
    gantiTampilanUtama('tambah');
}

async function eksekusiDeleteCloud(index) {
    const item = memoriCloudLokal[index];
    if (!confirm(`Hapus permanen jejak kunjungan dari "${item.nama}"?`)) return;

    const tbody = document.getElementById('tabel-tamu-body');
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger"><span class="spinner-border spinner-border-sm"></span> Menghapus arsip Cloud...</td></tr>`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "DELETE", waktu: item.waktu })
        });
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);
        loadDashboard();
    } catch (error) {
        alert("⚠️ Gagal menghapus data di server Cloud.");
        loadDashboard();
    }
}

function cancelEdit() {
    form.reset();
    document.getElementById('edit-index').value = "";
    keyWaktuEditCloud = "";
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';

    document.getElementById('form-title').textContent = "Pendaftaran Kehadiran Baru";
    document.getElementById('btn-submit').className = "btn btn-primary w-100 py-2 fw-bold";
    document.getElementById('btn-submit').style.backgroundColor = "#4f46e5";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Simpan Kehadiran`;
    document.getElementById('btn-cancel-edit').style.display = "none";
}

function viewPhoto(base64Src) {
    document.getElementById('modal-img-view').src = base64Src;
    const photoModal = new bootstrap.Modal(document.getElementById('photoModal'));
    photoModal.show();
}

function clearData() {
    bukaModalPinKpu(null, 'CLEAR');
}

function eksekusiClearData() {
    localStorage.removeItem('kpu_guestbook');
    alert("Sampah penyimpanan browser berhasil dikosongkan.");
    loadDashboard();
}

// Konversi Bypass Foto Google Drive Anti-Error Image
function convertDriveUrlToDirect(url) {
    if (!url || url === "Tidak Ada Foto") return "https://placehold.co/100x100?text=No+Photo";
    if (url.startsWith("data:image")) return url;
    
    // Ekstrak ID unik berkas dari link Google Drive biasa
    const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
    if (match && match[1]) {
        // Menggunakan rendering engine Google User Content (Bebas dari kendala blokir Cookie)
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
}

// Fitur Unduh ZIP Rekap Kehadiran
btnExport?.addEventListener('click', () => {
    if (memoriCloudLokal.length === 0) return alert("Belum ada data kunjungan.");
    const zip = new JSZip();
    let csvContent = "\uFEFFsep=,\nWaktu Kunjungan,Nama Lengkap,Instansi / Asal,No. Whatsapp,Tujuan,Keperluan,Tautan Berkas Drive\n";

    memoriCloudLokal.forEach((item) => {
        let row = `"${item.waktu}","${item.nama.replace(/"/g, '""')}","${item.instansi.replace(/"/g, '""')}","${item.whatsapp}","${item.tujuan.replace(/"/g, '""')}","${item.keperluan.replace(/"/g, '""')}","${item.foto}"`;
        csvContent += row + "\n";
    });

    zip.file("Data_Tamu_Cloud_KPU_Kuningan.csv", csvContent);
    zip.generateAsync({ type: "blob" }).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Rekap_Kehadiran_KPU_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});

// Panggilan Pertama Saat Web Dimuat
document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

// ==========================================
// FITUR FILTER TERPADU (SEARCH TEKS + BULAN)
// ==========================================
function jalankanFilterTerpadu() {
    // Ambil nilai dari kotak pencarian dan dropdown bulan
    const kataKunci = document.getElementById('input-search').value.toLowerCase();
    const bulanPilih = document.getElementById('filter-bulan').value; 
    
    const barisTabel = document.querySelectorAll('#tabel-tamu-body tr');

    barisTabel.forEach(baris => {
        // Lewati jika ini adalah baris pesan "Loading" atau "Kosong"
        if(baris.cells.length < 3) return; 

        const teksBaris = baris.innerText.toLowerCase();
        const teksWaktu = baris.cells[2].innerText; // Mengambil data di kolom "Waktu Kunjungan"

        // Ekstrak angka bulan dari teks waktu (Bekerja untuk format DD/MM/YYYY atau DD-MM-YYYY)
        let bulanBaris = "ALL";
        const matchWaktu = teksWaktu.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/);
        
        if (matchWaktu) {
            const bagianWaktu = matchWaktu[0].split(/[\/\-]/); // Memecah tanggal, bulan, tahun
            bulanBaris = bagianWaktu[1].padStart(2, '0'); // Mengambil bagian bulan dan memastikan 2 digit (misal '5' jadi '05')
        }

        // Cek apakah baris ini lolos kedua kriteria filter
        const cocokSearch = teksBaris.includes(kataKunci);
        const cocokBulan = (bulanPilih === "ALL" || bulanBaris === bulanPilih);

        if (cocokSearch && cocokBulan) {
            baris.style.display = ''; // Tampilkan
        } else {
            baris.style.display = 'none'; // Sembunyikan
        }
    });
}

// Pasang pendeteksi perubahan (Event Listener) pada input search dan dropdown
document.getElementById('input-search')?.addEventListener('input', jalankanFilterTerpadu);
document.getElementById('filter-bulan')?.addEventListener('change', jalankanFilterTerpadu);
