const tabImage = document.getElementById("tab-image");
const tabVideo = document.getElementById("tab-video");
const formImage = document.getElementById("form-image");
const formVideo = document.getElementById("form-video");
const dropImage = document.getElementById("drop-image");
const dropVideo = document.getElementById("drop-video");
const fileImage = document.getElementById("file-image");
const fileVideo = document.getElementById("file-video");
const imageFormat = document.getElementById("image-format");
const webpLosslessWrap = document.getElementById("webp-lossless-wrap");
const statusPanel = document.getElementById("status-panel");
const statusPhase = document.getElementById("status-phase");
const statusPct = document.getElementById("status-pct");
const statusBarFill = document.getElementById("status-bar-fill");
const statusDetail = document.getElementById("status-detail");
const fileQueuePanel = document.getElementById("file-queue-panel");
const fileQueueList = document.getElementById("file-queue-list");
const fileQueueBadge = document.getElementById("file-queue-badge");
const fileQueueHint = document.getElementById("file-queue-hint");
const resultsEl = document.getElementById("results");
const resultsList = document.getElementById("results-list");
const errorPanel = document.getElementById("error-panel");
const errorCodeEl = document.getElementById("error-code");
const errorTitleEl = document.getElementById("error-title");
const errorMessageEl = document.getElementById("error-message");
const errorDetailsEl = document.getElementById("error-details");
const btnImage = document.getElementById("btn-image");
const btnVideo = document.getElementById("btn-video");

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".svg",
]);
const VIDEO_EXT = new Set([".mp4", ".avi", ".mov", ".mkv", ".wmv"]);

const MAX_MB = 500;

