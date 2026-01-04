import { Request, Response } from 'express';
import Thumbnail from '../models/Thumbnail.js';
import hf from '../configs/huggingface.js';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { createCanvas, registerFont } from 'canvas';

// ─── Style Prompts ────────────────────────────────────────────────────────────
const stylePrompts: Record<string, string> = {
  'Bold & Graphic':
    'eye-catching YouTube thumbnail, bold composition, vibrant colors, expressive facial reaction, dramatic cinematic lighting, high contrast, ultra-sharp details, professional photography',
  'Tech/Futuristic':
    'futuristic YouTube thumbnail, sleek modern design, digital UI elements, glowing neon accents, cyber-tech aesthetic, dark background, holographic effects',
  'Minimalist':
    'minimalist YouTube thumbnail, clean layout, simple bold shapes, limited color palette, generous negative space, flat design',
  'Photorealistic':
    'photorealistic YouTube thumbnail, ultra-realistic DSLR photography, shallow depth of field, studio lighting, 8k resolution, hyperrealistic',
  'Illustrated':
    'digital illustration YouTube thumbnail, bold cartoon style, thick outlines, vibrant flat colors, professional digital art',
};

// ─── Color Scheme Descriptions ────────────────────────────────────────────────
const colorSchemeDescriptions: Record<string, string> = {
  vibrant: 'vibrant high saturation colors, electric blue, hot pink, bright yellow',
  sunset: 'warm sunset tones, deep orange, coral pink, golden purple gradient',
  forest: 'natural green earthy tones, dark green, brown, warm beige',
  neon: 'neon blue and pink glow, electric purple, dark background',
  purple: 'rich purple and magenta tones, violet gradient',
  monochrome: 'black and white high contrast, deep shadows, bright highlights',
  ocean: 'cool blue and teal tones, aqua, deep navy, cyan',
  pastel: 'soft pastel colors, light pink, baby blue, lavender, mint',
};

// ─── Font Map per Style ───────────────────────────────────────────────────────
const fontMap: Record<string, { font: string; size: number; weight: string }> = {
  'Bold & Graphic':   { font: 'Impact',          size: 88,  weight: 'bold' },
  'Tech/Futuristic':  { font: 'Courier New',      size: 72,  weight: 'bold' },
  'Minimalist':       { font: 'Arial',            size: 64,  weight: 'normal' },
  'Photorealistic':   { font: 'Georgia',          size: 76,  weight: 'bold' },
  'Illustrated':      { font: 'Arial Rounded MT Bold', size: 80, weight: 'bold' },
};

// ─── Add Text Overlay to Image ───────────────────────────────────────────────
async function addTextOverlay(
  imageBuffer: Buffer,
  title: string,
  style: string
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const meta = await image.metadata();
  const width = meta.width || 1280;
  const height = meta.height || 720;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const fontConfig = fontMap[style] || { font: 'Impact', size: 80, weight: 'bold' };
  const fontSize = fontConfig.size;

  ctx.font = `${fontConfig.weight} ${fontSize}px "${fontConfig.font}"`;
  ctx.textAlign = 'center';

  // ── Word wrap ──
  const maxWidth = width * 0.88;
  const words = title.toUpperCase().split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  // ── Draw semi-transparent dark bar behind text ──
  const lineHeight = fontSize + 16;
  const blockHeight = lines.length * lineHeight + 32;
  const blockY = height - blockHeight - 24;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  const barPadding = 32;
  const barX = width * 0.06;
  const barW = width * 0.88;
  roundRect(ctx, barX, blockY - 8, barW, blockHeight + 16, 12);
  ctx.fill();

  // ── Draw text ──
  for (let i = 0; i < lines.length; i++) {
    const y = blockY + (i + 1) * lineHeight;

    // Shadow / stroke
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.95)';
    ctx.lineWidth = 8;
    ctx.strokeText(lines[i], width / 2, y);

    // Main fill
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(lines[i], width / 2, y);
  }

  // ── Composite onto original image ──
  const textBuffer = canvas.toBuffer('image/png');
  return sharp(imageBuffer)
    .composite([{ input: textBuffer, blend: 'over' }])
    .png()
    .toBuffer();
}

// ─── Rounded rect helper ──────────────────────────────────────────────────────
function roundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ─── Generate Thumbnail ───────────────────────────────────────────────────────
export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
    } = req.body;

    // Create DB record immediately
    const thumbnail = await Thumbnail.create({
      userId,
      title,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      isGenerating: true,
    });

    // ── Build image generation prompt ──
    const styleDesc = stylePrompts[style as string] || stylePrompts['Bold & Graphic'];
    const colorDesc =
      colorSchemeDescriptions[color_scheme as string] ||
      colorSchemeDescriptions['vibrant'];

    const prompt = [
      `Ultra high quality YouTube thumbnail background image.`,
      `Topic: ${title}.`,
      styleDesc,
      colorDesc,
      user_prompt ? `Scene details: ${user_prompt}.` : '',
      `Single clear focal subject, dramatic cinematic lighting, professional composition,`,
      `bold colors, no clutter, clean background, viral high CTR style.`,
      `DO NOT include any text, letters, words, captions, watermarks, or logos.`,
    ]
      .filter(Boolean)
      .join(' ');

    const negativePrompt = [
      'text', 'letters', 'words', 'caption', 'title', 'heading',
      'watermark', 'logo', 'signature', 'blurry', 'low quality',
      'low resolution', 'ugly', 'distorted face', 'multiple faces',
      'cluttered background', 'oversaturated', 'noise', 'grain',
    ].join(', ');

    // ── Call Hugging Face — FLUX.1-schnell (fast & high quality) ──
    const response = await hf.post(
      '/models/black-forest-labs/FLUX.1-schnell',
      {
        inputs: prompt,
        parameters: {
          num_inference_steps: 4,   // FLUX only needs 4 steps
          width: 1280,
          height: 720,
          negative_prompt: negativePrompt,
        },
      }
    );

    // ── Save raw image ──
    const rawImageBuffer = Buffer.from(response.data);

    // ── Add text overlay ──
    const finalImageBuffer = await addTextOverlay(rawImageBuffer, title, style);

    // ── Write to disk ──
    const filename = `thumbnail-${Date.now()}.png`;
    const filePath = path.join('images', filename);
    fs.mkdirSync('images', { recursive: true });
    fs.writeFileSync(filePath, finalImageBuffer);

    // ── Upload to Cloudinary ──
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: 'image',
      folder: 'thumbnails',
    });

    // ── Update DB record ──
    thumbnail.image_url = uploadResult.secure_url;
    thumbnail.prompt_used = prompt;
    thumbnail.isGenerating = false;
    await thumbnail.save();

    // ── Cleanup local file ──
    fs.unlinkSync(filePath);

    res.json({
      message: 'Thumbnail generated successfully',
      thumbnail,
    });
  } catch (error: any) {
    console.error('generateThumbnail error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Delete Thumbnail ─────────────────────────────────────────────────────────
export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    const deleted = await Thumbnail.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return res.status(404).json({ message: 'Thumbnail not found' });
    }

    res.json({ message: 'Thumbnail deleted successfully' });
  } catch (error: any) {
    console.error('deleteThumbnail error:', error);
    res.status(500).json({ message: error.message });
  }
};