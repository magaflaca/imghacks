export const DEFAULT_NEGATIVE =
  'malformation, bad anatomy, bad hands, missing fingers, cropped, low quality, bad quality, jpeg artifacts, watermark';

export const STYLES = {
  none: { name: 'Libre' },
  photo: { name: 'Fotografia', suffix: ', professional photograph, natural lighting, sharp focus, highly detailed, 50mm' },
  '90s-photo': { name: 'Foto de los 90', suffix: ', 90s home video, nostalgic 90s photo, taken with kodak disposable camera' },
  '80s-photo': {
    name: 'Foto de los 80',
    prefix: 'famous vintage 80s photo, ',
    suffix:
      ', grainy photograph, 80s photo with film grain, Kodacolor II 80s photo with vignetting, retro, r/OldSchoolCool, 80s photo with wear and tear and minor creasing and scratches, vintage color photo',
  },
  anime: { name: 'Anime', suffix: ', anime style, clean line art, cel shading, vibrant colors, key visual', negative: 'photo, realistic, 3d' },
  painting: { name: 'Pintura', suffix: ', oil painting, visible brush strokes, rich colors, masterpiece, fine art' },
  'pixel-art': { name: 'Pixel art', suffix: ', pixel art, 16-bit, crisp pixels, limited palette, retro game sprite style', negative: 'blurry, smooth, photo' },
  cinematic: { name: 'Cinematico', suffix: ', cinematic still, dramatic lighting, shallow depth of field, film grain, anamorphic' },
};

export const RESOLUTIONS = {
  '1:1': '512x512',
  '3:4': '512x768',
  '4:3': '768x512',
  '9:16': '512x768',
  '16:9': '768x512',
};

export function composePrompt({ prompt, style, negative }) {
  const { prefix = '', suffix = '', negative: styleNegative } = STYLES[style] ?? STYLES.none;
  return {
    prompt: `${prefix}${prompt}${suffix}`,
    negativePrompt: [styleNegative, negative, DEFAULT_NEGATIVE].filter(Boolean).join(', '),
  };
}
