export const MJ_AZURE_MORPH_MAP = {
  // Silence
  viseme_sil: [],

  // Open vowels
  viseme_aa: ["Mouth_Open", "Open", "Mouth_Lips_Part"],
  viseme_ah: ["Mouth_Open", "Open"],
  viseme_ao: ["Tight_O", "Mouth_Pucker_Open"],

  // Rounded vowels
  viseme_oh: ["Tight_O", "Mouth_Pucker"],
  viseme_oo: ["Mouth_Pucker", "Mouth_Lips_Tight"],

  // Wide vowels
  viseme_ee: ["Wide", "Mouth_Widen"],
  viseme_ih: ["Wide", "Lip_Open"],

  // Plosives (B, P, M)
  viseme_bmp: ["Mouth_Plosive", "Mouth_Lips_Tight"],

  // Teeth + lip
  viseme_fv: ["Dental_Lip", "Mouth_Lips_Tuck"],

  // Tongue + teeth
  viseme_th: ["Dental_Lip"],

  // Alveolar
  viseme_dd: ["Mouth_Open", "Lip_Open"],
  viseme_nn: ["Mouth_Open"],
  viseme_ss: ["Wide"],

  // Back consonants
  viseme_kk: ["Open", "Mouth_Open"],

  // Affricates
  viseme_ch: ["Affricate", "Mouth_Open"],
  viseme_jj: ["Affricate", "Mouth_Open"],

  // Default fallback
  viseme_default: ["Mouth_Open"],
};
