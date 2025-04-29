import type { HybridObject } from 'react-native-nitro-modules';
import type {
  AudioManagerStatus,
  AudioSessionStatus,
  AudioSessionWarning,
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
  getCategoryCompatibleInputs(): PortDescription[];
  getCurrentInputRoutes(): PortDescription[];
  getCurrentOutputRoutes(): PortDescription[];
  isWiredHeadphonesConnected(): boolean;
  isBluetoothHeadphonesConnected(): boolean;
  getSystemVolume(): Promise<number>;
  setSystemVolume(value: number, showUI: boolean): Promise<void>;
  activate(
    warningCallback: (warning: AudioSessionWarning) => void
  ): Promise<void>;
  deactivate(
    restorePreviousSessionOnDeactivation: boolean,
    fallbackToAmbientCategoryAndLeaveActiveForVolumeListener: boolean,
    warningCallback: (warning: AudioSessionWarning) => void
  ): Promise<void>;
  /**
   * IOS ONLY
   */

  isActive(): boolean;
  forceOutputToSpeaker(
    warningCallback: (warning: AudioSessionWarning) => void
  ): void;
  cancelForcedOutputToSpeaker(): void;
  addInterruptionListener(callback: (type: InterruptionEvent) => void): number;
  removeInterruptionListener(id: number): void;
  addRouteChangeListener(callback: (event: RouteChangeEvent) => void): number;
  removeRouteChangeListener(id: number): void;
  addVolumeListener(callback: (value: number) => void): number;
  removeVolumeListener(id: number): void;
  getAudioSessionStatusIOS(): AudioSessionStatus | undefined;
  configureAudioSession(
    category: string,
    mode: string,
    policy: string,
    categoryOptions: string[],
    prefersNoInterruptionFromSystemAlerts: boolean,
    prefersInterruptionOnRouteDisconnect: boolean,
    allowHapticsAndSystemSoundsDuringRecording: boolean,
    prefersEchoCancelledInput: boolean,
    warningCallback: (warning: AudioSessionWarning) => void
  ): void;
  /**
   * Android Only
   */
  getAudioManagerStatusAndroid(): AudioManagerStatus | undefined;
  configureAudioManager(
    focusGain: string,
    usage: string,
    contentType: string,
    willPauseWhenDucked: boolean,
    acceptsDelayedFocusGain: boolean
  ): void;
}
