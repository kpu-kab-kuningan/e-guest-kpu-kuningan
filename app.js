// ==========================================
// KUNCI INTEGRASI CLOUD GOOGLE WORKSPACE
// ==========================================
// Link GAS tetap dipertahankan meskipun untuk solusi localStorage ini belum kita pakai penuh
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

// Inisialisasi Elemen Modal PIN
const pinModal = new bootstrap.Modal(document.getElementById('pinModal'));
const inputPin = document.getElementById('input-pin');
const btnVerifyPin = document.getElementById('btn-verify-pin');
const pinError = document.getElementById('pin-error');
const inputPinAction = document.getElementById('pin-action');
const inputPinIndex = document.getElementById('pin-index');

let tumpukanFotoBase64 = "";

// 1. Jalankan Kamera Otomatis Saat Aplikasi Dibuka
navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
    .then(stream => { video.srcObject = stream; })
    .catch(err => { alert("Mohon aktifkan izin kamera pada perangkat."); });

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

// 4. Manajemen Submit Form (Tambah Baru / Simpan Hasil Edit ke LocalStorage)
form.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!tumpukanFotoBase64) {
        return alert("Ambil foto tamu terlebih dahulu sebagai bukti kehadiran!");
    }

    const editIndex = document.getElementById('edit-index').value;
    const listTamu = JSON.parse(localStorage.getItem('kpu_guestbook')) || [];

    const dataTamu = {
        waktu: editIndex !== "" ? listTamu[editIndex].waktu : new Date().toLocaleString('id-ID'),
        tanggalOnly: editIndex !== "" ? listTamu[editIndex].tanggalOnly : new Date().toLocaleDateString('id-ID'),
        nama: document.getElementById('nama').value,
        instansi: document.getElementById('instansi').value,
        whatsapp: document.getElementById('whatsapp').value,
        tujuan: document.getElementById('tujuan').value,
        keperluan: document.getElementById('keperluan').value,
        foto: tumpukanFotoBase64
    };

    if (editIndex !== "") {
        // Mode Edit Data
        listTamu[editIndex] = dataTamu;
        alert("✓ Data kunjungan berhasil diperbarui di LocalStorage!");
    } else {
        // Mode Data Baru
        listTamu.push(dataTamu);
        alert("✓ Data kunjungan berhasil disimpan di LocalStorage!");
    }

    localStorage.setItem('kpu_guestbook', JSON.stringify(listTamu));
    cancelEdit();
});

