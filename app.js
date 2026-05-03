document.addEventListener("DOMContentLoaded", () => {

  let files = [];
  let results = [];
  let originalImages = [];

  const drop           = document.getElementById("drop");
  const fileInput      = document.getElementById("fileInput");
  const preview        = document.getElementById("preview");
  const status         = document.getElementById("status");
  const previewCount   = document.getElementById("previewCount");
  const uploadedImages = document.getElementById("uploadedImages");
  const btnSelectAll   = document.getElementById("selectAll");
  const btnSelectNone  = document.getElementById("selectNone");
  const btnDlSelected  = document.getElementById("downloadSelected");

  console.log("✓ App.js loaded - DOM Ready");
  console.log("  drop:", !!drop, "fileInput:", !!fileInput);

  // Wire all sliders to show live values
  ["color","brightness","saturation","resize","sizevar","zoom","rotation","crop","shift","quality"].forEach(id => {
    const slider = document.getElementById(id);
    const val = document.getElementById("v-" + id);
    if (slider && val) {
      slider.addEventListener("input", () => val.textContent = slider.value);
    }
  });

  // UPLOAD HANDLER
  if (!drop || !fileInput) {
    console.error("ERROR: Missing drop or fileInput element!");
    return;
  }

  // Click handler
  drop.onclick = () => {
    console.log(">> Click: opening file picker");
    fileInput.click();
  };

  // File selection handler
  fileInput.onchange = (e) => {
    const count = e.target.files.length;
    console.log(">> File selection:", count, "files");
    
    if (count > 0) {
      const newFiles = Array.from(e.target.files);
      files.push(...newFiles);
      originalImages.push(...newFiles);
      
      if (status) status.textContent = `✓ ${files.length} file(s) ready`;
      displayUploadedImages();
      console.log("✓ Total files:", files.length);
    }
  };

  // Drag over
  drop.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.background = "#e8f5e9";
    drop.style.borderColor = "#4caf50";
  };

  // Drag leave
  drop.ondragleave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.background = "#fafafa";
    drop.style.borderColor = "#bbb";
  };

  // Drop handler
  drop.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.style.background = "#fafafa";
    drop.style.borderColor = "#bbb";
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    console.log(">> Drop:", droppedFiles.length, "image files");
    
    if (droppedFiles.length > 0) {
      files.push(...droppedFiles);
      originalImages.push(...droppedFiles);
      
      if (status) status.textContent = `✓ ${files.length} file(s) ready`;
      displayUploadedImages();
      console.log("✓ Total files:", files.length);
    }
  };

  console.log("✓ Upload handlers attached");

  // Generate Facebook-style random filename
  function generateRandomFileName() {
    const rand = () => Math.floor(Math.random() * 1000000000000000).toString();
    return `${rand()}_${rand()}_${rand()}_n.jpg`;
  }

  // Display uploaded images thumbnails
  function displayUploadedImages() {
    if (originalImages.length === 0) {
      uploadedImages.innerHTML = '<div style="color:#999;font-size:12px;padding:20px;text-align:center;grid-column:1/-1;">No images yet</div>';
      return;
    }

    uploadedImages.innerHTML = '';

    // Count row
    const countRow = document.createElement("div");
    countRow.style.cssText = "grid-column:1/-1;font-size:11px;color:#555;margin-bottom:4px;";
    countRow.textContent = `${originalImages.length} image${originalImages.length !== 1 ? "s" : ""} uploaded`;
    uploadedImages.appendChild(countRow);

    originalImages.forEach((file, idx) => {
      const url = URL.createObjectURL(file);

      const cell = document.createElement("div");
      cell.style.cssText = "display:flex;flex-direction:column;gap:3px;min-width:0;";

      const thumb = document.createElement("div");
      thumb.style.cssText = "position:relative;width:100%;aspect-ratio:1;background:#f0f0f0;border-radius:6px;overflow:hidden;";

      const img = document.createElement("img");
      img.src = url;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      img.onload = () => URL.revokeObjectURL(url);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.style.cssText = "position:absolute;top:3px;right:3px;width:20px;height:20px;background:rgba(0,0,0,0.6);color:#fff;border:none;border-radius:50%;font-size:14px;cursor:pointer;line-height:1;padding:0;display:flex;align-items:center;justify-content:center;";
      removeBtn.title = "Remove";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        originalImages.splice(idx, 1);
        files.splice(idx, 1);
        displayUploadedImages();
        status.textContent = originalImages.length > 0 ? `✓ ${originalImages.length} file(s) ready` : "";
      };

      const name = document.createElement("div");
      name.style.cssText = "font-size:10px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
      name.title = file.name;
      name.textContent = file.name;

      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      cell.appendChild(thumb);
      cell.appendChild(name);
      uploadedImages.appendChild(cell);
    });
  }

  // GATHER SETTINGS
  function getSettings() {
    return {
      color:      +document.getElementById("color").value,
      brightness: +document.getElementById("brightness").value,
      saturation: +document.getElementById("saturation").value,
      resize:     +document.getElementById("resize").value,
      sizevar:    +document.getElementById("sizevar").value,
      zoom:       +document.getElementById("zoom").value,
      rotation:   +document.getElementById("rotation").value,
      crop:       +document.getElementById("crop").value,
      shift:      +document.getElementById("shift").value,
      quality:    +document.getElementById("quality").value,
      flipH:      document.getElementById("flipH").checked,
      pro:        document.getElementById("pro").checked,
      stripExif:  document.getElementById("stripExif").checked
    };
  }

  // PROCESS BUTTON
  document.getElementById("run").onclick = async () => {
    if (files.length === 0) {
      status.textContent = "⚠ Upload images first";
      return;
    }

    console.log("🔄 PROCESS START - files:", files.length);
    preview.innerHTML = "";
    results = [];
    previewCount.textContent = "Processing...";
    status.textContent = "🔄 Processing...";

    const settings = getSettings();
    const copies = +document.getElementById("copies").value;
    console.log("📋 Settings:", { ...settings, copies });

    const tasks = [];
    const taskFileIdx = [];

    for (let fi = 0; fi < files.length; fi++) {
      for (let c = 0; c < copies; c++) {
        tasks.push(runWorker(files[fi], settings));
        taskFileIdx.push(fi);
      }
    }

    console.log("⏳ Spawning", tasks.length, "workers...");
    const output = await Promise.all(tasks);
    console.log("✓ All workers done, results:", output.length);

    output.forEach((item, idx) => {
      if (item && item.ok) {
        const fileName = generateRandomFileName();
        results.push({ blob: item.blob, fileName });
      } else {
        console.warn("⚠ Task", idx, "failed or returned null");
      }
    });
    console.log("📦 Stored", results.length, "blobs for download");

    for (let i = 0; i < output.length; i++) {
      const item = output[i];
      if (!item || !item.ok) continue;

      const blob     = item.blob;
      const origFile = originalImages[taskFileIdx[i]];

      const wrapper = document.createElement("div");
      wrapper.className = "thumb";
      wrapper.dataset.idx = i;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "thumb-checkbox";
      cb.addEventListener("change", () => {
        wrapper.classList.toggle("selected", cb.checked);
      });

      const img = document.createElement("img");
      const url = URL.createObjectURL(blob);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        cb.checked = !cb.checked;
        wrapper.classList.toggle("selected", cb.checked);
      });

      const label = document.createElement("div");
      label.className = "sim-label";
      label.textContent = "scoring...";

      wrapper.appendChild(cb);
      wrapper.appendChild(img);
      wrapper.appendChild(label);
      preview.appendChild(wrapper);

      (async () => {
        try {
          const orig = await loadImg(origFile);
          const proc = await loadImgBlob(blob);
          const score = computeSimilarity(orig, proc);
          label.textContent = score + "% similar";
          if      (score < 70) label.classList.add("sim-green");
          else if (score < 85) label.classList.add("sim-yellow");
          else                 label.classList.add("sim-red");
        } catch {
          label.textContent = "";
        }
      })();
    }

    previewCount.textContent = `✓ ${results.length} processed`;
    status.textContent = `✓ Done - ${results.length} ready to download`;
    console.log("✅ PROCESS COMPLETE");
  };

  // WORKER
  function runWorker(file, settings) {
    return new Promise((resolve) => {
      const worker = new Worker("worker.js");
      worker.postMessage({ file, settings });
      worker.onmessage = (e) => { 
        console.log("✓ Worker returned:", e.data.ok ? "ok" : "error");
        resolve(e.data); 
        worker.terminate(); 
      };
      worker.onerror = (err) => { 
        console.error("✗ Worker crashed:", err.message);
        resolve({ ok: false }); 
        worker.terminate(); 
      };
    });
  }

  // SIMILARITY SCORING
  function computeSimilarity(img1, img2) {
    const size = 64;
    const c1 = document.createElement("canvas");
    const c2 = document.createElement("canvas");
    c1.width = c1.height = c2.width = c2.height = size;
    const ctx1 = c1.getContext("2d");
    const ctx2 = c2.getContext("2d");
    ctx1.drawImage(img1, 0, 0, size, size);
    ctx2.drawImage(img2, 0, 0, size, size);
    const d1 = ctx1.getImageData(0, 0, size, size).data;
    const d2 = ctx2.getImageData(0, 0, size, size).data;
    let diff = 0;
    for (let i = 0; i < d1.length; i++) diff += Math.abs(d1[i] - d2[i]);
    return Math.max(0, Math.min(100, (100 - diff / d1.length).toFixed(1)));
  }

  function loadImg(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  function loadImgBlob(blob) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(blob);
    });
  }

  // Returns checked results, falls back to all if none selected
  function getTargetResults() {
    const checks = document.querySelectorAll("#preview .thumb-checkbox");
    const selected = [];
    checks.forEach((cb, i) => { if (cb.checked) selected.push(results[i]); });
    return selected.length > 0 ? selected : results;
  }

  // SELECT ALL / NONE
  btnSelectAll.onclick = () => {
    document.querySelectorAll("#preview .thumb-checkbox").forEach(cb => {
      cb.checked = true;
      cb.closest(".thumb").classList.add("selected");
    });
  };
  btnSelectNone.onclick = () => {
    document.querySelectorAll("#preview .thumb-checkbox").forEach(cb => {
      cb.checked = false;
      cb.closest(".thumb").classList.remove("selected");
    });
  };

  // DOWNLOAD SELECTED (ZIP)
  btnDlSelected.onclick = async () => {
    if (results.length === 0) { status.textContent = "⚠ Process images first"; return; }
    const items = getTargetResults();
    status.textContent = "📦 Building ZIP...";
    const zip = new JSZip();
    items.forEach((item) => zip.file(item.fileName, item.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "variation_images.zip";
    a.click();
    status.textContent = `✓ ZIP downloaded (${items.length} images)`;
  };

  // DOWNLOAD ZIP
  document.getElementById("downloadZip").onclick = async () => {
    if (results.length === 0) {
      status.textContent = "⚠ Process images first";
      return;
    }
    status.textContent = "📦 Building ZIP...";
    const zip = new JSZip();
    results.forEach((item) => zip.file(item.fileName, item.blob));
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "variation_images.zip";
    a.click();
    status.textContent = `✓ ZIP downloaded (${results.length} images)`;
  };

  // DOWNLOAD ALL — folder picker on Chrome/Edge, ZIP fallback on other browsers
  document.getElementById("downloadDirect").onclick = async () => {
    if (results.length === 0) {
      status.textContent = "⚠ Process images first";
      return;
    }

    const items = getTargetResults();

    if (typeof window.showDirectoryPicker === "function") {
      let dirHandle;
      try {
        dirHandle = await window.showDirectoryPicker();
      } catch {
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        status.textContent = `⬇ Saving ${i + 1} / ${items.length}...`;
        try {
          const fileHandle = await dirHandle.getFileHandle(item.fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(item.blob);
          await writable.close();
        } catch (e) {
          console.error("Failed to write", item.fileName, e);
        }
      }

      status.textContent = `✓ Saved ${items.length} images`;
    } else {
      status.textContent = "📦 Building ZIP...";
      const zip = new JSZip();
      items.forEach((item) => zip.file(item.fileName, item.blob));
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(content);
      a.download = "variation_images.zip";
      a.click();
      status.textContent = `✓ ZIP downloaded (${items.length} images)`;
    }
  };

});
