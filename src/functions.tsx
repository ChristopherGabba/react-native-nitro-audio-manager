import { NitroModules } from 'react-native-nitro-modules';
import type { AudioManager } from './AudioManager.nitro';
import {
  ActivationOptions,
  AudioManagerStatus,
  AudioSessionCategory,
  AudioSessionCompatibleCategoryOptions,
  AudioSessionCompatibleModes,
  DeactivationOptions,
  AudioSessionMode,
  AudioSessionRouteSharingPolicy,
  AudioSessionStatus,
  ConfigureAudioAndActivateParams,
  InterruptionEvent,
  ListenerEvent,
  ListenerType,
  PortDescription,
  RouteChangeEvent,
  AudioSessionWarning,
  EchoCancelledInputCompatibliteCategories,
} from './types';

import { Platform } from 'react-native';

export const AudioManagerHybridObject =
  NitroModules.createHybridObject<AudioManager>('AudioManager');

/**
 * Internal utility function to properly handle warnings from the native side.
 * @param warning AudioSessionWarning
 */
function processWarning(warning: AudioSessionWarning) {
  console.warn(`${warning.name}: ${warning.message}`);
}

/**
 * Returns the current system volume.
 * - **iOS:** a single number in the range [0–1].
 * - **Android:** the music stream volume in the range [0–1]
 */
export function getSystemVolume(): Promise<number> {
  return AudioManagerHybridObject.getSystemVolume();
}
/**
 * Sets the system volume to a specified value:
 * - **value**: a number in the range [0–1]
 * - **showUI**: *Android Only* if `true`, shows the system volume UI.
 *   Defaults to `true`. On ios, the UI always shows.
 *
 * @platform iOS, Android
 */
export function setSystemVolume(
  value: number,
  options: { showUI: boolean } = { showUI: true }
): Promise<void> {
  if (typeof value !== 'number')
    throw new Error('INVALID_PARAMETER: Set volume only accepts a number');

  let setpoint = value;

  if (value < 0) {
    console.warn('setSystemVolume received value < 0, clamping to 0.');
    setpoint = 0;
  } else if (value > 1) {
    console.warn('setSystemVolume received value > 1, clamping to 1.');
    setpoint = 1;
  }

  return AudioManagerHybridObject.setSystemVolume(setpoint, options.showUI);
}

// /**
//  * Sets the system volume to a specified value:
//  * - **value**: a number in the range [0–1]
//  */
// export function setSystemVolume(value: number): void {
//   return AudioManagerHybridObject.setSystemVolume(value);
// }

/**
 * Returns the current output latency in milliseconds.
 */
export function getOutputLatency(): number {
  return AudioManagerHybridObject.getOutputLatency();
}

/**
 * Returns the current input latency in milliseconds.
 */
export function getInputLatency(): number {
  return AudioManagerHybridObject.getInputLatency();
}

/**
 * @platform
 * **IOS** only
 * The active audio session category and mode determine the number of inputs this property returns.
 * For example, if the session’s category is playAndRecord, the array may contain a built-in microphone port and,
 * if connected, a headset microphone port. Alternatively, if the session’s category is playback, this property returns an empty array.
 */
export function getCategoryCompatibleInputs(): PortDescription[] | undefined {
  if (Platform.OS === 'ios') {
    return AudioManagerHybridObject.getCategoryCompatibleInputs();
  } else {
    return undefined;
  }
}

/**
 * Returns an array of the currently connected input routes.
 */
export function getCurrentInputRoutes(): PortDescription[] {
  return AudioManagerHybridObject.getCurrentInputRoutes();
}

/**
 * Returns an array of the current output routes.
 */
export function getCurrentOutputRoutes(): PortDescription[] {
  return AudioManagerHybridObject.getCurrentOutputRoutes();
}

/**
 * If your app uses the playAndRecord category, calling this method causes the system to route audio to the built-in speaker and microphone regardless of other settings.
 * This change remains in effect only until the current route changes or you call `cancelForcedOutputToSpeaker()`.
 * If you’d prefer to permanently enable this behavior, you should instead set the category’s defaultToSpeaker option. Setting this option routes to the speaker rather than the receiver if no other accessory such as headphones are in use.
 */
export function forceOutputToSpeaker(): void {
  return AudioManagerHybridObject.forceOutputToSpeaker(processWarning);
}

/**
 * Cancels the forced output to speaker after calling `forceOutputToSpeaker`.
 */
export function cancelForcedOutputToSpeaker(): void {
  return AudioManagerHybridObject.cancelForcedOutputToSpeaker();
}

/**
 * Activates the native audio session or focus on the requested platform(s).
 *
 * This can be a relatively heavy operation on iOS—if you notice UI lock up a little,
 * you may want to defer it via `setTimeout(() => activate(), 100)`.
 *
 * @param options.activationOptions.platform
 *   - `'ios'`: only calls the iOS AVAudioSession activation API.
 *   - `'android'`: only requests Android audio focus.
 *   - `'both'` (default): performs both the iOS activation and Android focus request.
 *
 * @platform iOS, Android
 * @returns {Promise<void>}
 *   - **iOS**: resolves when AVAudioSession activation completes, rejects on error.
 *   - **Android**: resolves immediately after requesting audio focus, rejects on error.
 */
export async function activate(options: ActivationOptions = {}): Promise<void> {
  const { platform = 'both' } = options;

  const skippingActivationForCurrentPlatform =
    (platform === 'ios' && Platform.OS !== 'ios') ||
    (platform === 'android' && Platform.OS !== 'android');

  if (skippingActivationForCurrentPlatform) return;

  return AudioManagerHybridObject.activate(processWarning);
}

