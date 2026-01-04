import { Request, Response } from 'express';
import Thumbnail from '../models/Thumbnail.js';
import hf from '../configs/huggingface.js';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const stylePrompts = {
  'Bold & Graphic':
    'eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition',
  'Tech/Futuristic':
    'futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, cyber-tech aesthetic',
  'Minimalist':
    'minimalist thumbnail, clean layout, simple shapes, limited color palette, negative space',
  'Photorealistic':
    'photorealistic thumbnail, ultra-realistic lighting, DSLR photography, shallow depth of field',
  'Illustrated':
    'digital illustration, cartoon style, bold outlines, vibrant colors',
};

const colorSchemeDescriptions = {
  vibrant: 'vibrant high saturation colors',
  sunset: 'warm sunset tones, orange pink purple',
  forest: 'natural green earthy tones',
  neon: 'neon blue and pink glow',
  purple: 'purple and magenta tones',
  monochrome: 'black and white high contrast',
  ocean: 'cool blue and teal tones',
  pastel: 'soft pastel colors',
};

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session;
    const { title, prompt: user_prompt, style, aspect_ratio, color_scheme } =
      req.body;

    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      isGenerating: true,
    });

    /*// 🧠 Build prompt
    let prompt = `YouTube thumbnail for "${title}". `;
    prompt += stylePrompts[style as keyof typeof stylePrompts] || '';
    prompt += '. ';

    if (color_scheme) {
      prompt += `Color scheme: ${
        colorSchemeDescriptions[
          color_scheme as keyof typeof colorSchemeDescriptions
        ]
      }. `;
    }

    if (user_prompt) {
      prompt += `Additional details: ${user_prompt}. `;
    }

    prompt +=
      'Highly clickable, professional, bold composition, optimized for YouTube CTR.';*/
            // 🧠 Build thumbnail-optimized prompt (BACKGROUND ONLY)
    const prompt = `
    Ultra high quality YouTube thumbnail background image.

    Topic: "${title}"

    Composition rules:
    - Large empty space on one side for text overlay
    - Single clear subject only
    - One human face OR one symbolic object related to topic
    - Strong emotion, exaggerated facial expression
    - Cinematic lighting, dramatic shadows
    - High contrast, bold colors
    - Clean background, no clutter

    Style:
    ${stylePrompts[style as keyof typeof stylePrompts]}

    Color palette:
    ${colorSchemeDescriptions[color_scheme as keyof typeof colorSchemeDescriptions]}

    Extra details:
    ${user_prompt || 'None'}

    Important rules (must follow):
    - DO NOT include any text
    - DO NOT include letters or numbers
    - NO captions, NO logos, NO watermarks
    - Background image only
    - YouTube thumbnail composition
    - 16:9 aspect ratio
    - Viral, high CTR style
    `;


    // 🎨 Generate image with Stable Diffusion
    /*const response = await hf.post(
       '/models/stabilityai/stable-diffusion-xl-base-1.0',

      {
        inputs: prompt,
        parameters: {
             guidance_scale: 7.5,
          num_inference_steps: 30,
        },
      }
    );*/
    const response = await hf.post(
    '/models/stabilityai/stable-diffusion-xl-base-1.0',
    {
        inputs: prompt,
        parameters: {
        guidance_scale: 8,
        num_inference_steps: 35,
        width: 1280,
        height: 720,
        negative_prompt: `
            text,
            letters,
            words,
            captions,
            logo,
            watermark,
            signature,
            blurry,
            low quality,
            distorted face,
            multiple faces,
            cluttered background
        `,
        },
    }
    );


    // 📁 Save image
    const filename = `thumbnail-${Date.now()}.png`;
    const filePath = path.join('images', filename);

    fs.mkdirSync('images', { recursive: true });
    //fs.writeFileSync(filePath, Buffer.from(response.data));
    //const imageBuffer = Buffer.from(await response.data.arrayBuffer());
    const imageBuffer = Buffer.from(response.data);
    fs.writeFileSync(filePath, imageBuffer);


    // ☁️ Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: 'image',
    });

    thumbnail.image_url = uploadResult.secure_url;
    thumbnail.isGenerating = false;
    await thumbnail.save();

    fs.unlinkSync(filePath);

    res.json({
      message: 'Thumbnail generated successfully',
      thumbnail,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete thumbnail
export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session;

    const deleted = await Thumbnail.findOneAndDelete({ _id: id, userId });

    if (!deleted) {
      return res.status(404).json({ message: "Thumbnail not found" });
    }

    res.json({ message: "Thumbnail deleted successfully" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