// 5. Muat KPI Dashboard & Isi Tabel (Fix Masalah Foto Error)
function loadDashboard() {
    const listTamu = JSON.parse(localStorage.getItem('kpu_guestbook')) || [];
    const todayStr = new Date().toLocaleDateString('id-ID');

    // Hitung Tamu Hari Ini
    const tamuHariIni = listTamu.filter(item => item.tanggalOnly === todayStr).length;

    // Perbarui KPI Card
    document.getElementById('dash-total').textContent = listTamu.length;
    document.getElementById('dash-today').textContent = tamuHariIni;

    const tbody = document.getElementById('tabel-tamu-body');
    tbody.innerHTML = "";

    if (listTamu.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Belum ada data kunjungan tamu.</td></tr>`;
        return;
    }

    // Render data berurutan dari Terlama ke Terbaru (Index 0 tetap di paling atas)
    listTamu.forEach((item, index) => {
        const nomorUrut = index + 1;
        const tr = document.createElement('tr');
        
        // Memastikan tag img menggunakan data Base64 valid dan memiliki fallback error image
        tr.innerHTML = `
            <td class="text-center fw-bold text-secondary">${nomorUrut}</td>
            <td class="text-center">
                <img src="${item.foto}" class="img-table" onclick="viewPhoto('${item.foto}')" onerror="this.src='https://placehold.co/100x100?text=Error+Image'">
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
}

// 6. Logika Modal PIN untuk Verifikasi Aksi
function openPinModal(action, index) {
    inputPinAction.value = action;
    inputPinIndex.value = index;
    inputPin.value = ""; // Reset input PIN
    pinError.classList.add('d-none'); // Sembunyikan error lama
    pinModal.show();
}

// Tambahan: PIN Modal untuk tombol Bersihkan Data
function openPinModalForClear() {
    inputPinAction.value = 'CLEAR_ALL';
    inputPinIndex.value = ''; // Tidak perlu index
    inputPin.value = "";
    pinError.classList.add('d-none');
    pinModal.show();
}

btnVerifyPin.addEventListener('click', () => {
    const enteredPin = inputPin.value;
    const action = inputPinAction.value;
    const index = inputPinIndex.value;

    if (enteredPin === PIN_KEAMANAN_KPU) {
        pinModal.hide(); // Sembunyikan modal jika PIN benar
        
        // Eksekusi aksi yang tertunda berdasarkan jenis aksi
        if (action === 'EDIT') {
            executeEditData(index);
        } else if (action === 'DELETE') {
            executeDeleteData(index);
        } else if (action === 'CLEAR_ALL') {
            executeClearData();
        }
    } else {
        // PIN Salah, tampilkan pesan error dalam modal
        pinError.classList.remove('d-none');
        inputPin.value = ""; // Bersihkan input agar user mengetik ulang
    }
});

// Eksekusi Hapus Data Lokal
function executeDeleteData(index) {
    if (confirm("Apakah Peserta yakin ingin menghapus data tamu ini dari LocalStorage?")) {
        const listTamu = JSON.parse(localStorage.getItem('kpu_guestbook')) || [];
        listTamu.splice(index, 1);
        localStorage.setItem('kpu_guestbook', JSON.stringify(listTamu));
        loadDashboard();
    }
}

// Eksekusi Edit Data Lokal
function executeEditData(index) {
    const listTamu = JSON.parse(localStorage.getItem('kpu_guestbook')) || [];
    const item = listTamu[index];

    // Isi Form dengan data lama
    document.getElementById('edit-index').value = index;
    document.getElementById('nama').value = item.nama;
    document.getElementById('instansi').value = item.instansi;
    document.getElementById('whatsapp').value = item.whatsapp;
    document.getElementById('tujuan').value = item.tujuan;
    document.getElementById('keperluan').value = item.keperluan;
    
    // Tampilkan kembali foto lama ke area preview kamera
    tumpukanFotoBase64 = item.foto;
    video.style.display = 'none';
    photoPreview.src = tumpukanFotoBase64;
    photoPreview.style.display = 'block';
    btnSnap.style.display = 'none';
    btnRetry.style.display = 'inline-block';

    // Ubah UI Form ke mode edit
    document.getElementById('form-title').innerHTML = `<i class="bi bi-pencil-square text-warning"></i> Edit Data Lokal: ${item.nama}`;
    document.getElementById('btn-submit').className = "btn btn-warning w-100 py-2 fw-bold text-dark";
    document.getElementById('btn-submit').innerHTML = `<i class="bi bi-save-fill me-2"></i>Perbarui Kehadiran Lokal`;
    document.getElementById('btn-cancel-edit').style.display = "block";

    // Pindah Tab Otomatis ke tab formulir
    const formTab = new bootstrap.Tab(document.getElementById('pills-form-tab'));
    formTab.show();
}

// Eksekusi Bersihkan Data Lokal
function executeClearData() {
    if (confirm("Peringatan! Menghapus seluruh data dari LocalStorage tidak dapat dibatalkan. Lanjutkan?")) {
        localStorage.removeItem('kpu_guestbook');
        loadDashboard();
    }
}

// 7. Fungsi Batalkan Edit
function cancelEdit() {
    form.reset();
    document.getElementById('edit-index').value = "";
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

// 8. Preview Foto Besar
function viewPhoto(base64Src) {
    document.getElementById('modal-img-view').src = base64Src;
    const photoModal = new bootstrap.Modal(document.getElementById('photoModal'));
    photoModal.show();
}

// 9. GENERATE ZIP OFFLINE (Sesuai Permintaan)
btnExport.addEventListener('click', () => {
    const listTamu = JSON.parse(localStorage.getItem('kpu_guestbook')) || [];
    if (listTamu.length === 0) return alert("Tidak ada data kunjungan untuk diekspor.");

    const zip = new JSZip();

    // Mengunci urutan kolom A sampai F yang rapi dan paten untuk Microsoft Excel
    let csvContent = "\uFEFFsep=,\nWaktu Kunjungan,Nama Lengkap,Instansi / Asal,No. Whatsapp,Tujuan,Keperluan\n";
    
    const folderFoto = zip.folder("Foto_Tamu");

    listTamu.forEach((item, index) => {
        const nomorUrut = index + 1;
        
        // Bersihkan nama dari karakter terlarang sistem berkas Windows/Android
        const namaBersih = item.nama.replace(/[/\\?%*:|"<>]/g, '-');
        const namaFileFoto = `${nomorUrut}_${namaBersih}`;

        // Mengurutkan baris teks tepat pada kolom A ke F tanpa melenceng
        let row = `"${item.waktu}","${item.nama.replace(/"/g, '""')}","${item.instansi.replace(/"/g, '""')}","${item.whatsapp}","${item.tujuan.replace(/"/g, '""')}","${item.keperluan.replace(/"/g, '""')}"`;
        csvContent += row + "\n";

        // Ekstrak berkas gambar ke folder dalam ZIP
        if (item.foto && item.foto.includes("base64,")) {
            const rawBase64 = item.foto.split('base64,')[1];
            folderFoto.file(`${namaFileFoto}.jpg`, rawBase64, { base64: true });
        }
    });

    zip.file("Data_Tamu_KPU_Kuningan.csv", csvContent);

    zip.generateAsync({ type: "blob" }).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `Rekap_Buku_Tamu_KPU_Kuningan_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});
