import type { ScratchBlocks } from './blocks';
import type { ScratchBroadcasts } from './broadcasts';
import type { ScratchComments } from './comments';
import type { ScratchCostume } from './costume';
import type { ScratchLists, ScratchVariables } from './data';
import type { ScratchSound } from './sound';

/**
 * A Scratch target is either the stage or a sprite.
 */
export type ScratchTarget = ScratchStage | ScratchSprite;

/**
 * Stage target data.
 */
export interface ScratchStage {
  isStage: true;
  name: string;
  variables: ScratchVariables;
  lists: ScratchLists;
  broadcasts: ScratchBroadcasts;
  blocks: ScratchBlocks;
  comments: ScratchComments;
  currentCostume: number;
  costumes: ScratchCostume[];
  sounds: ScratchSound[];
  volume: number;
  layerOrder?: number;
  tempo?: number;
  videoTransparency?: number;
  videoState?: 'on' | 'off' | 'on-flipped';
  textToSpeechLanguage?: string | null;
}

/**
 * Sprite target data.
 */
export interface ScratchSprite {
  isStage: false;
  name: string;
  variables: ScratchVariables;
  lists: ScratchLists;
  broadcasts: ScratchBroadcasts;
  blocks: ScratchBlocks;
  comments: ScratchComments;
  currentCostume: number;
  costumes: ScratchCostume[];
  sounds: ScratchSound[];
  volume: number;
  layerOrder: number;
  visible: boolean;
  x: number;
  y: number;
  size: number;
  direction: number;
  draggable: boolean;
  rotationStyle: 'all around' | 'left-right' | "don't rotate";
  tempo?: number;
  videoTransparency?: number;
  videoState?: 'on' | 'off' | 'on-flipped';
  textToSpeechLanguage?: string | null;
}
