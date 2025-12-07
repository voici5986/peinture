import { GeneratedImage, AspectRatioOption, ModelOption } from "../types";

const ZIMAGE_BASE_API_URL = "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = "https://mcp-tools-qwen-image-fast.hf.space";
const UPSCALER_BASE_API_URL = "https://tuan2308-upscaler.hf.space";
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";

const getZImageDimensions = (ratio: AspectRatioOption, enableHD: boolean): { width: number; height: number } => {
  if (enableHD) {
    switch (ratio) {
      case "16:9":
        return { width: 2048, height: 1152 };
      case "4:3":
        return { width: 2048, height: 1536 };
      case "3:2":
        return { width: 1920, height: 1280 };
      case "9:16":
        return { width: 1152, height: 2048 };
      case "3:4":
        return { width: 1536, height: 2048 };
      case "2:3":
        return { width: 1280, height: 1920 };
      case "1:1":
      default:
        return { width: 2048, height: 2048 };
    }
  } else {
      switch (ratio) {
      case "16:9":
        return { width: 1280, height: 720 };
      case "4:3":
        return { width: 1024, height: 768 };
      case "3:2":
        return { width: 1536, height: 1024 };
      case "9:16":
        return { width: 720, height: 1280 };
      case "3:4":
        return { width: 768, height: 1024 };
      case "2:3":
        return { width: 1024, height: 1536 };
      case "1:1":
      default:
        return { width: 1024, height: 1024 };
    }
  }
};

const getAuthHeaders = (): Record<string, string> => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('huggingFaceToken') : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

function extractCompleteEventData(sseStream: string): any | null {
  const lines = sseStream.split('\n');
  let isCompleteEvent = false;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      if (line.substring(6).trim() === 'complete') {
        isCompleteEvent = true;
      } else if (line.substring(6).trim() === 'error') {
        isCompleteEvent = false;
        throw new Error("Your today's quota has been used up. You can set up Hugging Face Token to get more quota.")
      } else {
        isCompleteEvent = false; // Reset if it's another event type
      }
    } else if (line.startsWith('data:') && isCompleteEvent) {
      const jsonData = line.substring(5).trim();
      try {
        return JSON.parse(jsonData);
      } catch (e) {
        console.error("Error parsing JSON data:", e);
        return null;
      }
    }
  }
  return null; // No complete event with data found
}

const generateZImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed: number = Math.round(Math.random() * 2147483647),
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  let { width, height } = getZImageDimensions(aspectRatio, enableHD);

  try {
    const queue = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: [prompt, height, width, 8, seed, false]
      })
    })
    const { event_id } = await queue.json();
    const response = await fetch(ZIMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders()
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    return {
      id: crypto.randomUUID(),
      url: data[0].url,
      model: 'z-image-turbo',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: data[1]
    };
  } catch (error) {
    console.error("Z-Image Turbo Generation Error:", error);
    throw error;
  }
};

const generateQwenImage = async (
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number
): Promise<GeneratedImage> => {
  try {    
    const queue = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image', {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: [prompt, seed || 42, seed === undefined, aspectRatio, 3, 8]
      })
    })
    const { event_id } = await queue.json();
    const response = await fetch(QWEN_IMAGE_BASE_API_URL + '/gradio_api/call/generate_image/' + event_id, {
      headers: getAuthHeaders()
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    return {
      id: crypto.randomUUID(),
      url: data[0].url,
      model: 'qwen-image-fast',
      prompt,
      aspectRatio,
      timestamp: Date.now(),
      seed: parseInt(data[1].replace('Seed used for generation: ', ''))
    };
  } catch (error) {
    console.error("Qwen Image Fast Generation Error:", error);
    throw error;
  }
};

export const generateImage = async (
  model: ModelOption,
  prompt: string,
  aspectRatio: AspectRatioOption,
  seed?: number,
  enableHD: boolean = false
): Promise<GeneratedImage> => {
  if (model === 'qwen-image-fast') {
    return generateQwenImage(prompt, aspectRatio, seed);
  } else {
    return generateZImage(prompt, aspectRatio, seed, enableHD);
  }
};

export const upscaler = async (url: string): Promise<{ url: string }> => {
  try {    
    const queue = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan', {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: [{"path": url,"meta":{"_type":"gradio.FileData"}}, 'RealESRGAN_x4plus', 0.5, false, 4]
      })
    })
    const { event_id } = await queue.json();
    const response = await fetch(UPSCALER_BASE_API_URL + '/gradio_api/call/realesrgan/' + event_id, {
      headers: getAuthHeaders()
    });
    const result = await response.text();
    const data = extractCompleteEventData(result);

    return { url: data[0].url };
  } catch (error) {
    console.error("Upscaler Error:", error);
    throw error;
  }
};

export const optimizePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await fetch(POLLINATIONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai-fast',
        messages: [
          {
            role: 'system',
            content: `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks.
I will ensure the output text is in the same language as the user's prompts.`
          },
          {
            role: 'user',
            content: originalPrompt
          }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    return content || originalPrompt;
  } catch (error) {
    console.error("Prompt Optimization Error:", error);
    throw error;
  }
};