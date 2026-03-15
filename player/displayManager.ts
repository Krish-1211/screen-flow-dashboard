import { execSync } from 'child_process';

export interface Display {
  id: string;
  name: string;
  resolution: { width: number; height: number };
  position: { x: number; y: number };
}

export class DisplayManager {
  async getDisplays(): Promise<Display[]> {
    try {
      if (process.platform === 'darwin') {
        const output = execSync('system_profiler SPDisplaysDataType').toString();
        // Simple regex to find resolutions
        // This is a bit hacky, normally one would use a library like 'screen-info'
        const resolutions = output.match(/Resolution: (\d+) x (\d+)/g);
        if (resolutions) {
          return resolutions.map((res, index) => {
            const [w, h] = res.replace('Resolution: ', '').split(' x ').map(Number);
            return {
              id: `display-${index}`,
              name: `Display ${index + 1}`,
              resolution: { width: w, height: h },
              position: { x: index * w, y: 0 } // Assuming horizontal layout for now
            };
          });
        }
      }
    } catch (e) {
      console.error('Error detecting displays:', e);
    }

    // Default fallback
    return [{
      id: 'default',
      name: 'Default Display',
      resolution: { width: 1920, height: 1080 },
      position: { x: 0, y: 0 }
    }];
  }

  getCombinedResolution(displays: Display[]) {
    const totalWidth = displays.reduce((sum, d) => sum + d.resolution.width, 0);
    const maxHeight = Math.max(...displays.map(d => d.resolution.height));
    return { width: totalWidth, height: maxHeight };
  }
}
