import { NitroModules } from 'react-native-nitro-modules';
import type { AudioManager } from './AudioManager.nitro';

const AudioManagerHybridObject =
  NitroModules.createHybridObject<AudioManager>('AudioManager');

export function multiply(a: number, b: number): number {
  return AudioManagerHybridObject.multiply(a, b);
}
