// ==========================================
// KUNCI INTEGRASI CLOUD GOOGLE WORKSPACE
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwou71aDQvqioG_4-F9Tlme1OwpvWcCyPcwfDoISbytpf3w5Oi31AyNpDTiNsmrBxN3Fg/exec";
const PIN_KEAMANAN_KPU = "657139"; // PIN rahasia Peserta

// Inisialisasi Elemen HTML
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photo-preview');
const btnSnap = document.getElementById('btn-snap');
const btnRetry = document.getElementById('btn-retry');
const form = document.getElementById('guest-form');
const btnExport = document.getElementById('btn-export');

let tumpukanFotoBase64 = "";
let memoriCloudLokal = [];    // Salinan data tamu
let memoriPegawaiLokal = [];  // Salinan data pegawai/pejabat
let keyWaktuEditCloud = "";  
let indeksAksiDipilih = null; 
let tipeAksiInternal = "";   

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

// 3. Foto Ulang
btnRetry?.addEventListener('click', () => {
    tumpukanFotoBase64 = "";
    photoPreview.style.display = 'none';
    video.style.display = 'block';
    btnSnap.style.display = 'inline-block';
    btnRetry.style.display = 'none';
});

// 4. Manajemen Submit Form Tamu
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
            headers: { "Content-Type": "text/plain;charset=utf-8" },
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

// 5. Muat Utama Dashboard, Tabel Tamu, & Kartu Pejabat
async function loadDashboard() {
    const tbody = document.getElementById('tabel-tamu-body');
    const containerPejabat = document.getElementById('container-status-pejabat');
    
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-primary" role="status"></span> Mengambil data dari Cloud KPU...</td></tr>`;
    if (containerPejabat) containerPejabat.innerHTML = `<div class="text-center py-5 w-100 text-muted"><span class="spinner-border spinner-border-sm text-primary"></span> Menghubungkan ke Status Pegawai...</div>`;

    try {
        const response = await fetch(SCRIPT_URL);
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        // A. AMBIL DATA TAMU
        memoriCloudLokal = hasil.dataTamu || [];
        const todayStr = new Date().toLocaleDateString('id-ID');
        const tamuHariIni = memoriCloudLokal.filter(item => item.waktu && item.waktu.includes(todayStr)).length;
        
        if(document.getElementById('dash-total')) document.getElementById('dash-total').textContent = memoriCloudLokal.length;
        if(document.getElementById('dash-today')) document.getElementById('dash-today').textContent = tamuHariIni;

        renderTabelLengkap(memoriCloudLokal);

        // B. AMBIL DATA PEJABAT
        memoriPegawaiLokal = hasil.dataPegawai || [];
        renderKartuPejabat(memoriPegawaiLokal);

    } catch (error) {
        console.error("Gagal memuat dashboard cloud:", error);
        if(tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">⚠️ Gagal memuat data dari Cloud KPU. Silakan periksa jaringan internet tablet.</td></tr>`;
    }
}

// Render Kartu Pejabat Dinamis (Gen-Z Clean Grid View)
function renderKartuPejabat(dataArray) {
    const containerPejabat = document.getElementById('container-status-pejabat');
    if (!containerPejabat) return;
    containerPejabat.innerHTML = "";
    
    if (dataArray.length === 0) {
        containerPejabat.innerHTML = `<div class="text-center py-4 text-muted w-100">Tidak ada data pejabat yang cocok.</div>`;
        return;
    }
    
    dataArray.forEach(p => {
        const isAvailable = p.available.toLowerCase() === 'yes';
        const statusColor = isAvailable ? '#10b981' : '#94a3b8'; 
        const statusLabel = isAvailable ? 'Tersedia' : 'Dinas Luar / Sibuk';
        
        const card = document.createElement('div');
        card.className = "col-md-6 col-lg-4";
        card.innerHTML = `
            <div class="card border-0 shadow-sm p-3 h-100" style="border-radius: 16px; background: #fff; border: 1px solid #f1f5f9 !important;">
                <div class="d-flex align-items-center gap-3">
                    <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm" 
                         style="width: 50px; height: 50px; background: ${isAvailable ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #94a3b8, #64748b)'}; font-size: 1.2rem;">
                        ${p.nama.charAt(0)}
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 fw-bold text-dark" style="font-size:0.95rem;">${p.nama}</h6>
                        <small class="text-muted d-block" style="font-size: 0.75rem;">${p.jabatan}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge" style="background: ${statusColor}20; color: ${statusColor}; font-size: 0.7rem; border: 1px solid ${statusColor}40; padding: 6px 10px; border-radius: 8px;">
                            <i class="bi bi-circle-fill me-1" style="font-size: 0.5rem;"></i> ${statusLabel}
                        </span>
                    </div>
                </div>
            </div>
        `;
        containerPejabat.appendChild(card);
    });
}

function renderTabelLengkap(dataArray) {
    const tbody = document.getElementById('tabel-tamu-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    if (dataArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Tidak ada data kunjungan tamu yang cocok.</td></tr>`;
        return;
    }

    dataArray.forEach((item, index) => {
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
}

// Filter Pencarian Tabel Tamu
function jalankanFilterTerpadu() {
    const kataKunci = document.getElementById('search-input')?.value.toLowerCase() || "";
    const filterBulan = document.getElementById('filter-bulan')?.value || "ALL";

    const dataHasilFilter = memoriCloudLokal.filter(item => {
        const cocokSearch = item.nama.toLowerCase().includes(kataKunci) || item.instansi.toLowerCase().includes(kataKunci) || item.tujuan.toLowerCase().includes(kataKunci) || item.keperluan.toLowerCase().includes(kataKunci);
        let cocokBulan = true;
        if (filterBulan !== "ALL" && item.waktu) {
            const bagianTanggal = item.waktu.split(',')[0]; 
            const pecahAngka = bagianTanggal.split(/\/|-/); 
            if (pecahAngka.length >= 2) {
                const bulanData = pecahAngka[1].padStart(2, '0'); 
                cocokBulan = (bulanData === filterBulan);
            }
        }
        return cocokSearch && cocokBulan;
    });
    renderTabelLengkap(dataHasilFilter);
}
document.getElementById('search-input')?.addEventListener('input', jalankanFilterTerpadu);

// FILTER LIVE UNTUK KARTU PEJABAT (FITUR BARU)
document.getElementById('search-pejabat')?.addEventListener('input', function() {
    const kataKunci = this.value.toLowerCase();
    const dataHasilFilter = memoriPegawaiLokal.filter(p => 
        p.nama.toLowerCase().includes(kataKunci) || 
        p.jabatan.toLowerCase().includes(kataKunci)
    );
    renderKartuPejabat(dataHasilFilter);
});

// Dropdown filter bulan tamu
document.querySelectorAll('.dropdown-menu .dropdown-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const nilaiBulan = this.getAttribute('data-val');
        if (!nilaiBulan) return;
        document.getElementById('label-filter-bulan').textContent = this.textContent;
        document.getElementById('filter-bulan').value = nilaiBulan;
        document.querySelectorAll('.dropdown-menu .dropdown-item').forEach(el => el.classList.remove('active', 'bg-primary', 'text-white'));
        this.classList.add('active', 'bg-primary', 'text-white');
        jalankanFilterTerpadu();
    });
});

