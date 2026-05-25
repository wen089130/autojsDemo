# AI 装修效果图 · 获客工具

上传房间照片 → 选房间类型和风格 → 调用 GPT 图像模型一键生成装修效果图，
看完效果图引导用户留下手机号，自动收集**装修意向客户线索**。

这是一个真正能获客的工具：用户为了看自己家的效果图会主动来用、主动分享，
你顺势就能拿到精准线索，比到处发广告有效得多。

## 功能

- 📷 手机拍照/选图，前端自动压缩（省流量、出图更快）
- 🎨 10 种风格（现代简约、北欧、日式、新中式、轻奢…）× 10 种房间类型
- ✨ 调用 OpenAI 图像编辑接口（`gpt-image-1`），保留原户型结构生成效果图
- 📞 出图后引导留资，线索自动存档，老板可凭口令查看
- 🔒 API Key 只在服务端，绝不暴露给前端
- 🧩 零第三方依赖，纯 Node 运行

## 快速开始

```bash
cd renovation-app
cp .env.example .env      # 然后编辑 .env 填入你的 OPENAI_API_KEY
npm start                  # 或 node server.js
```

打开 http://localhost:3000 即可使用。

> 还没有 API Key？把 `.env` 里的 `DEMO_MODE` 设为 `1`，或者直接 `DEMO_MODE=1 npm start`，
> 即可先体验完整界面流程（演示模式下直接回显原图，不真正出图）。

## 配置项（.env）

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI 密钥（必填，真正出图时） |
| `OPENAI_BASE_URL` | 接口地址，国内服务器可填兼容 OpenAI 的中转地址 |
| `OPENAI_IMAGE_MODEL` | 图像模型，默认 `gpt-image-1` |
| `OPENAI_IMAGE_QUALITY` | 出图质量 low/medium/high/auto |
| `BRAND_NAME` / `BRAND_CONTACT` | 你的品牌名和联系方式，显示在页面上 |
| `ADMIN_TOKEN` | 查看线索的口令 |
| `PORT` | 端口，默认 3000 |
| `DEMO_MODE` | 设为 1 进入演示模式 |

## 查看收集到的客户线索

浏览器访问：`http://你的地址:3000/api/leads?token=你设置的ADMIN_TOKEN`

返回所有留资客户（姓名、手机号、城市、想要的风格/房间），按时间倒序。
线索保存在 `data/leads.jsonl`（已加入 .gitignore，不会被提交）。

## 让客户用上它

1. 把服务部署到一台有公网的服务器（或用内网穿透）。
2. 生成网址二维码，放进你的抖音/小红书主页、私信、朋友圈。
3. 文案示例：「想看你家装修后长啥样？戳链接上传照片，AI 免费出效果图」。

## 关于"GPT image 2.0"

OpenAI 目前的图像模型官方名称是 `gpt-image-1`（即原生的 GPT 图像生成能力），
并没有叫"image 2.0"的型号。本项目默认用 `gpt-image-1`，如果以后出了新模型，
改 `.env` 里的 `OPENAI_IMAGE_MODEL` 即可。

几个常见注意点：
- `gpt-image-1` 需要 OpenAI 账号完成**组织验证**才能调用。
- 出图按张计费，建议先用 `OPENAI_IMAGE_QUALITY=medium` 控制成本。
- 国内服务器通常无法直连 OpenAI，需要配置 `OPENAI_BASE_URL` 走中转。

## 改造成微信小程序

后端无需改动，复用同一套 `/api/generate` 和 `/api/lead` 接口即可：

1. 小程序端用 `wx.chooseMedia` 选图，压缩后转 base64。
2. `wx.request` POST 到你的后端 `/api/generate`，拿到效果图展示。
3. 在小程序后台「开发管理 → 服务器域名」里把你的后端域名加入 request 合法域名（需 HTTPS）。
4. 留资同理调用 `/api/lead`。

也可以先用 webview 直接把这个网页嵌进小程序，最快上线。
