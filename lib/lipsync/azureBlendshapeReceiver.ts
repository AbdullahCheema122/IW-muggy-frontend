// lib/lipsync/azureBlendshapeReceiver.ts
export type AzureBlendShapeFrame = number[];

export interface AzureBlendshapePayload {
  FrameIndex: number;
  BlendShapes: AzureBlendShapeFrame[];
}

export function parseAzureBlendShapes(jsonStr: string): AzureBlendshapePayload | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.BlendShapes)) {
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse Azure viseme blendshape JSON:', e);
  }
  return null;
}
