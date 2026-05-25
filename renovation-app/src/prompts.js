// 装修风格：中文 label -> 英文描述（图像模型用英文出图效果更稳定）
export const STYLES = {
  现代简约: "modern minimalist",
  北欧: "Scandinavian / Nordic",
  日式: "Japanese muji / wabi-sabi",
  新中式: "modern Chinese (new Chinese)",
  轻奢: "light luxury",
  奶油风: "cream / creamy soft",
  工业风: "industrial loft",
  美式: "American classic",
  法式: "French",
  原木风: "natural wood / Japandi",
};

// 房间类型：中文 label -> 英文
export const ROOMS = {
  客厅: "living room",
  卧室: "bedroom",
  厨房: "kitchen",
  卫生间: "bathroom",
  餐厅: "dining room",
  书房: "study room / home office",
  儿童房: "children's room",
  阳台: "balcony",
  玄关: "entryway / foyer",
  全屋: "whole apartment interior",
};

// 允许的出图尺寸（gpt-image-1 支持）
export const SIZES = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"]);

export function buildPrompt({ style, roomType, customPrompt }) {
  const styleEn = STYLES[style] || "modern minimalist";
  const roomEn = ROOMS[roomType] || "interior room";
  const extra = (customPrompt || "").trim();

  let prompt =
    `Transform this real ${roomEn} photo into a professional ${styleEn} interior design rendering. ` +
    `Keep the original architecture exactly: wall positions, window and door locations, ceiling height, ` +
    `and the overall room layout and camera angle must stay the same. ` +
    `Only redesign the interior: apply ${styleEn} style furniture, flooring, wall finishes, lighting, ` +
    `color palette, soft furnishings and decorations that fit the space realistically. ` +
    `Result should look photorealistic, clean, well-lit, high-end, magazine quality, ultra detailed, ` +
    `realistic materials and natural lighting.`;

  if (extra) {
    prompt += ` Additional requirements from the client: ${extra}.`;
  }
  return prompt;
}
