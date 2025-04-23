import type { HybridObject } from 'react-native-nitro-modules';
import type {
  AudioManagerStatus,
  AudioSessionStatus,
  InterruptionEvent,
  PortDescription,
  RouteChangeEvent,
} from './types';

export interface AudioManager
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * BOTH PLATFORMS
   */

  activate(): Promise<void>;
  deactivate(restorePreviousSessionOnDeactivation: boolean): Promise<void>;
  getOutputLatency(): number;
  getInputLatency(): number;
  getAvailableInputs(): PortDescription[];
  getCurrentInputRoutes(): PortDescription[];
  getCurrentOutputRoutes(): PortDescription[];
  isWiredHeadphonesConnected(): boolean;
  isBluetoothHeadphonesConnected(): boolean;
  getSystemVolume(): number;
  /**
   * IOS ONLY
   */
  forceOutputToSpeaker(): void;
  cancelForcedOutputToSpeaker(): void;
  addInterruptionListener(callback: (type: InterruptionEvent) => void): number;
  removeInterruptionListeners(id: number): void;
  addRouteChangeListener(callback: (event: RouteChangeEvent) => void): number;
  removeRouteChangeListeners(id: number): void;
  getAudioSessionStatusIOS(): AudioSessionStatus | undefined;
  configureAudioSessionIOS(
    category: string,
    mode: string,
    policy: string,
    categoryOptions: string[],
    prefersNoInterruptionFromSystemAlerts: boolean,
    prefersInterruptionOnRouteDisconnect: boolean,
    allowHapticsAndSystemSoundsDuringRecording: boolean,
    prefersEchoCancelledInput: boolean
  ): void;
  /**
   * Android Only
   */
  getAudioManagerStatusAndroid(): AudioManagerStatus | undefined;
}
