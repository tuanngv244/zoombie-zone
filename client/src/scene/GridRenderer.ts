import * as THREE from 'three';
import { GRID, COLORS, CASTLE_ORIGIN, getBuildingDef } from '../config/clientConfig';

/**
 * Renders the 40x40 grid, castle zone highlight, hover tile, and placement preview.
 */
export class GridRenderer {
  private group: THREE.Group;
  private hoverMesh: THREE.Mesh | null = null;
  private previewMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'grid';
    scene.add(this.group);
    this.buildGrid();
    this.buildCastleZone();
  }

  private buildGrid(): void {
    const material = new THREE.LineDashedMaterial({
      color: COLORS.gridLine,
      transparent: true,
      opacity: 0.85,
      dashSize: 0.3,
      gapSize: 0.15,
    });

    // Horizontal lines (along X axis) — extended grid for infinite appearance
    for (let y = -80; y <= 120; y++) {
      const points = [
        new THREE.Vector3(-80, 0.01, y),
        new THREE.Vector3(120, 0.01, y),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, material);
      line.computeLineDistances();
      this.group.add(line);
    }

    // Vertical lines (along Z axis) — extended grid for infinite appearance
    for (let x = -80; x <= 120; x++) {
      const points = [
        new THREE.Vector3(x, 0.01, -80),
        new THREE.Vector3(x, 0.01, 120),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, material);
      line.computeLineDistances();
      this.group.add(line);
    }
  }

  private buildCastleZone(): void {
    const size = GRID.castleSize;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.castleZone,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      CASTLE_ORIGIN.x + size / 2,
      0.02,
      CASTLE_ORIGIN.y + size / 2,
    );
    this.group.add(mesh);
  }

  setHoverTile(x: number, y: number, valid: boolean): void {
    if (!this.hoverMesh) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.hoverMesh = new THREE.Mesh(geo, mat);
      this.hoverMesh.rotation.x = -Math.PI / 2;
      this.group.add(this.hoverMesh);
    }
    const mat = this.hoverMesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(valid ? COLORS.gridHoverValid : COLORS.gridHoverInvalid);
    this.hoverMesh.position.set(x + 0.5, 0.03, y + 0.5);
    this.hoverMesh.visible = true;
  }

  clearHover(): void {
    if (this.hoverMesh) {
      this.hoverMesh.visible = false;
    }
  }

  showPlacementPreview(type: string, x: number, y: number, valid: boolean): void {
    const def = getBuildingDef(type);
    if (!def) return;
    const w = def.gridWidth;
    const h = def.gridHeight;

    if (!this.previewMesh) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.previewMesh = new THREE.Mesh(geo, mat);
      this.previewMesh.rotation.x = -Math.PI / 2;
      this.group.add(this.previewMesh);
    }

    this.previewMesh.scale.set(w, h, 1);
    const mat = this.previewMesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(valid ? COLORS.gridHoverValid : COLORS.gridHoverInvalid);
    this.previewMesh.position.set(x + w / 2, 0.03, y + h / 2);
    this.previewMesh.visible = true;
  }

  hidePlacementPreview(): void {
    if (this.previewMesh) {
      this.previewMesh.visible = false;
    }
  }

  getObject(): THREE.Group {
    return this.group;
  }
}
