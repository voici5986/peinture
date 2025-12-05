

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    aspectRatio: string;
    timestamp: number;
    model: string;
    seed?: number;
    duration?: number;
    isBlurred?: boolean;
}

export type AspectRatioOption = "1:1" | "3:2" | "2:3" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

export type ModelOption = "qwen-image-fast" | "z-image-turbo";

export interface GenerationParams {
    model: ModelOption;
    prompt: string;
    aspectRatio: AspectRatioOption;
    seed?: number;
}