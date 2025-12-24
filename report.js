// public/report.js
import { addPublicReport, uploadImage } from "./shared/supabase.js";

document.addEventListener("DOMContentLoaded", function () {
  // Setup form submission
  const reportForm = document.getElementById("reportForm");
  if (reportForm) {
    reportForm.addEventListener("submit", handleSubmit);
  }

  // File upload
  const fileUploadArea = document.getElementById("fileUploadArea");
  const photoInput = document.getElementById("photo");

  if (fileUploadArea && photoInput) {
    fileUploadArea.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", handleFileSelect);
  }

  // Map picker
  const mapPicker = document.getElementById("mapPicker");
  if (mapPicker) {
    mapPicker.addEventListener("click", openMapPicker);
  }

  // Mobile menu
  document
    .querySelector(".menu-toggle")
    ?.addEventListener("click", function () {
      document.querySelector(".nav").classList.toggle("show");
    });
});

let selectedFile = null;
let selectedLatLng = null;
let modalMap = null;

async function handleSubmit(e) {
  e.preventDefault();

  // Validasi form
  const reporterName = document.getElementById("reporterName").value.trim();
  const reporterContact = document
    .getElementById("reporterContact")
    .value.trim();
  const district = document.getElementById("district").value;
  const description = document.getElementById("description").value.trim();
  const latitude = parseFloat(document.getElementById("latitude").value);
  const longitude = parseFloat(document.getElementById("longitude").value);
  const roadName = document.getElementById("roadName").value.trim();

  if (
    !reporterName ||
    !reporterContact ||
    !district ||
    !description ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    alert("Harap lengkapi semua field yang wajib diisi!");
    return;
  }

  // Disable submit button
  const submitBtn = document.querySelector(".submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';

  try {
    let photoUrl = null;

    // Upload foto jika ada
    if (selectedFile) {
      const uploadResult = await uploadImage(selectedFile);
      if (uploadResult.success) {
        photoUrl = uploadResult.url;
      }
    }

    // Buat data laporan
    const reportData = {
      reporter_name: reporterName,
      reporter_contact: reporterContact,
      road_name: roadName || null,
      district: district,
      description: description,
      latitude: latitude,
      longitude: longitude,
      photo_url: photoUrl,
      status: "pending",
    };

    // Kirim ke Supabase
    const result = await addPublicReport(reportData);

    if (result.success) {
      // Tampilkan pesan sukses
      document.getElementById("form-content").style.display = "none";
      document.getElementById("success-message").style.display = "block";
    } else {
      throw new Error(result.error || "Gagal mengirim laporan");
    }
  } catch (error) {
    console.error("Error submitting report:", error);
    alert("Gagal mengirim laporan: " + error.message);

    // Reset submit button
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim Laporan';
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validasi tipe file
  if (!file.type.match("image.*")) {
    alert("File harus berupa gambar (JPG, PNG)");
    return;
  }

  // Validasi ukuran file (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Ukuran file maksimal 5MB");
    return;
  }

  selectedFile = file;

  // Tampilkan preview
  const reader = new FileReader();
  reader.onload = function (e) {
    const preview = document.getElementById("filePreview");
    const previewImage = document.getElementById("previewImage");

    previewImage.src = e.target.result;
    preview.style.display = "block";

    // Update UI
    const uploadArea = document.getElementById("fileUploadArea");
    uploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="color: #10b981;"></i>
            <p>${file.name}</p>
            <p class="small-text">Klik untuk mengganti foto</p>
        `;
  };
  reader.readAsDataURL(file);
}

function openMapPicker() {
  // Tampilkan modal
  const modal = document.getElementById("mapModal");
  modal.style.display = "flex";

  // Inisialisasi peta jika belum ada
  if (!modalMap) {
    modalMap = L.map("modalMap").setView([-6.2088, 106.8456], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(modalMap);

    // Tambahkan event click
    modalMap.on("click", function (e) {
      selectedLatLng = e.latlng;
      document.getElementById(
        "selectedCoords"
      ).textContent = `${selectedLatLng.lat.toFixed(
        6
      )}, ${selectedLatLng.lng.toFixed(6)}`;

      // Hapus marker sebelumnya
      modalMap.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          modalMap.removeLayer(layer);
        }
      });

      // Tambahkan marker baru
      L.marker(selectedLatLng)
        .addTo(modalMap)
        .bindPopup("Lokasi terpilih")
        .openPopup();
    });
  }

  // Setup event listeners untuk modal
  document
    .querySelector(".close-modal")
    .addEventListener("click", closeMapPicker);
  document
    .getElementById("cancelLocation")
    .addEventListener("click", closeMapPicker);
  document
    .getElementById("useLocation")
    .addEventListener("click", useSelectedLocation);
}

function closeMapPicker() {
  document.getElementById("mapModal").style.display = "none";
}

function useSelectedLocation() {
  if (!selectedLatLng) {
    alert("Silakan pilih lokasi di peta terlebih dahulu");
    return;
  }

  // Isi koordinat ke form
  document.getElementById("latitude").value = selectedLatLng.lat.toFixed(6);
  document.getElementById("longitude").value = selectedLatLng.lng.toFixed(6);

  closeMapPicker();
}
