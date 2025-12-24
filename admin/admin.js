// admin/admin.js
import {
  getRoads,
  addRoad,
  updateRoad,
  deleteRoad,
  getPublicReports,
  updateReportStatus,
  adminLogin,
  adminLogout,
  checkAdminAuth,
  getCurrentUser,
  supabase,
} from "../shared/supabase.js";
import { initMap, updateMapLayers } from "../shared/map.js";

// Global variables
let currentRoads = [];
let currentReports = [];
let currentPage = 1;
const itemsPerPage = 10;

// Inisialisasi aplikasi
document.addEventListener("DOMContentLoaded", async function () {
  // Cek autentikasi
  const isAuthenticated = await checkAdminAuth();

  if (!isAuthenticated) {
    // Redirect ke login jika tidak authenticated
    window.location.href = "login.html";
    return;
  }

  // Get current user info
  const user = await getCurrentUser();
  if (user) {
    // Update UI dengan user info
    updateUserInfo(user);
  }

  // Setup event listeners
  setupEventListeners();

  // Inisialisasi peta
  initAdminMap();

  // Load data
  await loadDashboardData();

  // Update waktu
  updateDateTime();
  setInterval(updateDateTime, 60000);

  // Setup menu navigation
  setupMenuNavigation();
});

function updateUserInfo(user) {
  const adminNameElement = document.getElementById("adminName");
  if (adminNameElement && user.email) {
    adminNameElement.textContent = user.email.split("@")[0];
  }
}

// Setup event listeners
function setupEventListeners() {
  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    if (confirm("Apakah Anda yakin ingin logout?")) {
      await adminLogout();
    }
  });

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await loadDashboardData();
    showNotification("Data berhasil diperbarui", "success");
  });

  // Map controls
  document.getElementById("mapZoomIn")?.addEventListener("click", () => {
    const map = window.adminMap;
    if (map) map.zoomIn();
  });

  document.getElementById("mapZoomOut")?.addEventListener("click", () => {
    const map = window.adminMap;
    if (map) map.zoomOut();
  });

  document.getElementById("mapLocate")?.addEventListener("click", () => {
    const map = window.adminMap;
    if (map && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        map.setView([position.coords.latitude, position.coords.longitude], 15);
      });
    }
  });

  // Form tambah data jalan
  const addRoadForm = document.getElementById("addRoadForm");
  if (addRoadForm) {
    addRoadForm.addEventListener("submit", handleAddRoad);
  }

  // Reset form button
  document.getElementById("resetForm")?.addEventListener("click", () => {
    document.getElementById("addRoadForm").reset();
  });

  // Pick location button
  document
    .getElementById("pickLocationBtn")
    ?.addEventListener("click", openLocationPicker);

  // Search roads
  document
    .getElementById("searchRoadBtn")
    ?.addEventListener("click", filterRoads);
  document.getElementById("searchRoad")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") filterRoads();
  });

  document
    .getElementById("filterCondition")
    ?.addEventListener("change", filterRoads);
  document
    .getElementById("filterDistrict")
    ?.addEventListener("change", filterRoads);

  // Modal close buttons
  document.querySelectorAll(".close-modal").forEach((button) => {
    button.addEventListener("click", function () {
      this.closest(".modal").classList.remove("active");
    });
  });

  // Close modal on outside click
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        this.classList.remove("active");
      }
    });
  });

  // Sidebar toggle for mobile
  document.querySelector(".sidebar-toggle")?.addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("active");
  });

  // Export/Import data buttons
  document.getElementById("exportData")?.addEventListener("click", exportData);
  document.getElementById("importData")?.addEventListener("click", () => {
    showNotification("Fitur impor akan segera tersedia", "info");
  });
  document
    .getElementById("clearData")
    ?.addEventListener("click", confirmClearData);
}

// Setup menu navigation
function setupMenuNavigation() {
  const menuItems = document.querySelectorAll(".menu-item");
  const contentSections = document.querySelectorAll(".content-section");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1);

      // Update active menu
      menuItems.forEach((menuItem) => menuItem.classList.remove("active"));
      this.classList.add("active");

      // Show target section
      contentSections.forEach((section) => {
        section.classList.remove("active");
        if (section.id === targetId) {
          section.classList.add("active");

          // Update page title
          updatePageTitle(targetId);

          // Load section specific data
          loadSectionData(targetId);

          // Update map size if needed
          if (targetId === "dashboard" && window.adminMap) {
            setTimeout(() => {
              window.adminMap.invalidateSize();
            }, 300);
          }
        }
      });

      // Close sidebar on mobile
      document.querySelector(".sidebar").classList.remove("active");
    });
  });
}

