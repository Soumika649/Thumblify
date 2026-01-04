import axios from 'axios';

const hf = axios.create({
  baseURL: 'https://router.huggingface.co/hf-inference',
  headers: {
    Authorization: `Bearer ${process.env.HF_API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'image/png',
  },
  responseType: 'arraybuffer',
  timeout: 60000,
});

export default hf;
