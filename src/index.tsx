import { NitroModules } from 'react-native-nitro-modules';
import type { AudioManager } from './AudioManager.nitro';
import {
  AudioSessionCategory,
  AudioSessionCompatibleCategoryOptions,
  AudioSessionCompatibleModes,
  AudioSessionDeactivationOptions,
  AudioSessionMode,
  AudioSessionRouteSharingPolicy,
  AudioSessionStatus,
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

const isIOS = Platform.OS === 'ios';

// const warnOnWeb = () => {
//   console.warn('This function is not compatibile on web');
// };

const AudioManagerHybridObject =
  NitroModules.createHybridObject<AudioManager>('AudioManager');

/**
 * Returns the current system volume.
 * @returns A number between 0–1
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
 * Returns an array of available inputs.
 */
export function getAvailableInputs(): PortDescription[] {
  return AudioManagerHybridObject.getAvailableInputs();
}

/**
 * Returns an array of the current input routes.
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
 * Activates the AVAudioSession. This function can be relatively heavy to operate. You may consider wrapping it in a setTimeout(()=> activate(), 100) to push its operaton away from slowing UI.
 * @platform iOS
 * @returns {Promise<void>} - Resolves when the operation has finished. If an error occurs, it will be rejected with an instance of Error. On Android, this function is ignored.
 */
export async function activate(): Promise<void> {
  if (isIOS) {
    return AudioManagerHybridObject.activate();
  }
}

/**
 * Deactivates the AVAudioSession.
 * @platform iOS
 * @param options?: AudioSessionDeactivationOptions - restorePreviousSessionOnDeactivation - If you are playing music for example in the background and you want to
 * restore the music when you are done with your audio session, enable this flag. Defaults to true.
 * @returns {Promise<void>} - Resolves when the operation has finished. If an error occurs, it will be rejected with an instance of Error. On Android, this function is ignored.
 */
export async function deactivate(
  options?: AudioSessionDeactivationOptions
): Promise<void> {
  const finalOptions: AudioSessionDeactivationOptions = {
    restorePreviousSessionOnDeactivation: true,
    ...options,
  };

  if (isIOS) {
    return AudioManagerHybridObject.deactivate(
      finalOptions.restorePreviousSessionOnDeactivation ?? true
    );
  }
}

/**
 * Retrieves the current AVAudioSession configuration details (category, mode, options, etc).
 * @platform ios
 * @returns {AudioSessionStatus} A promise that resolves with the audio session status.
 */
export function getAudioSessionStatus(): AudioSessionStatus | undefined {
  if (isIOS) {
    return AudioManagerHybridObject.getAudioSessionStatus();
  } else {
    return undefined;
  }
}

/**
 * Configures an AVAudioSession with the specified category, mode, and additional options.
 * This method is only available on iOS and ensures compatibility between categories and modes.
 * @platform iOS
 * @returns {Promise<void>}
 * @see {@link https://developer.apple.com/documentation/avfaudio/avaudiosession|Apple AVAudioSession Documentation}
 * @example
 * ```tsx
 *   // For recording a video
 *   await configureAudioSession({
 *     category: AVAudioSessionCategory.PlayAndRecord,
 *     mode: AVAudioSessionMode.VideoRecording,
 *     policy: AVAudioSessionPolicy.Default,
 *     categoryOptions: [AVAudioSessionCategoryOptions.MixWithOthers],
 *     prefersNoInterruptionFromSystemAlerts: true
 *   })
 *
 *  // For controlling a video session
 *   await configureAudioSession({
 *     category: AVAudioSessionCategory.Playback,
 *     mode: AVAudioSessionMode.MediaPlayback,
 *     policy: AVAudioSessionPolicy.Default,
 *     categoryOptions: [AVAudioSessionCategoryOptions.MixWithOthers],
 *     prefersNoInterruptionFromSystemAlerts: true
 *   })
 * ```
 */
export function configureAudioSession<
  T extends AudioSessionCategory,
  M extends AudioSessionCompatibleModes[T],
  N extends AudioSessionCompatibleCategoryOptions[T],
>({
  category,
  mode,
  policy = AudioSessionRouteSharingPolicy.Default,
  categoryOptions,
  prefersNoInterruptionFromSystemAlerts = true,
  prefersInterruptionOnRouteDisconnect = true,
  allowHapticsAndSystemSoundsDuringRecording = true,
  prefersEchoCancelledInput = true,
}: {
  /**
   * The AVAudioSession category to tell the iPhone how to manage audio for different customized scenarios.
   *  @type {"Ambient" | "SoloAmbient" | "Playback" | "Record" | "PlayAndRecord" | "MultiRoute"}
   * @default AVAudioSessionCompatibleModes.Ambient
   */
  category: T;
  /**
   * The compatible modes with the categories.
   * @type {"Default" | "VoiceChat" | "VideoChat" | "GameChat" | "VideoRecording" | "Measurement" | "MoviePlayback" | "SpokenAudio"}
   * @default AVAudioSessionCompatibleModes.Default
   */
  mode?: M;
  /**
   * @type {"Default" | "LongFormAudio" | "LongFormVideo" | "Independent"}
   * @default AVAudioSessionRouteSharingPolicy.Default
   */
  policy?: AudioSessionRouteSharingPolicy;
  /**
   * @type {Array<"MixWithOthers" | "AllowBluetooth" | "AllowBluetoothA2DP" | "AllowAirPlay" | "DuckOthers" | "DefaultToSpeaker" | "InterruptSpokenAudioAndMixWithOthers" | "OverrideMutedMicrophoneInterruption">}
   *
   * The category options are kind of tricky. You can only set category options that are compatible with each category. The TS compiler should limit you to only combinations that are possible.
   *
   * @default [AVAudioSessionCategoryOptions.MixWithOthers,AVAudioSessionCategoryOptions.AllowBluetooth]
   */
  categoryOptions?: N[];
  /**
   * If true, prefers no interruptions from system alerts (iOS 14.0+).
   * @default true
   */
  prefersNoInterruptionFromSystemAlerts?: boolean;
  /**
   * If true, prefers interruption on route disconnect (iOS 16.0+).
   * @default true
   */
  prefersInterruptionOnRouteDisconnect?: boolean;
  /**
   * If true, allows haptics and system sounds while recording
   * @default true
   */
  allowHapticsAndSystemSoundsDuringRecording?: boolean;
  /**
   * If true, improves echo cancellation on input. Setting this to true doesn't guarantee that
   * it will be set on all phones -- only available with 'PlayAndRecord' category and 'Default' mode on newer phones (iOS 16.0+).
   * @default true
   */
  prefersEchoCancelledInput?: boolean;
}): void {
  if (isIOS) {
    if (!category) {
      throw new Error(
        'Category must be provided when configuring audio session'
      );
    }
    const resolvedMode: AudioSessionCompatibleModes[T] = (mode ??
      AudioSessionMode.Default) as AudioSessionCompatibleModes[T];

    return AudioManagerHybridObject.configureAudioSession(
      category,
      resolvedMode,
      policy,
      categoryOptions ?? [],
      prefersNoInterruptionFromSystemAlerts,
      prefersInterruptionOnRouteDisconnect,
      allowHapticsAndSystemSoundsDuringRecording,
      prefersEchoCancelledInput
    );
  }
  return;
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
  if (type === 'audioInterruption') {
    listenerId = AudioManagerHybridObject.addInterruptionListener(
      listener as (event: InterruptionEvent) => void
    );
    return () => {
      AudioManagerHybridObject.removeInterruptionListeners(listenerId);
    };
  } else if (type === 'routeChange') {
    listenerId = AudioManagerHybridObject.addRouteChangeListener(
      listener as (event: RouteChangeEvent) => void
    );
    return () => {
      AudioManagerHybridObject.removeRouteChangeListeners(listenerId);
    };
  } else {
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
