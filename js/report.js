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

// Toggle Location Options (GPS vs GMaps)
function toggleLocOption() {
    const isGps = document.querySelector('input[name="loc_option"][value="gps"]')?.checked ?? true;
    
    const locGps = document.getElementById('loc-gps');
    const locGmaps = document.getElementById('loc-gmaps');
    const cardGps = document.getElementById('card-gps');
    const cardGmaps = document.getElementById('card-gmaps');
    
    if (locGps) locGps.style.display = isGps ? 'block' : 'none';
    if (locGmaps) locGmaps.style.display = isGps ? 'none' : 'block';
    
    if (cardGps) isGps ? cardGps.classList.add('active') : cardGps.classList.remove('active');
    if (cardGmaps) !isGps ? cardGmaps.classList.add('active') : cardGmaps.classList.remove('active');
    
    // Handle photo input capture behavior
    const photoInput = document.getElementById('photo');
    if (photoInput) {
        if (isGps) {
            photoInput.setAttribute('capture', 'environment');
        } else {
            photoInput.removeAttribute('capture');
        }
    }
    
    // Clear status
    const status = document.getElementById('location-status');
    if (status) status.innerText = "";
    const gmapsStatus = document.getElementById('gmaps-status');
    if (gmapsStatus) gmapsStatus.innerText = "";
}

// Extract location from GMaps link
function getLocFromGmaps() {
    const link = document.getElementById('gmaps_link').value;
    const status = document.getElementById('gmaps-status');
    
    if (!link) {
        if (status) {
            status.innerText = "Masukkan link Google Maps terlebih dahulu.";
            status.style.color = "var(--danger)";
        }
        return;
    }

    let lat = null;
    let lng = null;
    
    // Regex patterns for Google Maps URLs
    const regexps = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,
        /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
        /q=(-?\d+\.\d+),?(-?\d+\.\d+)?/
    ];

    for (let r of regexps) {
        const match = link.match(r);
        if (match && match[1] && match[2]) {
            lat = match[1];
            lng = match[2];
            break;
        }
    }

    // Try parsing URL query parameters if regex fails
    if (!lat || !lng) {
        try {
            const url = new URL(link);
            const q = url.searchParams.get('q');
            if (q) {
                const parts = q.split(',');
                if (parts.length >= 2) {
                    lat = parts[0].trim();
                    lng = parts[1].trim();
                }
            }
        } catch(e) {
            // Not a valid URL
        }
    }

    if (lat && lng) {
        document.getElementById('latitude').value = parseFloat(lat);
        document.getElementById('longitude').value = parseFloat(lng);
        if (status) {
            status.innerText = "Koordinat berhasil diekstrak!";
            status.style.color = "green";
        }
    } else {
        if (status) {
            status.innerText = "Gagal mengekstrak koordinat. Pastikan format link valid (bukan link pendek/short link) dan berisi koordinat.";
            status.style.color = "var(--danger)";
        }
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

    // Auto-set Date for Public Form
    const dateField = document.getElementById('report_date_display');
    if (dateField) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateField.value = now.toLocaleDateString('id-ID', options);
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
    
    // Robust SDI Loading
    let sdiVal = (data.sdi_value !== null && data.sdi_value !== undefined) ? data.sdi_value : 0;
    let sdiCat = data.sdi_category || '';
    if (sdiVal === 0) sdiCat = 'Tidak Rusak';
    if(document.getElementById('sdi_value')) document.getElementById('sdi_value').value = sdiVal;
    if(document.getElementById('sdi_category')) document.getElementById('sdi_category').value = sdiCat;
    
    // Robust PCI Loading
    let pciVal = (data.pci_value !== null && data.pci_value !== undefined) ? data.pci_value : 0;
    let pciCat = data.pci_category || '';
    if (pciVal === 0) pciCat = 'Tidak Rusak';
    if(document.getElementById('pci_value')) document.getElementById('pci_value').value = pciVal;
    if(document.getElementById('pci_category')) document.getElementById('pci_category').value = pciCat;
}

