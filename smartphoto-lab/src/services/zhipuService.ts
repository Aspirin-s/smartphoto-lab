import { Photo } from "../types";

const ZHIPU_API_KEY = "10e8ecb1d6934864a0ad03ed907e7b37.8pzfF46df5MPiAAx";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/**
 * 调用智谱 API 的通用函数
 */
async function callZhipuAPI(messages: any[], responseFormat?: { type: string }) {
  const payload: any = {
    model: "glm-4v-flash",
    messages: messages,
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await fetch(ZHIPU_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ZHIPU_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`智谱 API 错误: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * 使用智谱 API 分析图片，生成标签和 EXIF 数据
 */
export const analyzeImageWithZhipu = async (
  base64Data: string,
  mimeType: string
): Promise<{ tags: string[]; description: string; detectedLocation?: string }> => {
  try {
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
            },
          },
          {
            type: "text",
            text: `分析这张图片。返回一个 JSON 对象，包含:
1. 'tags': 必须包含8-12个相关关键词数组（包括：人物特征、物体、动作、情绪、场景、颜色、风格、氛围等多个维度）。
2. 'description': 必须是20-30个字的详细描述，生动描述画面的主要内容、情感氛围和场景细节。
3. 'detectedLocation': 如果是著名地标，猜测位置；否则返回 'Unknown'。

注意：描述要丰富生动，标签要全面多样，严格返回 JSON 格式。`,
          },
        ],
      },
    ];

    const responseText = await callZhipuAPI(messages, { type: "json_object" });
    
    if (responseText) {
      return JSON.parse(responseText);
    }
    throw new Error("空响应");
  } catch (error) {
    console.error("智谱 API 分析错误:", error);
    return { 
      tags: ["分析失败"], 
      description: "无法分析图片。", 
      detectedLocation: "Unknown" 
    };
  }
};

/**
 * 使用智谱 API 进行智能照片搜索
 */
export const searchPhotosWithZhipu = async (
  query: string,
  photos: Photo[]
): Promise<{ matchedPhotoIds: string[]; reasoning: string }> => {
  if (photos.length === 0) {
    return { matchedPhotoIds: [], reasoning: "没有照片数据。" };
  }

  // 创建照片库的轻量级上下文
  const photoContext = photos.map((p) => ({
    id: p.id,
    tags: p.tags,
    description: p.description,
    date: new Date(p.timestamp).toLocaleDateString(),
  }));

  try {
    const messages = [
      {
        role: "user",
        content: `你是一个智能相册搜索助手。
用户查询: "${query}"

这是照片数据库:
${JSON.stringify(photoContext, null, 2)}

返回一个 JSON 对象，包含:
1. 'matchedPhotoIds': 与查询最匹配的照片 ID 字符串数组。
2. 'reasoning': 简短解释为什么选择这些照片。

严格返回 JSON 格式。`,
      },
    ];

    const responseText = await callZhipuAPI(messages, { type: "json_object" });
    
    if (responseText) {
      return JSON.parse(responseText);
    }
    return { matchedPhotoIds: [], reasoning: "未找到匹配结果。" };
  } catch (error) {
    console.error("智谱 API 搜索错误:", error);
    return { matchedPhotoIds: [], reasoning: "处理搜索时出错。" };
  }
};