// Update page title
function updatePageTitle(sectionId) {
  const titles = {
    dashboard: "Dashboard",
    "data-jalan": "Data Jalan",
    "laporan-masyarakat": "Laporan Masyarakat",
    "tambah-data": "Tambah Data Jalan",
    pengaturan: "Pengaturan",
  };

  const subtitles = {
    dashboard: "Sistem Informasi Jalan Rusak",
    "data-jalan": "Kelola data kondisi jalan",
    "laporan-masyarakat": "Verifikasi laporan masyarakat",
    "tambah-data": "Input data kondisi jalan baru",
    pengaturan: "Pengaturan sistem dan akun",
  };

  document.getElementById("pageTitle").textContent =
    titles[sectionId] || "Dashboard";
  document.getElementById("pageSubtitle").textContent =
    subtitles[sectionId] || "Sistem Informasi Jalan Rusak";
}

// Inisialisasi peta admin
function initAdminMap() {
  window.adminMap = initMap("adminMap", [-6.2088, 106.8456], 12);
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Load roads and reports
    currentRoads = await getRoads();
    currentReports = await getPublicReports();

    // Update stats
    updateDashboardStats(currentRoads, currentReports);

    // Update map
    updateMapLayers(currentRoads, currentReports);

    // Update recent reports
    displayRecentReports(currentReports.slice(0, 5));

    // Update district filter
    updateDistrictFilter();

    // Update system info
    updateSystemInfo();
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showNotification("Gagal memuat data", "error");
  }
}

// Update dashboard statistics
function updateDashboardStats(roads, reports) {
  // Total roads
  document.getElementById("totalRoads").textContent = roads.length;

  // Count roads by condition
  const goodRoads = roads.filter(
    (road) =>
      road.condition_sdi === "baik" ||
      road.condition_sdi === "sedang" ||
      ["excellent", "good"].includes(road.condition_pci)
  ).length;

  const lightDamage = roads.filter(
    (road) =>
      road.condition_sdi === "rusak_ringan" ||
      ["fair", "poor"].includes(road.condition_pci)
  ).length;

  const heavyDamage = roads.filter(
    (road) =>
      road.condition_sdi === "rusak_berat" ||
      ["very_poor", "serious", "failed"].includes(road.condition_pci)
  ).length;

  document.getElementById("goodRoads").textContent = goodRoads;
  document.getElementById("lightDamage").textContent = lightDamage;
  document.getElementById("heavyDamage").textContent = heavyDamage;

  // Update report counts
  const pendingCount = reports.filter((r) => r.status === "pending").length;
  const verifiedCount = reports.filter((r) => r.status === "verified").length;
  const rejectedCount = reports.filter((r) => r.status === "rejected").length;

  document.getElementById("pendingCount").textContent = pendingCount;
  document.getElementById("verifiedCount").textContent = verifiedCount;
  document.getElementById("rejectedCount").textContent = rejectedCount;
}

// Display recent reports
function displayRecentReports(reports) {
  const container = document.getElementById("recentReports");

  if (!reports || reports.length === 0) {
    container.innerHTML = '<div class="loading">Belum ada laporan</div>';
    return;
  }

  let html = "";

  reports.forEach((report) => {
    html += `
            <div class="report-item ${report.status}">
                <div class="report-header">
                    <div class="report-title">${
                      report.road_name || "Laporan Jalan"
                    }</div>
                    <div class="report-status status-${report.status}">
                        ${getStatusLabel(report.status)}
                    </div>
                </div>
                <div class="report-location">
                    <i class="fas fa-map-marker-alt"></i> ${report.district}
                </div>
                <div class="report-description">
                    ${
                      report.description
                        ? truncateText(report.description, 80)
                        : "Tidak ada deskripsi"
                    }
                </div>
                <div class="report-date">
                    ${formatDate(report.created_at)}
                </div>
            </div>
        `;
  });

  container.innerHTML = html;

  // Add click events to view details
  container.querySelectorAll(".report-item").forEach((item, index) => {
    item.addEventListener("click", () => {
      viewReportDetails(currentReports[index]);
    });
  });
}