// Navigasi Menu Utama Sidebar
function gantiTampilanUtama(namaTampilan) {
    const views = { 'dashboard': document.getElementById('view-dashboard'), 'tambah': document.getElementById('view-tambah'), 'pejabat': document.getElementById('view-pejabat') };
    const menus = { 'dashboard': document.getElementById('menu-dashboard'), 'tambah': document.getElementById('menu-tambah'), 'pejabat': document.getElementById('menu-pejabat') };
    const judulHeader = document.getElementById('judul-halaman');

    Object.keys(views).forEach(key => {
        if (views[key]) { views[key].classList.remove('d-block'); views[key].classList.add('d-none'); }
        if (menus[key]) menus[key].classList.remove('active');
    });

    if (views[namaTampilan]) { views[namaTampilan].classList.remove('d-none'); views[namaTampilan].classList.add('d-block'); }
    if (menus[namaTampilan]) menus[namaTampilan].classList.add('active');

    if (judulHeader) {
        if(namaTampilan === 'dashboard') judulHeader.innerText = "Dashboard Monitoring Tamu";
        if(namaTampilan === 'tambah') judulHeader.innerText = "Form Pendataan Tamu";
        if(namaTampilan === 'pejabat') judulHeader.innerText = "Informasi Status Pejabat";
    }
    if (window.innerWidth <= 768) document.getElementById('wrapper')?.classList.remove('toggled');
}

// Proteksi PIN Verifikasi
function bukaModalPinKpu(index, aksi) {
    indeksAksiDipilih = index;
    tipeAksiInternal = aksi;
    document.getElementById('input-pin').value = "";
    document.getElementById('pin-error').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('pinModal')).show();
}

document.getElementById('btn-verify-pin')?.addEventListener('click', () => {
    const inputPin = document.getElementById('input-pin').value;
    if (inputPin !== PIN_KEAMANAN_KPU) {
        document.getElementById('pin-error').classList.remove('d-none');
        return;
    }
    const modalInstance = bootstrap.Modal.getInstance(document.getElementById('pinModal'));
    modalInstance.hide();

    if (tipeAksiInternal === "EDIT") eksekusiEditCloud(indeksAksiDipilih);
    else if (tipeAksiInternal === "DELETE") eksekusiDeleteCloud(indeksAksiDipilih);
    else if (tipeAksiInternal === "CLEAR") eksekusiClearData();
    else if (tipeAksiInternal === "MANAGE_PEJABAT") eksekusiBukaModalKelolaStatus(); // Akses khusus Pejabat
});

// Pemicu Tombol Kelola Status Pejabat
function mintaAksesKelolaStatus() {
    bukaModalPinKpu(null, 'MANAGE_PEJABAT');
}

