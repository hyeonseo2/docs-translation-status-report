const STATUS_LABELS = {
  translated: "Translated",
  outdated: "Outdated",
  missing: "Missing",
};
const STATUS_CLASS = {
  translated: "status-translated",
  outdated: "status-outdated",
  missing: "status-missing",
};

let snapshotData = null;
const kpiTotal = document.getElementById("kpiTotal");
const kpiTranslated = document.getElementById("kpiTranslated");
const kpiOutdated = document.getElementById("kpiOutdated");
const kpiMissing = document.getElementById("kpiMissing");
const docsTable = document.getElementById("docsTable");
const filterButtons = document.querySelectorAll(".filter-btn");
const sortSelect = document.getElementById("sortSelect");
const statusChartCanvas = document.getElementById("statusChart");
const activityChartCanvas = document.getElementById("activityChart");

const projectName = document.getElementById("projectName");
const languageName = document.getElementById("languageName");
const generatedAt = document.getElementById("generatedAt");

let statusChart = null;
let activityChart = null;

const getCssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
};

const toSentenceCase = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const updateMeta = (data) => {
  projectName.textContent = data.project ?? "-";
  languageName.textContent = data.language ?? "-";
  generatedAt.textContent = formatDate(data.generated_at);
};

const updateKpis = (files) => {
  const totals = files.reduce(
    (acc, file) => {
      acc.total += 1;
      if (acc[file.status] !== undefined) {
        acc[file.status] += 1;
      }
      return acc;
    },
    { total: 0, translated: 0, outdated: 0, missing: 0 }
  );
  totals.translated = totals.total - totals.missing;

  kpiTotal.textContent = totals.total;
  kpiTranslated.textContent = totals.translated;
  kpiOutdated.textContent = totals.outdated;
  kpiMissing.textContent = totals.missing;
};

const renderStatusChart = (files) => {
  if (!statusChartCanvas || typeof Chart === "undefined") return;
  const counts = files.reduce(
    (acc, file) => {
      if (acc[file.status] !== undefined) {
        acc[file.status] += 1;
      }
      return acc;
    },
    { translated: 0, outdated: 0, missing: 0 }
  );

  const data = {
    labels: [
      STATUS_LABELS.translated,
      STATUS_LABELS.outdated,
      STATUS_LABELS.missing,
    ],
    datasets: [
      {
        data: [counts.translated, counts.outdated, counts.missing],
        backgroundColor: [
          getCssVar("--translated"),
          getCssVar("--outdated"),
          getCssVar("--missing"),
        ],
        borderWidth: 0,
      },
    ],
  };

  if (statusChart) {
    statusChart.destroy();
  }

  statusChart = new Chart(statusChartCanvas, {
    type: "doughnut",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
};

const renderActivityChart = (files) => {
  if (!activityChartCanvas || typeof Chart === "undefined") return;
  const countsByDate = files.reduce((acc, file) => {
    if (!file.last_commit_date) return acc;
    acc[file.last_commit_date] = (acc[file.last_commit_date] || 0) + 1;
    return acc;
  }, {});

  const dates = Object.keys(countsByDate).sort();
  const counts = dates.map((date) => countsByDate[date]);

  if (activityChart) {
    activityChart.destroy();
  }

  activityChart = new Chart(activityChartCanvas, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Updated docs",
          data: counts,
          borderColor: getCssVar("--primary"),
          backgroundColor: "rgba(31, 111, 235, 0.2)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
};

const renderTable = (files) => {
  docsTable.innerHTML = "";
  files.forEach((file) => {
    const row = document.createElement("tr");

    const pathCell = document.createElement("td");
    pathCell.textContent = file.path;

    const statusCell = document.createElement("td");
    const statusPill = document.createElement("span");
    statusPill.className = `status-pill ${
      STATUS_CLASS[file.status] ?? ""
    }`;
    statusPill.textContent = STATUS_LABELS[file.status] ?? file.status;
    statusCell.appendChild(statusPill);

    const commitCell = document.createElement("td");
    commitCell.textContent = formatDate(file.last_commit_date);

    const sourceCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = file.source_url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Open";
    link.className = "source-link";
    sourceCell.appendChild(link);

    row.append(pathCell, statusCell, commitCell, sourceCell);
    docsTable.appendChild(row);
  });
};

const sortFiles = (files, sortBy) => {
  const copy = [...files];
  const byPath = (direction) =>
    copy.sort((a, b) =>
      direction === "asc"
        ? a.path.localeCompare(b.path)
        : b.path.localeCompare(a.path)
    );
  const byDate = (direction) =>
    copy.sort((a, b) => {
      const aTime = a.last_commit_date
        ? new Date(a.last_commit_date).getTime()
        : null;
      const bTime = b.last_commit_date
        ? new Date(b.last_commit_date).getTime()
        : null;
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return direction === "asc" ? aTime - bTime : bTime - aTime;
    });

  switch (sortBy) {
    case "path-desc":
      return byPath("desc");
    case "date-asc":
      return byDate("asc");
    case "date-desc":
      return byDate("desc");
    case "path-asc":
    default:
      return byPath("asc");
  }
};

const updateSortState = (filter) => {
  if (!sortSelect) return;
  const shouldEnable = filter === "missing" || filter === "outdated";
  sortSelect.disabled = !shouldEnable;
  sortSelect.parentElement?.classList.toggle("is-disabled", !shouldEnable);
};

const applyFilter = (filter) => {
  if (!snapshotData) return;
  const files = snapshotData.files || [];
  const filtered =
    filter === "all" ? files : files.filter((file) => file.status === filter);
  const sortBy = sortSelect?.value ?? "path-asc";
  const sorted = sortFiles(filtered, sortBy);
  renderTable(sorted);
};

const updateActiveFilter = (selected) => {
  filterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === selected);
  });
};

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    updateActiveFilter(filter);
    updateSortState(filter);
    applyFilter(filter);
  });
});

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    const active =
      document.querySelector(".filter-btn.active")?.dataset.filter ?? "all";
    applyFilter(active);
  });
}

const loadSnapshot = async () => {
  try {
    const response = await fetch("data/snapshot.json");
    if (!response.ok) {
      throw new Error("Failed to load snapshot.json");
    }
    const data = await response.json();
    snapshotData = data;
    updateMeta(data);

    const files = data.files || [];
    updateKpis(files);
    renderStatusChart(files);
    renderActivityChart(files);
    updateActiveFilter("all");
    updateSortState("all");
    applyFilter("all");
  } catch (error) {
    console.error(error);
    docsTable.innerHTML =
      '<tr><td colspan="4">Unable to load snapshot data.</td></tr>';
  }
};

loadSnapshot();