// Update district filter
function updateDistrictFilter() {
  const filterSelect = document.getElementById("filterDistrict");
  if (!filterSelect) return;

  // Get unique districts from roads
  const districts = [
    ...new Set(currentRoads.map((road) => road.district).filter(Boolean)),
  ];

  // Clear existing options (keep first option)
  filterSelect.innerHTML = '<option value="">Semua Kecamatan</option>';

  // Add district options
  districts.forEach((district) => {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    filterSelect.appendChild(option);
  });
}

// Load section specific data
async function loadSectionData(sectionId) {
  switch (sectionId) {
    case "data-jalan":
      await loadRoadsTable();
      break;
    case "laporan-masyarakat":
      await loadReportsTable();
      break;
  }
}

// Load roads table
async function loadRoadsTable() {
  try {
    const roads = await getRoads();
    currentRoads = roads;
    displayRoadsTable(roads);
  } catch (error) {
    console.error("Error loading roads:", error);
    showNotification("Gagal memuat data jalan", "error");
  }
}

// Display roads in table
function displayRoadsTable(roads) {
  const tbody = document.getElementById("roadsTableBody");
  if (!tbody) return;

  if (!roads || roads.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading">Belum ada data jalan</div>
                </td>
            </tr>
        `;
    return;
  }

  let html = "";

  roads.forEach((road, index) => {
    html += `
            <tr>
                <td>${road.road_name || "-"}</td>
                <td>${road.district || "-"}</td>
                <td>
                    <span class="status-badge ${
                      road.condition_sdi || "unknown"
                    }">
                        ${getSDILabel(road.condition_sdi) || "-"}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${
                      road.condition_pci || "unknown"
                    }">
                        ${getPCILabel(road.condition_pci) || "-"}
                    </span>
                </td>
                <td>${
                  road.latitude ? `${road.latitude}, ${road.longitude}` : "-"
                }</td>
                <td>${road.reported_by || "admin"}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit-road" data-id="${road.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon delete-road" data-id="${
                          road.id
                        }">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  });

  tbody.innerHTML = html;

  // Add event listeners for action buttons
  tbody.querySelectorAll(".edit-road").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const roadId = button.getAttribute("data-id");
      editRoad(roadId);
    });
  });

  tbody.querySelectorAll(".delete-road").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const roadId = button.getAttribute("data-id");
      deleteRoadConfirmation(roadId);
    });
  });
}

// Fungsi checkAdminAuth yang lebih baik
async function verifyAuth() {
  try {
    const isAuth = await checkAdminAuth()
    if (!isAuth) {
      window.location.href = 'login.html'
      return false
    }
    return true
  } catch (error) {
    console.error('Auth verification error:', error)
    window.location.href = 'login.html'
    return false
  }
}

// Filter roads
function filterRoads() {
  const searchTerm = document.getElementById("searchRoad").value.toLowerCase();
  const conditionFilter = document.getElementById("filterCondition").value;
  const districtFilter = document.getElementById("filterDistrict").value;

  const filtered = currentRoads.filter((road) => {
    const matchesSearch =
      !searchTerm ||
      (road.road_name && road.road_name.toLowerCase().includes(searchTerm)) ||
      (road.district && road.district.toLowerCase().includes(searchTerm));

    const matchesCondition =
      !conditionFilter || road.condition_sdi === conditionFilter;
    const matchesDistrict = !districtFilter || road.district === districtFilter;

    return matchesSearch && matchesCondition && matchesDistrict;
  });

  displayRoadsTable(filtered);
}

// Load reports table
async function loadReportsTable(status = "") {
  try {
    const reports = await getPublicReports(status);
    currentReports = reports;
    displayReportsTable(reports, status);
  } catch (error) {
    console.error("Error loading reports:", error);
    showNotification("Gagal memuat laporan", "error");
  }
}