// Buka Modal Pop-up Dropdown Pejabat (FITUR BARU)
function eksekusiBukaModalKelolaStatus() {
    const tbody = document.getElementById('tabel-edit-status-body');
    if (!tbody) return;
    tbody.innerHTML = "";

    memoriPegawaiLokal.forEach((p) => {
        const isYes = p.available.toLowerCase() === 'yes';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-dark ps-3" style="font-size: 0.9rem; white-space:nowrap;">${p.nama}</td>
            <td>
                <select class="form-select form-select-sm select-status-pejabat btn-round shadow-none" data-nama="${p.nama}" style="font-size: 0.85rem; border-color:#cbd5e1;">
                    <option value="Yes" ${isYes ? 'selected' : ''}>🟢 Tersedia (Yes)</option>
                    <option value="No" ${!isYes ? 'selected' : ''}>🔴 Dinas Luar / Sibuk (No)</option>
                </select>
            </td>
        `;
        tbody.appendChild(tr);
    });

    new bootstrap.Modal(document.getElementById('modalStatusPejabat')).show();
}

// Kirim Batch Perubahan Status ke Google Sheet Cloud (FITUR BARU)
async function kirimPerubahanStatusCloud() {
    const selects = document.querySelectorAll('.select-status-pejabat');
    const updates = [];

    selects.forEach(sel => {
        updates.push({
            nama: sel.getAttribute('data-nama'),
            available: sel.value
        });
    });

    const btnSimpan = document.getElementById('btn-simpan-status-pejabat');
    const originalText = btnSimpan.innerHTML;
    btnSimpan.disabled = true;
    btnSimpan.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Menyimpan ke Cloud...`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "UPDATE_STATUS_PEJABAT",
                updates: updates
            })
        });

        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);

        alert("✓ Sukses! Status ketersediaan pejabat berhasil diperbarui di Cloud KPU Kuningan.");
        bootstrap.Modal.getInstance(document.getElementById('modalStatusPejabat')).hide();
        loadDashboard();

    } catch (error) {
        console.error("Error update status pejabat:", error);
        alert("⚠️ Gagal memperbarui status ke Cloud Google. Periksa jaringan.");
    } finally {
        btnSimpan.disabled = false;
        btnSimpan.innerHTML = originalText;
    }
}

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
    gantiTampilanUtama('tambah');
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
    document.getElementById('form-title').textContent = "Data Kunjungan";
    document.getElementById('btn-submit').className = "btn btn-primary w-100 py-2 fw-bold";
    document.getElementById('btn-submit').style.backgroundColor = "#4f46e5";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-check-circle-fill me-2"></i>Simpan Kehadiran`;
    document.getElementById('btn-cancel-edit').style.display = "none";
}

async function eksekusiDeleteCloud(index) {
    const item = memoriCloudLokal[index];
    if (!confirm(`Apakah Peserta yakin ingin menghapus kunjungan dari "${item.nama}" secara permanen?`)) return;

    const tbody = document.getElementById('tabel-tamu-body');
    if(tbody) tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4"><span class="spinner-border spinner-border-sm text-danger" role="status"></span> Menghapus data...</td></tr>`;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "DELETE", waktu: item.waktu })
        });
        const hasil = await response.json();
        if (hasil.status !== 'success') throw new Error(hasil.message);
        alert("✓ Sukses! Data & Foto berhasil dimusnahkan dari Cloud Google.");
        loadDashboard();
    } catch (error) {
        alert("⚠️ Gagal menghapus data dari server Cloud. Periksa koneksi internet.");
        loadDashboard();
    }
}

function viewPhoto(base64Src) {
    document.getElementById('modal-img-view').src = base64Src;
    new bootstrap.Modal(document.getElementById('photoModal')).show();
}

function clearData() { bukaModalPinKpu(null, 'CLEAR'); }
function eksekusiClearData() { localStorage.removeItem('kpu_guestbook'); alert("Local storage dibersihkan."); loadDashboard(); }

btnExport?.addEventListener('click', () => {
    if (memoriCloudLokal.length === 0) return alert("Tidak ada data kunjungan untuk diekspor.");
    const zip = new JSZip();
    let csvContent = "\uFEFFsep=,\nWaktu Kunjungan,Nama Lengkap,Instansi / Asal,No. Whatsapp,Tujuan,Keperluan,Tautan Foto Cloud\n";
    memoriCloudLokal.forEach((item) => {
        csvContent += `"${item.waktu}","${item.nama.replace(/"/g, '""')}","${item.instansi.replace(/"/g, '""')}","${item.whatsapp}","${item.tujuan.replace(/"/g, '""')}","${item.keperluan.replace(/"/g, '""')}","${item.foto}"\n`;
    });
    zip.file("Data_Tamu_Cloud_KPU_Kuningan.csv", csvContent);
    zip.generateAsync({ type: "blob" }).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Rekap_Buku_Tamu_Cloud_${Date.now()}.zip`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    });
});

document.addEventListener("DOMContentLoaded", () => { loadDashboard(); });