async function submitReport(e, source, id = null) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Memproses...";

    // Collect Data
    const formData = {
        district: document.getElementById('district').value,
        description: document.getElementById('description').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
    };

    // Only set source for NEW reports
    if (!id) {
        formData.report_source = source;
    }

    // Source specific fields
    if (source === 'public') {
        formData.reporter_name = document.getElementById('reporter_name').value;
        formData.reporter_contact = document.getElementById('reporter_contact').value;
        if (!id) formData.status = 'pending'; // New public reports are pending
    } else {
        formData.report_date = document.getElementById('report_date').value;
        formData.damage_length = parseFloat(document.getElementById('damage_length').value) || 0;
        formData.damage_width = parseFloat(document.getElementById('damage_width').value) || 0;
        // Jika Admin submits/edits, kita tetapkan category default bila empty/0
        let tempSdiVal = parseFloat(document.getElementById('sdi_value').value) || 0;
        let tempSdiCat = document.getElementById('sdi_category').value || '';
        if (tempSdiVal === 0 && tempSdiCat === '') tempSdiCat = 'Tidak Rusak';

        let tempPciVal = parseFloat(document.getElementById('pci_value').value) || 0;
        let tempPciCat = document.getElementById('pci_category').value || '';
        if (tempPciVal === 0 && tempPciCat === '') tempPciCat = 'Tidak Rusak';

        formData.sdi_value = tempSdiVal;
        formData.sdi_category = tempSdiCat;
        formData.pci_value = tempPciVal;
        formData.pci_category = tempPciCat;
        
        // If Admin submits/edits, we mark it as verified by default
        formData.status = 'verified';
    }

    // Handle Photo Upload
    const fileInput = document.getElementById('photo');
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Update user feedback
        btn.innerText = "Mengkompresi foto...";
        
        try {
            const compressedFile = await processImageWithWatermark(file);
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

// Utility: Image Processing with Watermark & Compression
function processImageWithWatermark(file) {
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
                
                // Max dimension for efficiency
                const MAX_DIMENSION = 1600; 
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

                // --- DESIGN PREMIUM WATERMARK (Box Style) ---
                const scale = width / 1000; // base scale
                const boxW = width * 0.8;
                const boxH = 120 * scale;
                const boxX = (width - boxW) / 2;
                const boxY = height - boxH - (20 * scale);
                const radius = 15 * scale;

                // Rounded semi-transparent background
                ctx.beginPath();
                ctx.moveTo(boxX + radius, boxY);
                ctx.lineTo(boxX + boxW - radius, boxY);
                ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
                ctx.lineTo(boxX + boxW, boxY + boxH - radius);
                ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
                ctx.lineTo(boxX + radius, boxY + boxH);
                ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
                ctx.lineTo(boxX, boxY + radius);
                ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
                ctx.closePath();
                ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
                ctx.fill();

                // Typography setup
                ctx.fillStyle = "white";
                ctx.font = `bold ${24 * scale}px 'Plus Jakarta Sans', sans-serif`;
                
                // Content
                const now = new Date();
                const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const lat = document.getElementById('latitude')?.value || 'N/A';
                const lng = document.getElementById('longitude')?.value || 'N/A';
                const district = document.getElementById('district')?.value || 'Kabupaten Demak';

                // Drawing text
                ctx.textAlign = "left";
                
                // Row 1: District / Brand
                ctx.font = `bold ${22 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText(district, boxX + (20 * scale), boxY + (35 * scale));
                
                // Row 2: URL
                ctx.font = `${16 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText("lpjd.vercel.app", boxX + (20 * scale), boxY + (60 * scale));

                // Row 3: Coordinates (Large)
                ctx.font = `bold ${26 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.fillText(`${lat}°N  ${lng}°E`, boxX + (20 * scale), boxY + (95 * scale));

                // Row 4: Date & Time (Right side)
                ctx.font = `${18 * scale}px 'Plus Jakarta Sans', sans-serif`;
                ctx.textAlign = "right";
                ctx.fillText(`${dateStr}, ${timeStr}`, boxX + boxW - (20 * scale), boxY + (95 * scale));

                // --- ITERATIVE COMPRESSION ---
                let quality = 0.85;
                const tryCompress = () => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob failed"));
                            return;
                        }

                        if (blob.size <= MAX_SIZE_BYTES || quality <= 0.1) {
                            resolve(blob);
                        } else {
                            quality -= 0.1;
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