const ERROR_LABELS = {
  FILE_TOO_LARGE: "File too large",
  TOO_MANY_FILES: "Too many files",
  BAD_UPLOAD_FIELD: "Upload format error",
  UPLOAD_FAILED: "Upload failed",
  INVALID_FILE_TYPE: "Unsupported file type",
  NO_FILES: "Nothing to upload",
  UNSUPPORTED_OUTPUT_FORMAT: "Invalid output format",
  PROCESSING_FAILED: "Processing failed",
  FFMPEG_ERROR: "Video encoder missing",
  NETWORK_ERROR: "Connection problem",
  PARSE_ERROR: "Invalid response",
  VALIDATION: "Check your files",
  ABORTED: "Upload cancelled",
  SERVER_ERROR: "Server error",
};

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function formatBytes(n) {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function setMode(mode) {
  const isImage = mode === "image";
  tabImage.classList.toggle("is-active", isImage);
  tabVideo.classList.toggle("is-active", !isImage);
  tabImage.setAttribute("aria-selected", String(isImage));
  tabVideo.setAttribute("aria-selected", String(!isImage));
  formImage.classList.toggle("hidden", !isImage);
  formVideo.classList.toggle("hidden", isImage);
  updateSelectedFilesSummary();
}

tabImage.addEventListener("click", () => setMode("image"));
tabVideo.addEventListener("click", () => setMode("video"));

imageFormat.addEventListener("change", () => {
  const isWebp = imageFormat.value === "webp";
  webpLosslessWrap.classList.toggle("hidden", !isWebp);
});

function wireDropzone(zone, input) {
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("is-dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer?.files;
    if (dt?.length) {
      input.files = dt;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

wireDropzone(dropImage, fileImage);
wireDropzone(dropVideo, fileVideo);

function updateSelectedFilesSummary() {
  if (!fileQueuePanel || !fileQueueList) return;
  const isImage = !formImage.classList.contains("hidden");
  const input = isImage ? fileImage : fileVideo;
  const files = input?.files;

  if (!files?.length) {
    fileQueuePanel.classList.add("hidden");
    return;
  }

  let total = 0;
  fileQueueList.innerHTML = "";
  for (const f of files) {
    total += f.size;
    const li = document.createElement("li");
    li.textContent = `${f.name} · ${formatBytes(f.size)}`;
    fileQueueList.appendChild(li);
  }

  const kind = isImage ? "Images" : "Video";
  fileQueueBadge.textContent = `${kind} · ${files.length} file(s)`;
  fileQueueHint.textContent = `${formatBytes(total)} total — use the Compress button below to upload and process.`;
  fileQueuePanel.classList.remove("hidden");
}

fileImage.addEventListener("change", updateSelectedFilesSummary);
fileVideo.addEventListener("change", updateSelectedFilesSummary);

/** Lets the browser paint status UI before a fast localhost request completes. */
function flushPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function clearError() {
  errorPanel.classList.add("hidden");
  errorCodeEl.textContent = "";
  errorTitleEl.textContent = "";
  errorMessageEl.textContent = "";
  errorDetailsEl.textContent = "";
  errorDetailsEl.classList.add("hidden");
}

/**
 * @param {string} message
 * @param {{ code?: string, title?: string, details?: string }} [meta]
 */
function showError(message, meta = {}) {
  const code = meta.code || "";
  const title =
    meta.title ||
    ERROR_LABELS[code] ||
    (code ? `Error (${code})` : "Something went wrong");

  errorCodeEl.textContent = code;
  errorTitleEl.textContent = title;
  errorMessageEl.textContent = message;

  if (meta.details && String(meta.details).trim()) {
    errorDetailsEl.textContent = String(meta.details).trim();
    errorDetailsEl.classList.remove("hidden");
  } else {
    errorDetailsEl.classList.add("hidden");
  }

  errorPanel.classList.remove("hidden");
}

function hideStatus() {
  statusPanel.classList.add("hidden");
  statusPanel.classList.remove("is-processing");
  statusPanel.setAttribute("aria-busy", "false");
  btnImage.disabled = false;
  btnVideo.disabled = false;
  updateSelectedFilesSummary();
}

/**
 * @param {"upload" | "process"} phase
 * @param {{ percent?: number, detail?: string, processingLabel?: string }} [opts]
 */
function showStatus(phase, opts = {}) {
  if (fileQueuePanel) fileQueuePanel.classList.add("hidden");
  statusPanel.classList.remove("hidden");
  statusPanel.setAttribute("aria-busy", "true");
  btnImage.disabled = true;
  btnVideo.disabled = true;

  if (phase === "upload") {
    statusPanel.classList.remove("is-processing");
    const unknown = opts.percent === null;
    const pct =
      typeof opts.percent === "number" ? opts.percent : unknown ? 0 : 0;
    statusPhase.textContent = "Uploading to server";
    statusPct.textContent = unknown ? "…" : `${pct}%`;
    const barPct = unknown ? 8 : Math.min(100, Math.max(3, pct));
    statusBarFill.style.width = `${barPct}%`;
    statusDetail.textContent =
      opts.detail ||
      "Sending your files. For large videos this step can take a while.";
  } else {
    statusPanel.classList.add("is-processing");
    statusPhase.textContent = opts.processingLabel || "Processing on server";
    statusPct.textContent = "…";
    statusBarFill.style.width = "100%";
    statusDetail.textContent =
      opts.detail ||
      "The server is compressing your files. You can leave this tab open.";
  }

  queueMicrotask(() => {
    statusPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function validateImageFiles(fileList) {
  const bad = [];
  if (fileList.length > 50) {
    bad.push(
      `Too many files at once (max 50). You selected ${fileList.length}.`
    );
    return { bad, total: 0 };
  }
  let total = 0;
  for (const f of fileList) {
    total += f.size;
    const ext = extOf(f.name);
    if (!IMAGE_EXT.has(ext)) {
      bad.push(`${f.name} — use JPEG, PNG, GIF, BMP, TIFF, or SVG`);
    } else if (f.size > MAX_MB * 1024 * 1024) {
      bad.push(`${f.name} — exceeds ${MAX_MB} MB per file`);
    }
  }
  return { bad, total };
}

function validateVideoFiles(fileList) {
  const bad = [];
  if (fileList.length > 20) {
    bad.push(
      `Too many files at once (max 20). You selected ${fileList.length}.`
    );
    return { bad, total: 0 };
  }
  let total = 0;
  for (const f of fileList) {
    total += f.size;
    const ext = extOf(f.name);
    if (!VIDEO_EXT.has(ext)) {
      bad.push(`${f.name} — use MP4, AVI, MOV, MKV, or WMV`);
    } else if (f.size > MAX_MB * 1024 * 1024) {
      bad.push(`${f.name} — exceeds ${MAX_MB} MB per file`);
    }
  }
  return { bad, total };
}

function showResults(files) {
  resultsList.innerHTML = "";
  const origin = window.location.origin;
  for (const f of files) {
    const href = f.url.startsWith("http") ? f.url : `${origin}${f.url}`;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.download = f.name;
    a.append(document.createTextNode(f.name), " ");
    const span = document.createElement("span");
    span.textContent = "Download";
    a.appendChild(span);
    li.appendChild(a);
    resultsList.appendChild(li);
  }
  resultsEl.classList.remove("hidden");
}

/**
 * @param {string} url
 * @param {FormData} formData
 * @param {{
 *   onUploadProgress?: (p: {
 *     percent: number | null,
 *     loaded: number,
 *     total: number | null
 *   }) => void,
 *   onUploadComplete?: () => void
 * }} [callbacks]
 */
function postFormWithProgress(url, formData, callbacks = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.addEventListener("progress", (e) => {
      if (!callbacks.onUploadProgress) return;
      if (e.lengthComputable) {
        const percent = Math.min(
          100,
          Math.round((e.loaded / e.total) * 100)
        );
        callbacks.onUploadProgress({
          loaded: e.loaded,
          total: e.total,
          percent,
        });
      } else {
        callbacks.onUploadProgress({
          loaded: e.loaded,
          total: null,
          percent: null,
        });
      }
    });
    xhr.upload.addEventListener("load", () => {
      callbacks.onUploadComplete?.();
    });
    xhr.addEventListener("load", () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        const parseErr = new Error(
          "The server returned an invalid response (not JSON)."
        );
        parseErr.code = "PARSE_ERROR";
        parseErr.details = xhr.responseText?.slice(0, 500) || "";
        reject(parseErr);
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      const err = new Error(
        data.error || xhr.statusText || `Request failed (${xhr.status})`
      );
      err.code = data.code;
      err.details = data.details;
      err.status = xhr.status;
      reject(err);
    });
    xhr.addEventListener("error", () => {
      const err = new Error(
        "Could not reach the server. Check that the app is running and your network connection."
      );
      err.code = "NETWORK_ERROR";
      reject(err);
    });
    xhr.addEventListener("abort", () => {
      const err = new Error("Upload was cancelled.");
      err.code = "ABORTED";
      reject(err);
    });
    xhr.send(formData);
  });
}

formImage.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  resultsEl.classList.add("hidden");

  if (!fileImage.files?.length) {
    showError("Select at least one image before compressing.", {
      code: "NO_FILES",
      title: ERROR_LABELS.NO_FILES,
    });
    return;
  }

  const list = Array.from(fileImage.files);
  const { bad, total } = validateImageFiles(list);
  if (bad.length) {
    showError("These files cannot be uploaded:", {
      code: "VALIDATION",
      title: ERROR_LABELS.VALIDATION,
      details: bad.join("\n"),
    });
    return;
  }

  const fd = new FormData();
  for (const file of list) {
    fd.append("files", file);
  }
  fd.append("format", imageFormat.value);
  fd.append("quality", document.getElementById("image-quality").value);
  fd.append(
    "lossless",
    document.getElementById("image-lossless").checked ? "true" : "false"
  );

  let serverPhase = false;
  showStatus("upload", {
    percent: 0,
    detail: `${list.length} file(s) · ${formatBytes(total)} total`,
  });
  await flushPaint();

  try {
    const data = await postFormWithProgress("/api/compress/images", fd, {
      onUploadProgress: ({ percent, loaded, total: t }) => {
        if (serverPhase) return;
        const detail =
          t == null
            ? `Uploading ${list.length} file(s) · ${formatBytes(loaded)} sent…`
            : `Uploading ${list.length} file(s) · ${formatBytes(
                loaded
              )} of ${formatBytes(t)}`;
        showStatus("upload", {
          percent: percent == null ? null : percent,
          detail,
        });
      },
      onUploadComplete: () => {
        serverPhase = true;
        showStatus("process", {
          processingLabel: "Compressing images",
          detail:
            "Upload finished. Converting and optimizing on the server…",
        });
      },
    });
    showResults(data.files);
  } catch (err) {
    showError(err.message, {
      code: err.code,
      details: err.details,
      title: err.code ? ERROR_LABELS[err.code] : undefined,
    });
  } finally {
    hideStatus();
  }
});

formVideo.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  resultsEl.classList.add("hidden");

  if (!fileVideo.files?.length) {
    showError("Select at least one video before compressing.", {
      code: "NO_FILES",
      title: ERROR_LABELS.NO_FILES,
    });
    return;
  }

  const list = Array.from(fileVideo.files);
  const { bad, total } = validateVideoFiles(list);
  if (bad.length) {
    showError("These files cannot be uploaded:", {
      code: "VALIDATION",
      title: ERROR_LABELS.VALIDATION,
      details: bad.join("\n"),
    });
    return;
  }

  const fd = new FormData();
  for (const file of list) {
    fd.append("files", file);
  }
  fd.append("format", document.getElementById("video-format").value);
  fd.append("quality", document.getElementById("video-quality").value);
  const mw = document.getElementById("video-max-width").value.trim();
  const br = document.getElementById("video-bitrate").value.trim();
  if (mw) fd.append("maxWidth", mw);
  if (br) fd.append("bitrate", br);

  let serverPhase = false;
  showStatus("upload", {
    percent: 0,
    detail: `${list.length} file(s) · ${formatBytes(total)} total`,
  });
  await flushPaint();

  try {
    const data = await postFormWithProgress("/api/compress/videos", fd, {
      onUploadProgress: ({ percent, loaded, total: t }) => {
        if (serverPhase) return;
        const detail =
          t == null
            ? `Uploading ${list.length} file(s) · ${formatBytes(loaded)} sent…`
            : `Uploading ${list.length} file(s) · ${formatBytes(
                loaded
              )} of ${formatBytes(t)}`;
        showStatus("upload", {
          percent: percent == null ? null : percent,
          detail,
        });
      },
      onUploadComplete: () => {
        serverPhase = true;
        showStatus("process", {
          processingLabel: "Encoding video",
          detail:
            "Upload finished. FFmpeg is encoding on the server (this may take several minutes).",
        });
      },
    });
    showResults(data.files);
  } catch (err) {
    showError(err.message, {
      code: err.code,
      details: err.details,
      title: err.code ? ERROR_LABELS[err.code] : undefined,
    });
  } finally {
    hideStatus();
  }
});
