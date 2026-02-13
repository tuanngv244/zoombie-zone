import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { COLORS } from '../config/clientConfig';

/**
 * Gradually darkens the scene as waves progress to create atmospheric tension.
 */
export class DayNightCycle {
  private sceneManager: SceneManager;
  private currentProgress = 0; // 0 = wave 1, 1 = final wave

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
  }

  setWaveProgress(currentWave: number, totalWaves: number): void {
    this.currentProgress = totalWaves > 1
      ? Math.max(0, (currentWave - 1) / (totalWaves - 1))
      : 0;
  }

  update(): void {
    const t = this.currentProgress;

    // Ambient light: dims from 0.4 to 0.15
    const ambient = this.sceneManager.getAmbientLight();
    if (ambient) {
      ambient.intensity = THREE.MathUtils.lerp(0.4, 0.15, t);
      // Shift color slightly cooler
      const r = THREE.MathUtils.lerp(0.23, 0.1, t);
      const g = THREE.MathUtils.lerp(0.13, 0.06, t);
      const b = THREE.MathUtils.lerp(0.06, 0.08, t);
      ambient.color.setRGB(r, g, b);
    }

    // Directional light: dims and shifts bluer
    const dir = this.sceneManager.getDirectionalLight();
    if (dir) {
      dir.intensity = THREE.MathUtils.lerp(0.6, 0.25, t);
      const r = THREE.MathUtils.lerp(0.67, 0.4, t);
      const g = THREE.MathUtils.lerp(0.73, 0.45, t);
      const b = THREE.MathUtils.lerp(0.87, 0.7, t);
      dir.color.setRGB(r, g, b);
    }

    // Fog: gets closer
    const scene = this.sceneManager.getScene();
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = THREE.MathUtils.lerp(20, 10, t);
      scene.fog.far = THREE.MathUtils.lerp(80, 45, t);
    }
  }
}
