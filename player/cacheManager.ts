import fs from 'fs';
import path from 'path';
import axios from 'axios';

export class CacheManager {
  private cacheDir: string;
  private videosDir: string;
  private imagesDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.videosDir = path.join(this.cacheDir, 'videos');
    this.imagesDir = path.join(this.cacheDir, 'images');
    this.ensureDirs();
  }

  private ensureDirs() {
    [this.cacheDir, this.videosDir, this.imagesDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  getLocalPath(mediaUrl: string): string {
    const filename = path.basename(mediaUrl);
    const isVideo = mediaUrl.includes('/videos/');
    return path.join(isVideo ? this.videosDir : this.imagesDir, filename);
  }

  async isCached(mediaUrl: string): Promise<boolean> {
    const localPath = this.getLocalPath(mediaUrl);
    return fs.existsSync(localPath);
  }

  async downloadMedia(mediaUrl: string, baseUrl: string, retries: number = 3): Promise<string> {
    const localPath = this.getLocalPath(mediaUrl);
    
    if (fs.existsSync(localPath)) {
      if (await this.validateIntegrity(localPath)) {
        return localPath;
      }
      console.log(`Corrupted file found at ${localPath}, redownloading...`);
      fs.unlinkSync(localPath);
    }

    const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${baseUrl}${mediaUrl}`;
    
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Downloading ${fullUrl} to ${localPath} (Attempt ${i + 1})...`);
        const response = await axios({
          url: fullUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 30000,
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        if (await this.validateIntegrity(localPath)) {
          return localPath;
        }
      } catch (e) {
        console.error(`Download error on attempt ${i + 1}:`, (e as any).message);
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
    throw new Error(`Failed to download ${fullUrl} after ${retries} attempts`);
  }

  async validateIntegrity(localPath: string): Promise<boolean> {
    // Simple check for now: exists and size > 0
    return fs.existsSync(localPath) && fs.statSync(localPath).size > 0;
  }
}
