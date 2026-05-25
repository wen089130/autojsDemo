// 调用 OpenAI 图像编辑接口（image-to-image），把房间照片生成装修效果图。
// 使用 Node 原生 fetch / FormData / Blob，无需任何第三方依赖。

export async function generateRenovation({
  imageBuffer,
  mimeType,
  prompt,
  size = "1024x1024",
  model = "gpt-image-1",
  quality,
  apiKey,
  baseUrl = "https://api.openai.com/v1",
}) {
  if (!apiKey) {
    throw new Error("未配置 OPENAI_API_KEY，请在 .env 中填写后重启服务");
  }

  const ext =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";

  const form = new FormData();
  form.append("model", model);
  form.append("image", new Blob([imageBuffer], { type: mimeType }), `room.${ext}`);
  form.append("prompt", prompt);
  if (size) form.append("size", size);
  if (quality) form.append("quality", quality);

  const url = `${baseUrl.replace(/\/$/, "")}/images/edits`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI 返回了非 JSON 响应（${res.status}）：${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(`OpenAI 接口错误：${msg}`);
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI 未返回图片数据");
  }
  return b64;
}
