const $ = (id) => document.getElementById(id);

const state = {
  imageBase64: null, // 压缩后的 dataURL
  roomType: "客厅",
  style: "现代简约",
  size: "1024x1024",
};

// ---------- 初始化：拉取配置，渲染品牌与选项 ----------
async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    if (cfg.brandName) {
      $("brandName").textContent = cfg.brandName;
      document.title = cfg.brandName + " · AI 装修效果图";
    }
    if (cfg.brandContact) $("brandContact").textContent = cfg.brandContact;
    if (cfg.demo) $("demoTip").hidden = false;
    renderChips("roomChips", cfg.rooms || ["客厅"], "roomType");
    renderChips("styleChips", cfg.styles || ["现代简约"], "style");
  } catch (e) {
    renderChips("roomChips", ["客厅", "卧室", "厨房"], "roomType");
    renderChips("styleChips", ["现代简约", "北欧", "日式"], "style");
  }
}

function renderChips(containerId, items, stateKey) {
  const box = $(containerId);
  box.innerHTML = "";
  items.forEach((label, i) => {
    const el = document.createElement("div");
    el.className = "chip" + (i === 0 ? " active" : "");
    el.textContent = label;
    if (i === 0) state[stateKey] = label;
    el.onclick = () => {
      box.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      el.classList.add("active");
      state[stateKey] = label;
    };
    box.appendChild(el);
  });
}

// ---------- 上传 + 压缩 ----------
$("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => compressImage(ev.target.result);
  reader.readAsDataURL(file);
});

function compressImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const MAX = 1024;
    let { width: w, height: h } = img;
    if (w > h && w > MAX) {
      h = Math.round((h * MAX) / w);
      w = MAX;
    } else if (h >= w && h > MAX) {
      w = Math.round((w * MAX) / h);
      h = MAX;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    state.imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    // 根据宽高比选择出图尺寸
    state.size = w > h * 1.2 ? "1536x1024" : h > w * 1.2 ? "1024x1536" : "1024x1024";

    const preview = $("preview");
    preview.src = state.imageBase64;
    $("uploader").classList.add("has-image");
  };
  img.src = dataUrl;
}

// ---------- 生成 ----------
$("generateBtn").addEventListener("click", async () => {
  if (!state.imageBase64) {
    alert("请先上传一张房间照片");
    return;
  }
  $("overlay").hidden = false;
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: state.imageBase64,
        roomType: state.roomType,
        style: state.style,
        size: state.size,
        customPrompt: $("customPrompt").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "生成失败");

    $("beforeImg").src = state.imageBase64;
    $("afterImg").src = data.imageBase64;
    $("downloadBtn").href = data.imageBase64;
    $("resultCard").hidden = false;
    $("leadCard").hidden = false;
    $("resultCard").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    alert("生成失败：" + e.message);
  } finally {
    $("overlay").hidden = true;
  }
});

// ---------- 换一个 ----------
$("againBtn").addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- 留资 ----------
$("leadBtn").addEventListener("click", async () => {
  const phone = $("leadPhone").value.trim();
  if (!/^\d{6,20}$/.test(phone)) {
    alert("请填写正确的手机号");
    return;
  }
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("leadName").value,
        phone,
        city: $("leadCity").value,
        style: state.style,
        roomType: state.roomType,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "提交失败");
    $("leadDone").hidden = false;
    $("leadBtn").disabled = true;
  } catch (e) {
    alert("提交失败：" + e.message);
  }
});

init();