/**
 * Deactivates the native audio session or abandons audio focus on the requested platform(s).
 *
 * @param options.platform
 *   - `'ios'`: only calls the iOS AVAudioSession deactivation API.
 *   - `'android'`: only abandons Android audio focus.
 *   - `'both'` (default): performs both the iOS deactivation and Android focus abandonment.
 *
 * @param options.restorePreviousSessionOnDeactivation
 *   If `true`, restores the previous audio session on iOS after deactivation (e.g. resumes background music).
 *   Defaults to `true`.
 *
 * @platform iOS, Android
 * @returns {Promise<void>}
 *   - **iOS**: resolves when AVAudioSession deactivation completes, rejects on error.
 *   - **Android**: resolves immediately after abandoning audio focus, rejects on error.
 *   - **Other platforms**: resolves immediately (no-op).
 */
export async function deactivate(
  options: DeactivationOptions = {}
): Promise<void> {
  const {
    platform = 'both',
    fallbackToAmbientCategoryAndLeaveActiveForVolumeListener = false,
    restorePreviousSessionOnDeactivation = true,
  } = options;

  const skippingDeactivationForCurrentPlatform =
    (platform === 'ios' && Platform.OS !== 'ios') ||
    (platform === 'android' && Platform.OS !== 'android');

  if (skippingDeactivationForCurrentPlatform) return;

  return AudioManagerHybridObject.deactivate(
    restorePreviousSessionOnDeactivation,
    fallbackToAmbientCategoryAndLeaveActiveForVolumeListener,
    processWarning
  );
}

type StatusResult = AudioSessionStatus | AudioManagerStatus | undefined;

/**
 * Retrieves the current AVAudioSession configuration details (category, mode, options, etc).
 * @platform ios
 * @returns {AudioSessionStatus} A promise that resolves with the audio session status.
 */
export function getAudioStatus(): StatusResult {
  if (Platform.OS === 'ios') {
    return AudioManagerHybridObject.getAudioSessionStatusIOS() as AudioSessionStatus;
  } else if (Platform.OS === 'android') {
    return AudioManagerHybridObject.getAudioManagerStatusAndroid() as AudioManagerStatus;
  }
  return undefined;
}

/**
 * Configure the platform‐specific audio session *and* immediately activate it.
 * On iOS this calls configureAudioSession(...) then activate().
 * On Android this calls configureAudioManager(...) then activate().
 */
export function configureAudio<
  T extends AudioSessionCategory,
  M extends AudioSessionCompatibleModes[T],
  N extends AudioSessionCompatibleCategoryOptions[T],
  O extends EchoCancelledInputCompatibliteCategories[T],
>(params: ConfigureAudioAndActivateParams<T, M, N, O>): void {
  if (params.ios) {
    const {
      category,
      mode,
      policy = AudioSessionRouteSharingPolicy.Default,
      categoryOptions = [],
      prefersNoInterruptionFromSystemAlerts = false,
      prefersInterruptionOnRouteDisconnect = false,
      allowHapticsAndSystemSoundsDuringRecording = false,
      prefersEchoCancelledInput = false,
    } = params.ios;

    // 1) configure iOS audio session
    AudioManagerHybridObject.configureAudioSession(
      category,
      (mode ?? AudioSessionMode.Default) as any,
      policy,
      categoryOptions,
      prefersNoInterruptionFromSystemAlerts,
      prefersInterruptionOnRouteDisconnect,
      allowHapticsAndSystemSoundsDuringRecording,
      prefersEchoCancelledInput,
      processWarning
    );
  }

  if (params.android) {
    const {
      focusGain,
      usage,
      contentType,
      willPauseWhenDucked,
      acceptsDelayedFocusGain,
    } = params.android;

    // 1) configure Android audio manager
    AudioManagerHybridObject.configureAudioManager(
      focusGain,
      usage,
      contentType,
      willPauseWhenDucked,
      acceptsDelayedFocusGain
    );
  }
  // other platforms: no-op
}
/**
 * Adds a strongly-typed listener and returns an unsubscribe function. Supported listener types:
 * - `audioInterruption`: triggered when the audio session is interrupted (e.g., incoming call).
 * - `routeChange`: triggered when the audio route changes (e.g., headphones plugged in/out).
 * - `volume`: triggered when the system volume changes. For ios, this takes control of the audio session and will not work if the audio session is not active.
 * This is useful for tracking volume changes in real-time.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const unsubscribe = addListener("audioInterruption", (event) => {
 *     console.log(event.type);
 *   });
 *
 *   return () => {
 *     unsubscribe();
 *   };
 * }, []);
 * ```
 */

export function addListener<T extends ListenerType>(
  type: T,
  listener: (event: ListenerEvent[T]) => void
): () => void {
  let listenerId: number;
  switch (type) {
    case 'audioInterruption':
      listenerId = AudioManagerHybridObject.addInterruptionListener(
        listener as (event: InterruptionEvent) => void
      );
      return () => {
        AudioManagerHybridObject.removeInterruptionListener(listenerId);
      };
    case 'routeChange':
      listenerId = AudioManagerHybridObject.addRouteChangeListener(
        listener as (event: RouteChangeEvent) => void
      );
      return () => {
        AudioManagerHybridObject.removeRouteChangeListener(listenerId);
      };
    case 'volume':
      listenerId = AudioManagerHybridObject.addVolumeListener(
        listener as (value: number) => void
      );
      return () => {
        AudioManagerHybridObject.removeVolumeListener(listenerId);
      };
    default:
      const _exhaustive: never = type;
      console.warn(`Unhandled listener type: ${_exhaustive}`);
      return () => {};
  }
}
