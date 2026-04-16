const API_BASE_URL = "https://fracture-backend.onrender.com";

const backendStatus = document.getElementById("backendStatus");
const authorName = document.getElementById("authorName");
const authorId = document.getElementById("authorId");

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const selectImageBtn = document.getElementById("selectImageBtn");
const previewImage = document.getElementById("previewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const predictBtn = document.getElementById("predictBtn");

const videoDropZone = document.getElementById("videoDropZone");
const videoInput = document.getElementById("videoInput");
const selectVideoBtn = document.getElementById("selectVideoBtn");
const videoFileName = document.getElementById("videoFileName");
const videoPredictBtn = document.getElementById("videoPredictBtn");

const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const analyzeFrameBtn = document.getElementById("analyzeFrameBtn");
const camera = document.getElementById("camera");
const cameraCanvas = document.getElementById("cameraCanvas");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");

const diagnosisText = document.getElementById("diagnosisText");
const predictionText = document.getElementById("predictionText");
const severityText = document.getElementById("severityText");
const classIdText = document.getElementById("classIdText");
const confidenceText = document.getElementById("confidenceText");
const explanationText = document.getElementById("explanationText");
const probabilityBars = document.getElementById("probabilityBars");
const extraResultBox = document.getElementById("extraResultBox");
const errorBox = document.getElementById("errorBox");
const loading = document.getElementById("loading");

let currentStream = null;

async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/`);
    const data = await res.json();

    backendStatus.textContent = "已连接";
    backendStatus.className = "safe-text";

    if (data.author_name) authorName.textContent = data.author_name;
    if (data.author_id) authorId.textContent = data.author_id;
  } catch (e) {
    backendStatus.textContent = "未连接";
    backendStatus.className = "danger-text";
  }
}

checkBackend();

function showLoading(text = "分析中，请稍候...") {
  loading.textContent = text;
  loading.classList.remove("hidden");
  errorBox.classList.add("hidden");
}

function hideLoading() {
  loading.classList.add("hidden");
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function renderProbabilities(items = []) {
  probabilityBars.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "prob-row";

    row.innerHTML = `
      <div class="prob-head">
        <span>${item.label}</span>
        <span>${(item.probability * 100).toFixed(2)}%</span>
      </div>
      <div class="prob-track">
        <div class="prob-fill" style="width: 0%"></div>
      </div>
    `;

    probabilityBars.appendChild(row);

    setTimeout(() => {
      const fill = row.querySelector(".prob-fill");
      fill.style.width = `${(item.probability * 100).toFixed(2)}%`;
    }, 80);
  });
}

function renderImageResult(data) {
  diagnosisText.textContent = data.diagnosis || "-";
  predictionText.textContent = data.prediction || "-";
  severityText.textContent = data.severity || "-";
  classIdText.textContent = data.class_id ?? "-";
  confidenceText.textContent = `${((data.confidence || 0) * 100).toFixed(2)}%`;
  explanationText.textContent = data.explanation || "暂无解释信息。";

  diagnosisText.className = data.is_fracture ? "value danger-text" : "value safe-text";

  renderProbabilities(data.top_predictions || []);
  extraResultBox.innerHTML = "";
}

function renderVideoResult(data) {
  diagnosisText.textContent = data.diagnosis || "-";
  predictionText.textContent = data.prediction || "-";
  severityText.textContent = data.severity || "-";
  classIdText.textContent = "-";
  confidenceText.textContent = `${((data.confidence || 0) * 100).toFixed(2)}%`;
  explanationText.textContent = "视频结果基于逐帧抽样分析得到，为课程项目演示用途。";
  diagnosisText.className = data.is_fracture ? "value danger-text" : "value safe-text";

  probabilityBars.innerHTML = "";

  extraResultBox.innerHTML = `
    <h4>视频检测摘要</h4>
    <p>抽样分析帧数：${data.frames_analyzed}</p>
    <p>骨折风险帧数：${data.fracture_votes}</p>
    <p>正常帧数：${data.normal_votes}</p>
  `;
}

selectImageBtn.addEventListener("click", () => fileInput.click());
selectVideoBtn.addEventListener("click", () => videoInput.click());

function bindDropZone(zone, input, fileType = "image") {
  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
    });
  });

  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (fileType === "image" && !file.type.startsWith("image/")) {
      showError("请上传图片文件。");
      return;
    }

    if (fileType === "video" && !file.type.startsWith("video/")) {
      showError("请上传视频文件。");
      return;
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;

    if (fileType === "image") updateImagePreview(file);
    if (fileType === "video") videoFileName.textContent = file.name;
  });
}

bindDropZone(dropZone, fileInput, "image");
bindDropZone(videoDropZone, videoInput, "video");

function updateImagePreview(file) {
  clearError();
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    previewImage.style.display = "block";
    previewPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  updateImagePreview(file);
});

videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];
  videoFileName.textContent = file ? file.name : "未选择视频";
});

predictBtn.addEventListener("click", async () => {
  clearError();

  const file = fileInput.files[0];
  if (!file) {
    showError("请先选择图片。");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showLoading("图片分析中，请稍候...");

  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "图片分析失败");
    renderImageResult(data);
  } catch (e) {
    showError(`请求失败：${e.message}`);
  } finally {
    hideLoading();
  }
});

videoPredictBtn.addEventListener("click", async () => {
  clearError();

  const file = videoInput.files[0];
  if (!file) {
    showError("请先选择视频。");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showLoading("视频检测中，请稍候，这一步可能稍慢...");

  try {
    const res = await fetch(`${API_BASE_URL}/predict_video`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "视频检测失败");
    renderVideoResult(data);
  } catch (e) {
    showError(`请求失败：${e.message}`);
  } finally {
    hideLoading();
  }
});

startCameraBtn.addEventListener("click", async () => {
  clearError();

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    camera.srcObject = currentStream;
    camera.style.display = "block";
    cameraPlaceholder.style.display = "none";
  } catch (e) {
    showError("无法打开摄像头，请检查浏览器权限。");
  }
});

stopCameraBtn.addEventListener("click", () => {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  camera.srcObject = null;
  camera.style.display = "none";
  cameraPlaceholder.style.display = "block";
});

analyzeFrameBtn.addEventListener("click", async () => {
  clearError();

  if (!currentStream) {
    showError("请先开启摄像头。");
    return;
  }

  const width = camera.videoWidth;
  const height = camera.videoHeight;

  if (!width || !height) {
    showError("摄像头画面尚未准备好，请稍后重试。");
    return;
  }

  cameraCanvas.width = width;
  cameraCanvas.height = height;

  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(camera, 0, 0, width, height);

  const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.9);

  showLoading("实时画面分析中，请稍候...");

  try {
    const res = await fetch(`${API_BASE_URL}/predict_frame`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: dataUrl })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "实时检测失败");
    renderImageResult(data);
  } catch (e) {
    showError(`请求失败：${e.message}`);
  } finally {
    hideLoading();
  }
});