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
  activateIOS(): Promise<void>;
  deactivateIOS(restorePreviousSessionOnDeactivation: boolean): Promise<void>;
  forceOutputToSpeaker(): void;
  cancelForcedOutputToSpeaker(): void;
  addInterruptionListener(callback: (type: InterruptionEvent) => void): number;
  removeInterruptionListeners(id: number): void;
  addRouteChangeListener(callback: (event: RouteChangeEvent) => void): number;
  removeRouteChangeListeners(id: number): void;
  getAudioSessionStatusIOS(): AudioSessionStatus | undefined;
  configureAudioSession(
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
  activateAndroid(): Promise<void>;
  deactivateAndroid(): Promise<void>;
  getAudioManagerStatusAndroid(): AudioManagerStatus | undefined;
  configureAudioManager(
    focusGain: string,
    usage: string,
    contentType: string,
    willPauseWhenDucked: boolean,
    acceptsDelayedFocusGain: boolean
  ): void;
}
