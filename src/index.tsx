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
  HeadphonesConnectedResult,
  InterruptionEvent,
  ListenerEvent,
  ListenerType,
  PortDescription,
  RouteChangeEvent,
} from './types';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

export * from './types';

// const warnOnWeb = () => {
//   console.warn('This function is not compatibile on web');
// };

const AudioManagerHybridObject =
  NitroModules.createHybridObject<AudioManager>('AudioManager');

/**
 * Returns the current system volume:
 * - **iOS:** a single number in the range [0–1]
 * - **Android:** the music stream volume in the range [0–1]
 * - **other platforms:** `undefined`
 */
export function getSystemVolume(): number {
  return AudioManagerHybridObject.getSystemVolume();
}

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
  return AudioManagerHybridObject.forceOutputToSpeaker();
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
 * This can be a relatively heavy operation on iOS—if you notice UI jank,
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
 *   - **Other platforms**: resolves immediately (no-op).
 */
export async function activate(options: ActivationOptions = {}): Promise<void> {
  const { platform = 'both' } = options;

  if (platform === 'ios') {
    return AudioManagerHybridObject.activateIOS();
  } else if (platform === 'android') {
    return AudioManagerHybridObject.activateAndroid();
  } else {
    // both
    await Promise.all([
      AudioManagerHybridObject.activateIOS().catch((e) => {
        // if one fails, we still want the other to run; then rethrow
        throw e;
      }),
      AudioManagerHybridObject.activateAndroid().catch((e) => {
        throw e;
      }),
    ]);
  }
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
  const { platform = 'both', restorePreviousSessionOnDeactivation = true } =
    options;

  if (platform === 'ios') {
    return AudioManagerHybridObject.deactivateIOS(
      restorePreviousSessionOnDeactivation
    );
  } else if (platform === 'android') {
    return AudioManagerHybridObject.deactivateAndroid();
  } else {
    await Promise.all([
      AudioManagerHybridObject.deactivateIOS(
        restorePreviousSessionOnDeactivation
      ),
      AudioManagerHybridObject.deactivateAndroid(),
    ]);
  }
}

type StatusResult = AudioSessionStatus | AudioManagerStatus | undefined;

/**
 * Retrieves the current AVAudioSession configuration details (category, mode, options, etc).
 * @platform ios
 * @returns {AudioSessionStatus} A promise that resolves with the audio session status.
 */
export function getAudioSessionStatus(): StatusResult {
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
export async function configureAudio<
  T extends AudioSessionCategory,
  M extends AudioSessionCompatibleModes[T],
  N extends AudioSessionCompatibleCategoryOptions[T],
>(params: ConfigureAudioAndActivateParams<T, M, N>): Promise<void> {
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
      (warning) => {
        console.warn(`${warning.name}: ${warning.message}`);
      }
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
 * Adds a strongly-typed listener and returns an unsubscribe function.
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
        AudioManagerHybridObject.removeInterruptionListeners(listenerId);
      };
    case 'routeChange':
      listenerId = AudioManagerHybridObject.addRouteChangeListener(
        listener as (event: RouteChangeEvent) => void
      );
      return () => {
        AudioManagerHybridObject.removeRouteChangeListeners(listenerId);
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

export function useIsHeadphonesConnected(): HeadphonesConnectedResult {
  const [isWiredConnected, setIsWiredConnected] = useState(
    AudioManagerHybridObject.isWiredHeadphonesConnected()
  );
  const [isWirelessConnected, setIsWirelessConnected] = useState(
    AudioManagerHybridObject.isBluetoothHeadphonesConnected()
  );

  useEffect(() => {
    const unsubscribe = addListener('routeChange', () => {
      setIsWiredConnected(
        AudioManagerHybridObject.isWiredHeadphonesConnected()
      );
      setIsWirelessConnected(
        AudioManagerHybridObject.isBluetoothHeadphonesConnected()
      );
    });

    return () => {
      unsubscribe;
    };
  }, []);

  return { wired: isWiredConnected, wireless: isWirelessConnected };
}
