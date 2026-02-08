import { parseAzureBlendShapes } from './lipsync/azureBlendshapeReceiver';

export async function playAzureBlendshapeLipsync(
  jsonStr: string,
  applyBlendshapeFn: (frame: number[]) => void,
  frameDelayMs = 16 // ~60fps
) {
  const parsed = parseAzureBlendShapes(jsonStr);
  if (!parsed) return;

  for (const frame of parsed.BlendShapes) {
    applyBlendshapeFn(frame);
    await new Promise((res) => setTimeout(res, frameDelayMs));
  }
}