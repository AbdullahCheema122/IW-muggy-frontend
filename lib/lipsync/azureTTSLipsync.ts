// lib/lipsync/azureTTSLipsync.ts

import { VisemeData } from '../types';
import { useAzureVisemeStore } from '../azureVisemeStore';

export function processAzureVisemeStream(visemePacket: any) {
  const visemeId = visemePacket?.visemeId;
  const start = visemePacket?.audioOffset / 10000; // Convert to ms
  const blend = convertIdToBlendshape(visemeId);

  if (blend) {
    useAzureVisemeStore.getState().addViseme({
      time: start,
      blend,
    });
  }
}

function convertIdToBlendshape(visemeId: number): VisemeData['blend'] | null {
  // Azure viseme IDs mapped to ARKit blendshapes
  const visemeMap: Record<number, VisemeData['blend']> = {
    0: { 'viseme_sil': 1 },
    1: { 'viseme_aa': 1 },
    2: { 'viseme_ih': 1 },
    3: { 'viseme_oh': 1 },
    4: { 'viseme_e': 1 },
    5: { 'viseme_ou': 1 },
    6: { 'viseme_bm': 1 },
    7: { 'viseme_dt': 1 },
    8: { 'viseme_h': 1 },
    9: { 'viseme_n': 1 },
    10: { 'viseme_r': 1 },
    11: { 'viseme_s': 1 },
    12: { 'viseme_th': 1 },
  };
  return visemeMap[visemeId] || null;
}