// Display reports in table
function displayReportsTable(reports, activeStatus = "") {
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading">Belum ada laporan</div>
                </td>
            </tr>
        `;
    return;
  }

  let html = "";

  reports.forEach((report, index) => {
    html += `
            <tr>
                <td>${report.reporter_name || "-"}</td>
                <td>${report.reporter_contact || "-"}</td>
                <td>${report.district || "-"}</td>
                <td>${truncateText(report.description || "", 50)}</td>
                <td>
                    <span class="status-badge ${report.status}">
                        ${getStatusLabel(report.status)}
                    </span>
                </td>
                <td>${formatDate(report.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon view-report" data-index="${index}">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${
                          report.status === "pending"
                            ? `
                            <button class="btn-icon verify-report" data-id="${report.id}">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn-icon reject-report" data-id="${report.id}">
                                <i class="fas fa-times"></i>
                            </button>
                        `
                            : ""
                        }
                    </div>
                </td>
            </tr>
        `;
  });

  tbody.innerHTML = html;

  // Add event listeners
  tbody.querySelectorAll(".view-report").forEach((button) => {
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = parseInt(button.getAttribute("data-index"));
      viewReportDetails(currentReports[index]);
    });
  });

  tbody.querySelectorAll(".verify-report").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const reportId = button.getAttribute("data-id");
      await updateReportStatusAction(reportId, "verified");
    });
  });

  tbody.querySelectorAll(".reject-report").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const reportId = button.getAttribute("data-id");
      await updateReportStatusAction(reportId, "rejected");
    });
  });

  // Update active tab
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-status") === activeStatus) {
      btn.classList.add("active");
    }
  });

  // Add tab click events
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const status = this.getAttribute("data-status");
      loadReportsTable(status);
    });
  });
}

// Handle add road form submission
async function handleAddRoad(e) {
  e.preventDefault();

  // Get form data
  const roadName = document.getElementById("roadName").value.trim();
  const district = document.getElementById("roadDistrict").value;
  const conditionSDI = document.getElementById("conditionSDI").value;
  const conditionPCI = document.getElementById("conditionPCI").value || null;
  const latitude = parseFloat(document.getElementById("latitude").value);
  const longitude = parseFloat(document.getElementById("longitude").value);
  const width = document.getElementById("roadWidth").value || null;
  const length = document.getElementById("roadLength").value || null;
  const description =
    document.getElementById("roadDescription").value.trim() || null;

  // Validate required fields
  if (
    !roadName ||
    !district ||
    !conditionSDI ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    showNotification("Harap lengkapi semua field yang wajib", "error");
    return;
  }

  // Prepare road data
  const roadData = {
    road_name: roadName,
    district: district,
    condition_sdi: conditionSDI,
    condition_pci: conditionPCI,
    latitude: latitude,
    longitude: longitude,
    width: width,
    length: length,
    description: description,
    reported_by: "admin",
    is_verified: true,
  };

  try {
    // Show loading
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;

    // Add road to Supabase
    const result = await addRoad(roadData);

    if (result.success) {
      showNotification("Data jalan berhasil ditambahkan", "success");

      // Reset form
      document.getElementById("addRoadForm").reset();

      // Reload data
      await loadDashboardData();
      await loadRoadsTable();

      // Switch to data jalan section
      document.querySelector('a[href="#data-jalan"]').click();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Error adding road:", error);
    showNotification("Gagal menambahkan data jalan: " + error.message, "error");
  } finally {
    // Reset button
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Data Jalan';
    submitBtn.disabled = false;
  }
}

// Edit road
async function editRoad(roadId) {
  const road = currentRoads.find((r) => r.id === roadId);
  if (!road) return;

  // Fill form
  document.getElementById("editRoadId").value = road.id;
  document.getElementById("editRoadName").value = road.road_name || "";
  document.getElementById("editRoadDistrict").value = road.district || "";
  document.getElementById("editConditionSDI").value = road.condition_sdi || "";
  document.getElementById("editConditionPCI").value = road.condition_pci || "";

  // Show modal
  document.getElementById("editRoadModal").classList.add("active");

  // Handle form submission
  const form = document.getElementById("editRoadForm");
  form.onsubmit = async (e) => {
    e.preventDefault();

    const updates = {
      road_name: document.getElementById("editRoadName").value,
      district: document.getElementById("editRoadDistrict").value,
      condition_sdi: document.getElementById("editConditionSDI").value,
      condition_pci: document.getElementById("editConditionPCI").value || null,
    };

    try {
      const result = await updateRoad(roadId, updates);
      if (result.success) {
        showNotification("Data berhasil diperbarui", "success");
        document.getElementById("editRoadModal").classList.remove("active");
        await loadDashboardData();
        await loadRoadsTable();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      showNotification("Gagal memperbarui data: " + error.message, "error");
    }
  };
}

// Delete road confirmation
function deleteRoadConfirmation(roadId) {
  if (confirm("Apakah Anda yakin ingin menghapus data jalan ini?")) {
    deleteRoadAction(roadId);
  }
}

// Delete road action
async function deleteRoadAction(roadId) {
  try {
    const result = await deleteRoad(roadId);
    if (result.success) {
      showNotification("Data jalan berhasil dihapus", "success");
      await loadDashboardData();
      await loadRoadsTable();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showNotification("Gagal menghapus data: " + error.message, "error");
  }
}

// View report details
function viewReportDetails(report) {
  const modalBody = document.getElementById("reportModalBody");

  let html = `
        <div class="report-details">
            <div class="detail-item">
                <label>Pelapor:</label>
                <span>${report.reporter_name || "-"}</span>
            </div>
            <div class="detail-item">
                <label>Kontak:</label>
                <span>${report.reporter_contact || "-"}</span>
            </div>
            <div class="detail-item">
                <label>Lokasi:</label>
                <span>${report.district || "-"}</span>
            </div>
            <div class="detail-item">
                <label>Koordinat:</label>
                <span>${report.latitude || "-"}, ${
    report.longitude || "-"
  }</span>
            </div>
            <div class="detail-item">
                <label>Status:</label>
                <span class="status-badge ${report.status}">${getStatusLabel(
    report.status
  )}</span>
            </div>
            <div class="detail-item">
                <label>Deskripsi:</label>
                <p>${report.description || "Tidak ada deskripsi"}</p>
            </div>
    `;

  if (report.photo_url) {
    html += `
            <div class="detail-item">
                <label>Foto:</label>
                <img src="${report.photo_url}" alt="Foto kerusakan" style="max-width: 100%; border-radius: 5px; margin-top: 10px;">
            </div>
        `;
  }

  html += `
            <div class="detail-item">
                <label>Tanggal Laporan:</label>
                <span>${formatDate(report.created_at)}</span>
            </div>
        </div>
    `;

  modalBody.innerHTML = html;
  document.getElementById("reportModal").classList.add("active");
}

// Update report status
async function updateReportStatusAction(reportId, status) {
  try {
    const result = await updateReportStatus(reportId, status);
    if (result.success) {
      showNotification(
        `Laporan berhasil ${
          status === "verified" ? "diverifikasi" : "ditolak"
        }`,
        "success"
      );
      await loadDashboardData();
      await loadReportsTable();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showNotification("Gagal memperbarui status: " + error.message, "error");
  }
}

// Open location picker modal
function openLocationPicker() {
  const modal = document.getElementById("locationModal");
  const mapContainer = document.getElementById("locationPickerMap");

  // Initialize map if not already
  if (!window.locationPickerMap) {
    window.locationPickerMap = L.map("locationPickerMap").setView(
      [-6.2088, 106.8456],
      13
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
      window.locationPickerMap
    );

    let marker = null;

    window.locationPickerMap.on("click", function (e) {
      const latlng = e.latlng;

      if (marker) {
        window.locationPickerMap.removeLayer(marker);
      }

      marker = L.marker(latlng)
        .addTo(window.locationPickerMap)
        .bindPopup("Lokasi terpilih")
        .openPopup();

      document.getElementById(
        "selectedLocation"
      ).textContent = `${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`;

      // Store selected location
      window.selectedLocation = latlng;
    });

    // Use location button
    document
      .getElementById("useLocationBtn")
      .addEventListener("click", function () {
        if (window.selectedLocation) {
          document.getElementById("latitude").value =
            window.selectedLocation.lat.toFixed(6);
          document.getElementById("longitude").value =
            window.selectedLocation.lng.toFixed(6);
          modal.classList.remove("active");
        } else {
          showNotification("Pilih lokasi di peta terlebih dahulu", "error");
        }
      });
  }

  modal.classList.add("active");
}

// Update system info
function updateSystemInfo() {
  const totalData = currentRoads.length + currentReports.length;
  document.getElementById("systemTotalData").textContent = totalData;

  // Find latest update
  const allData = [...currentRoads, ...currentReports];
  const latestUpdate = allData.reduce((latest, item) => {
    const date = new Date(item.updated_at || item.created_at);
    return date > latest ? date : latest;
  }, new Date(0));

  if (latestUpdate.getTime() > 0) {
    document.getElementById("lastUpdate").textContent =
      formatDate(latestUpdate);
  }
}

// Export data
async function exportData() {
  try {
    // Get all data
    const roads = await getRoads();
    const reports = await getPublicReports();

    const data = {
      roads: roads,
      reports: reports,
      exported_at: new Date().toISOString(),
    };

    // Convert to JSON
    const jsonData = JSON.stringify(data, null, 2);

    // Create download link
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jalan-rusak-data-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showNotification("Data berhasil diekspor", "success");
  } catch (error) {
    console.error("Error exporting data:", error);
    showNotification("Gagal mengekspor data", "error");
  }
}

// Confirm clear data
function confirmClearData() {
  if (
    confirm(
      "PERINGATAN: Tindakan ini akan menghapus SEMUA data. Apakah Anda yakin?"
    )
  ) {
    clearAllData();
  }
}

// Clear all data (demo only - in production this should be restricted)
async function clearAllData() {
  try {
    // This is a demo - in production, you should have proper admin controls
    showNotification(
      "Fitur hapus semua data hanya tersedia di mode development",
      "info"
    );
  } catch (error) {
    showNotification("Gagal menghapus data", "error");
  }
}

// Helper functions
function getStatusLabel(status) {
  const labels = {
    pending: "Menunggu",
    verified: "Terverifikasi",
    rejected: "Ditolak",
    completed: "Selesai",
  };
  return labels[status] || status;
}

function getSDILabel(condition) {
  const labels = {
    baik: "Baik",
    sedang: "Sedang",
    rusak_ringan: "Rusak Ringan",
    rusak_berat: "Rusak Berat",
  };
  return labels[condition] || condition;
}

function getPCILabel(condition) {
  const labels = {
    excellent: "Excellent",
    good: "Good",
    fair: "Fair",
    poor: "Poor",
    very_poor: "Very Poor",
    serious: "Serious",
    failed: "Failed",
  };
  return labels[condition] || condition;
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateDateTime() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  document.getElementById("currentDateTime").textContent =
    now.toLocaleDateString("id-ID", options);
}

function showNotification(message, type = "info") {
  // Create notification element
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

  // Add styles if not already added
  if (!document.querySelector("#notification-styles")) {
    const style = document.createElement("style");
    style.id = "notification-styles";
    style.textContent = `
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
                z-index: 10000;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                border-left: 4px solid #3b82f6;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-success {
                border-left-color: #10b981;
            }
            
            .notification-error {
                border-left-color: #ef4444;
            }
            
            .notification-info {
                border-left-color: #3b82f6;
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
                color: #6b7280;
            }
        `;
    document.head.appendChild(style);
  }

  // Add to body
  document.body.appendChild(notification);

  // Show notification
  setTimeout(() => notification.classList.add("show"), 10);

  // Close button
  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    });

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) notification.remove();
      }, 300);
    }
  }, 5000);
}

// Add status badge styles
const statusStyles = document.createElement("style");
statusStyles.textContent = `
    .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .status-badge.pending {
        background: #fef3c7;
        color: #92400e;
    }
    
    .status-badge.verified {
        background: #d1fae5;
        color: #065f46;
    }
    
    .status-badge.rejected {
        background: #fee2e2;
        color: #991b1b;
    }
    
    .status-badge.completed {
        background: #dbeafe;
        color: #1e40af;
    }
    
    .status-badge.baik, .status-badge.excellent, .status-badge.good {
        background: #d1fae5;
        color: #065f46;
    }
    
    .status-badge.sedang, .status-badge.fair {
        background: #fef3c7;
        color: #92400e;
    }
    
    .status-badge.rusak_ringan, .status-badge.poor {
        background: #fed7aa;
        color: #9a3412;
    }
    
    .status-badge.rusak_berat, .status-badge.very_poor, 
    .status-badge.serious, .status-badge.failed {
        background: #fecaca;
        color: #991b1b;
    }
    
    .status-badge.unknown {
        background: #e5e7eb;
        color: #6b7280;
    }
    
    .action-buttons {
        display: flex;
        gap: 5px;
    }
    
    .text-center {
        text-align: center;
    }
`;
document.head.appendChild(statusStyles);
