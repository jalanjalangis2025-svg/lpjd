// public/public.js
import { getRoads, getPublicReports, supabase } from "../shared/supabase.js";
import { initMap, updateMapLayers } from "../shared/map.js";

document.addEventListener("DOMContentLoaded", async function () {
  // Inisialisasi peta
  initMap("main-map");

  // Load data
  await loadData();

  // Setup event listeners
  setupEventListeners();

  // Toggle mobile menu
  document.querySelector(".menu-toggle").addEventListener("click", function () {
    document.querySelector(".nav").classList.toggle("show");
  });
});

async function loadData() {
  try {
    // Load data jalan
    const roads = await getRoads();
    const publicReports = await getPublicReports();

    // Update statistik
    updateStats(roads, publicReports);

    // Update peta
    updateMapLayers(roads, publicReports);

    // Tampilkan laporan terbaru
    displayRecentReports(publicReports.slice(0, 6));
  } catch (error) {
    console.error("Error loading data:", error);
    showNotification("Gagal memuat data. Silakan refresh halaman.", "error");
  }
}

function updateStats(roads, reports) {
  document.getElementById("total-roads").textContent = roads.length;
  document.getElementById("total-reports").textContent = reports.length;

  // Hitung jalan rusak berat
  const severeRoads = roads.filter(
    (road) =>
      road.condition_sdi === "rusak_berat" ||
      ["poor", "very_poor", "serious", "failed"].includes(road.condition_pci)
  ).length;

  document.getElementById("severe-roads").textContent = severeRoads;
}

function displayRecentReports(reports) {
  const container = document.getElementById("recent-reports");

  if (!reports || reports.length === 0) {
    container.innerHTML = '<div class="loading">Belum ada laporan</div>';
    return;
  }

  let html = "";

  reports.forEach((report) => {
    html += `
            <div class="report-card">
                <div class="report-header">
                    <div class="report-title">${
                      report.road_name || "Laporan Jalan"
                    }</div>
                    <div class="report-status status-${report.status}">
                        ${getStatusLabel(report.status)}
                    </div>
                </div>
                <div class="report-location">
                    <i class="fas fa-map-marker-alt"></i>
                    ${report.district}
                </div>
                <div class="report-description">
                    ${truncateText(report.description, 100)}
                </div>
                <div class="report-date">
                    ${formatDate(report.created_at)}
                </div>
            </div>
        `;
  });

  container.innerHTML = html;
}

function getStatusLabel(status) {
  const labels = {
    pending: "Menunggu",
    verified: "Terverifikasi",
    rejected: "Ditolak",
    completed: "Selesai",
  };
  return labels[status] || status;
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function setupEventListeners() {
  // Layer controls
  const layerControls = ["layer-sdi", "layer-pci", "layer-public"];
  layerControls.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener("change", function () {
        // Akan diimplementasikan di map.js
        console.log(`${id}: ${this.checked}`);
      });
    }
  });

  // Search functionality
  const searchBtn = document.getElementById("search-btn");
  const searchInput = document.getElementById("search-location");

  searchBtn.addEventListener("click", performSearch);
  searchInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") performSearch();
  });
}

function performSearch() {
  const query = document.getElementById("search-location").value.trim();
  const resultsContainer = document.getElementById("search-results");

  if (!query) {
    resultsContainer.innerHTML =
      '<p class="no-results">Masukkan kata kunci pencarian</p>';
    return;
  }

  // Simulasi pencarian
  resultsContainer.innerHTML = '<p class="loading">Mencari...</p>';

  setTimeout(() => {
    // Dalam implementasi nyata, ini akan mencari data dari database
    resultsContainer.innerHTML = `
            <div class="search-result">
                <div class="result-title">Hasil untuk "${query}"</div>
                <p class="no-results">Fitur pencarian lengkap akan segera tersedia.</p>
            </div>
        `;
  }, 500);
}

function showNotification(message, type = "info") {
  // Hapus notifikasi sebelumnya
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  // Buat notifikasi baru
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${
              type === "success"
                ? "check-circle"
                : type === "error"
                ? "exclamation-circle"
                : "info-circle"
            }"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `;

  // Tambahkan ke body
  document.body.appendChild(notification);

  // Tampilkan
  setTimeout(() => notification.classList.add("show"), 10);

  // Tombol close
  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    });

  // Auto remove setelah 5 detik
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) notification.remove();
      }, 300);
    }
  }, 5000);
}

// Tambahkan CSS untuk notifikasi
const notificationStyles = document.createElement("style");
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 15px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 400px;
        z-index: 9999;
        transform: translateX(400px);
        transition: transform 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #10b981;
    }
    
    .notification-error {
        border-left: 4px solid #ef4444;
    }
    
    .notification-info {
        border-left: 4px solid #3b82f6;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .notification-content i {
        font-size: 18px;
    }
    
    .notification-success .notification-content i {
        color: #10b981;
    }
    
    .notification-error .notification-content i {
        color: #ef4444;
    }
    
    .notification-info .notification-content i {
        color: #3b82f6;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #64748b;
    }
`;
document.head.appendChild(notificationStyles);
