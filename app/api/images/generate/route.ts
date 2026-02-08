// app/api/images/generate/route.ts
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Keep only sizes supported by your SDK/model
const ALLOWED_SIZES = [
  "auto",
  "256x256",
  "512x512",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1792x1024",
  "1024x1792",
] as const;

type AllowedSize = (typeof ALLOWED_SIZES)[number];

type StylePreset = "kids_anime" | "kids_kawaii_sticker" | "kids_storybook";

function pickSize(v: any): AllowedSize {
  if (!v) return "1024x1024";
  const s = String(v);
  return (ALLOWED_SIZES as readonly string[]).includes(s) ? (s as AllowedSize) : "1024x1024";
}

function buildStyledPrompt(userPrompt: string, style: StylePreset) {
  const baseRules = `
Create a CHILD-FRIENDLY image for ages 5–12.
NO scary elements, NO violence, NO horror, NO weapons.
NO text, NO letters, NO numbers, NO watermark, NO logo.
Simple clean background, bright cheerful colors, high readability.
Single main subject centered, big and clear, cute proportions.
`;

  const styleBlock =
    style === "kids_kawaii_sticker"
      ? `
Art style: KAWAII ANIME STICKER.
Thick clean outline, soft cel-shading, glossy highlights, cute face if relevant.
Pastel + bright colors, toy-like shapes, high contrast, adorable.
`
      : style === "kids_storybook"
      ? `
Art style: children’s storybook illustration.
Soft painterly shading, warm lighting, gentle textures, friendly vibes.
`
      : `
Art style: ANIME (kid-friendly).
Clean lines, soft cel-shading, vibrant colors, cute look, not realistic.
`;

  // Final prompt: rules + style + the actual thing Muggy asked for
  return `${baseRules}\n${styleBlock}\nSubject:\n${userPrompt}\n`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      prompt?: string;
      size?: AllowedSize;
      style?: StylePreset;
    };

    const rawPrompt = String(body?.prompt || "").trim();
    if (!rawPrompt) {
      return Response.json({ ok: false, error: "Missing prompt" }, { status: 400 });
    }

    const size = pickSize(body?.size);
    const style: StylePreset = body?.style || "kids_anime";

    const prompt = buildStyledPrompt(rawPrompt, style);

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      n: 1,
    });

    const first = result.data?.[0];
    const b64 = (first as any)?.b64_json as string | undefined;
    const url = (first as any)?.url as string | undefined;

    if (b64) {
      return Response.json({
        ok: true,
        type: "b64_json",
        image: `data:image/png;base64,${b64}`,
      });
    }

    if (url) {
      return Response.json({
        ok: true,
        type: "url",
        image: url,
      });
    }

    return Response.json({ ok: false, error: "No image returned from OpenAI" }, { status: 502 });
  } catch (err: any) {
    return Response.json(
      {
        ok: false,
        error: err?.message || "Image generation failed",
      },
      { status: 500 }
    );
  }
}
