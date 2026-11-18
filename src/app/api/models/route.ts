import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchProviderModels } from "@/core/engine/model-discovery";

const RequestSchema = z.object({
  provider: z.enum(["google", "openai", "anthropic", "deepseek", "custom"]),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "模型检索参数无效，请检查 Provider 与 Base URL 格式。" },
        { status: 400 }
      );
    }

    const models = await fetchProviderModels(parsed.data);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "检索可用模型失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
