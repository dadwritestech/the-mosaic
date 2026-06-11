export interface Warp { x: number; y: number; toMap: string; toX: number; toY: number; }
export interface Trigger { x: number; y: number; kind: 'gym' | 'shop' | 'center' | 'npc' | 'sign' | 'warden'; ref?: string; }

export interface MapV2 {
  id: string;
  width: number; height: number;
  tileset: string;
  autotiles: string[];
  layers: number[][][];    // [3][height][width] raw RMXP tile IDs
  passages: boolean[][];   // [height][width] true = walkable
  priorities: number[][];  // [height][width] draw-over-player flag
  warps: Warp[];
  triggers: Trigger[];
  encounters: boolean[][]; // [height][width] true = tall-grass cell
  spawn: { x: number; y: number };
}
