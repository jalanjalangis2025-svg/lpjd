// Helper to get location
function getLocation() {
    const status = document.getElementById('location-status');
    if (status) status.innerText = "Mencari lokasi...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('latitude').value = position.coords.latitude;
            document.getElementById('longitude').value = position.coords.longitude;
            if (status) status.innerText = "Lokasi ditemukan!";
        }, (error) => {
            alert("Gagal mengambil lokasi. Pastikan GPS aktif.");
            if (status) status.innerText = "";
        });
    } else {
        alert("Browser tidak mendukung Geolocation.");
    }
}

// Handle Form Submission and Data Loading
document.addEventListener('DOMContentLoaded', () => {
    const publicForm = document.getElementById('reportForm');
    const adminForm = document.getElementById('adminForm');

    // Check if Edit Mode (Admin Only)
    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get('id');

    if (adminForm && reportId) {
        document.querySelector('h1').innerText = "Validasi / Edit Data Jalan";
        document.getElementById('submitBtn').innerText = "Update & Verifikasi Data";
        loadReportData(reportId);
    }

    if (publicForm) {
        publicForm.addEventListener('submit', (e) => submitReport(e, 'public'));
    }
    
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => submitReport(e, 'admin', reportId));
    }
});

async function loadReportData(id) {
    if (!window.sb) {
        setTimeout(() => loadReportData(id), 500);
        return;
    }

    const { data, error } = await sb
        .from('road_reports')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error || !data) {
        alert("Data tidak ditemukan");
        return;
    }

    // Prefill form
    document.getElementById('district').value = data.district || '';
    document.getElementById('description').value = data.description || '';
    document.getElementById('latitude').value = data.latitude || '';
    document.getElementById('longitude').value = data.longitude || '';
    
    // Admin specific / details
    if(document.getElementById('report_date')) document.getElementById('report_date').value = data.report_date || new Date().toISOString().split('T')[0];
    if(document.getElementById('damage_length')) document.getElementById('damage_length').value = data.damage_length || '';
    if(document.getElementById('damage_width')) document.getElementById('damage_width').value = data.damage_width || '';
    if(document.getElementById('sdi_value')) document.getElementById('sdi_value').value = data.sdi_value || '';
    if(document.getElementById('sdi_category')) document.getElementById('sdi_category').value = data.sdi_category || '';
    if(document.getElementById('pci_value')) document.getElementById('pci_value').value = data.pci_value || '';
    if(document.getElementById('pci_category')) document.getElementById('pci_category').value = data.pci_category || '';
}

async function submitReport(e, source, id = null) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Memproses...";

    // Collect Data
    const formData = {
        report_source: source, // 'admin' usually
        district: document.getElementById('district').value,
        description: document.getElementById('description').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
    };

    // Source specific fields
    if (source === 'public') {
        formData.reporter_name = document.getElementById('reporter_name').value;
        formData.reporter_contact = document.getElementById('reporter_contact').value;
        formData.status = 'pending'; // Public reports are pending by default
    } else {
        formData.report_date = document.getElementById('report_date').value;
        formData.damage_length = parseFloat(document.getElementById('damage_length').value) || 0;
        formData.damage_width = parseFloat(document.getElementById('damage_width').value) || 0;
        formData.sdi_value = parseFloat(document.getElementById('sdi_value').value) || null;
        formData.sdi_category = document.getElementById('sdi_category').value || null;
        formData.pci_value = parseFloat(document.getElementById('pci_value').value) || null;
        formData.pci_category = document.getElementById('pci_category').value || null;
        
        // If Admin submits, we mark it as verified
        formData.status = 'verified';
    }

    // Handle Photo Upload
    const fileInput = document.getElementById('photo');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Update user feedback
        btn.innerText = "Mengkompresi foto...";
        
        try {
            const compressedFile = await compressImage(file);
            const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;
            
            btn.innerText = "Mengupload foto...";
            
            const { data: uploadData, error: uploadError } = await sb
                .storage
                .from('photos')
                .upload(fileName, compressedFile);

            if (uploadError) {
                alert('Gagal upload foto: ' + uploadError.message);
                btn.disabled = false;
                btn.innerText = "Kirim / Simpan";
                return;
            }

            // Get Public URL
            const { data: { publicUrl } } = sb
                .storage
                .from('photos')
                .getPublicUrl(fileName);
                
            formData.photo_url = publicUrl;
        } catch (compError) {
            console.error("Compression error:", compError);
            alert("Gagal memproses foto. Silakan coba lagi.");
            btn.disabled = false;
            btn.innerText = "Kirim / Simpan";
            return;
        }
    }

    // DB Action: Insert or Update
    btn.innerText = "Menyimpan data...";
    let error;
    if (id) {
        // UPDATE
        const res = await sb.from('road_reports').update(formData).eq('id', id);
        error = res.error;
    } else {
        // INSERT
        const res = await sb.from('road_reports').insert([formData]);
        error = res.error;
    }

    if (error) {
        alert('Gagal menyimpan data: ' + error.message);
    } else {
        alert('Data Berhasil Disimpan!');
        if (source === 'public') {
            location.replace('/index.html'); 
            document.getElementById('reportForm').reset();
        } else {
            location.replace('/home'); // Back to Admin Dashboard
        }
    }
    
    btn.disabled = false;
    btn.innerText = "Kirim / Simpan";
}

// Utility: Image Compression (Force max 1MB)
function compressImage(file) {
    const MAX_SIZE_MB = 1;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Initial Resize if too huge (e.g. > 2000px) to save processing
                // This is a "soft" first pass
                const MAX_DIMENSION = 1920; 
                if (width > height) {
                    if (width > MAX_DIMENSION) {
                        height *= MAX_DIMENSION / width;
                        width = MAX_DIMENSION;
                    }
                } else {
                    if (height > MAX_DIMENSION) {
                        width *= MAX_DIMENSION / height;
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Iterative compression
                let quality = 0.9;
                
                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob failed"));
                            return;
                        }

                        if (blob.size <= MAX_SIZE_BYTES || quality <= 0.1) {
                            // Done or reached min quality
                            console.log(`Compressed to: ${(blob.size / 1024 / 1024).toFixed(2)} MB, Quality: ${quality.toFixed(2)}`);
                            resolve(blob);
                        } else {
                            // Too big, reduce quality
                            console.log(`Still too big: ${(blob.size / 1024 / 1024).toFixed(2)} MB, reducing quality...`);
                            quality -= 0.1;
                            
                            // If quality drops too low, resize again
                            if (quality < 0.5) {
                                width *= 0.8;
                                height *= 0.8;
                                canvas.width = width;
                                canvas.height = height;
                                ctx.drawImage(img, 0, 0, width, height);
                                quality = 0.8; // Reset quality for new size
                            }
                            
                            tryCompress();
                        }
                    }, 'image/jpeg', quality);
                };

                tryCompress();
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
