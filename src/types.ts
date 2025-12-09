// MARK: Common Types

/**
 * Input ports for receiving audio from various sources.
 */
export const InputPort = {
  /**
   * An input from a device’s built-in microphone.
   */
  BuiltInMic: 'BuiltInMic',
  /**
   * An input from a Continuity Microphone on Apple TV.
   */
  ContinuityMicrophone: 'ContinuityMicrophone',
  /**
   * An input from a wired headset’s built-in microphone.
   */
  HeadsetMic: 'HeadsetMic',
  /**
   * A line-level input from the dock connector.
   */
  LineIn: 'LineIn',
} as const;

/**
 * Output ports for sending audio to various destinations.
 */
export const OutputPort = {
  /**
   * An output to an AirPlay device.
   */
  AirPlay: 'AirPlay',
  /**
   * An output to a Bluetooth A2DP device.
   */
  BluetoothA2DP: 'BluetoothA2DP',
  /**
   * An output to a Bluetooth Low Energy (LE) device.
   */
  BluetoothLE: 'BluetoothLE',
  /**
   * An output to the speaker you hold to your ear when you’re on a phone call.
   */
  BuiltInReceiver: 'BuiltInReceiver',
  /**
   * An output to the device’s built-in speaker.
   */
  BuiltInSpeaker: 'BuiltInSpeaker',
  /**
   * An output to a High-Definition Multimedia Interface (HDMI) device.
   */
  HDMI: 'HDMI',
  /**
   * An output to wired headphones.
   */
  Headphones: 'Headphones',
  /**
   * A line-level output to the dock connector.
   */
  LineOut: 'LineOut',
} as const;

/**
 * Input/Output ports for bidirectional audio connections.
 */
export const InputOutputPort = {
  /**
   * An I/O connection to an Audio Video Bridging (AVB) device.
   */
  AVB: 'AVB',
  /**
   * An I/O connection to a Peripheral Component Interconnect (PCI) device.
   */
  PCI: 'PCI',
  /**
   * An I/O connection to a Bluetooth Hands-Free Profile device.
   */
  BluetoothHFP: 'BluetoothHFP',
  /**
   * An I/O connection through Car Audio.
   */
  CarAudio: 'CarAudio',
  /**
   * An I/O connection to a DisplayPort device.
   */
  DisplayPort: 'DisplayPort',
  /**
   * An I/O connection to a FireWire device.
   */
  FireWire: 'FireWire',
  /**
   * An I/O connection to a Thunderbolt device.
   */
  Thunderbolt: 'Thunderbolt',
  /**
   * An I/O connection to a Universal Serial Bus (USB) device.
   */
  USBAudio: 'USBAudio',
  /**
   * An I/O connection that doesn’t correspond to physical audio hardware.
   */
  Virtual: 'Virtual',
  /**
   * The device type is unknown.
   */
  Unknown: 'Unknown',
} as const;

export type InputPort = (typeof InputPort)[keyof typeof InputPort];
export type OutputPort = (typeof OutputPort)[keyof typeof OutputPort];
export type InputOutputPort =
  (typeof InputOutputPort)[keyof typeof InputOutputPort];

export type PortType = InputPort | OutputPort | InputOutputPort;

export type PortDescription = {
  portName: string;
  portType: PortType;
  uid: string;
  channels?: number[];
  isDataSourceSupported?: boolean;
  selectedDataSourceId?: string;
};

export interface AudioSessionWarning {
  name: string;
  message: string;
}

// Error type (matches AudioSessionError in Swift)
export interface AudioSessionError extends Error {
  name: string;
  message: string;
}

export type PlatformOptions = 'ios' | 'android' | 'both';

export type DeactivationOptions = {
  /**
   * Which platform(s) to deactivate on.
   * - `ios`: only call the iOS activate API
   * - `android`: only call the Android activate API
   * - `both` (default): call both
   */
  platform?: PlatformOptions;
  /**
   * If by chance you are reliant (and using) the volume listener from `addListener('volume', ()=>{})`, and you call
   * `deactivate`, your volume listener won't work anymore. This is because in order to actively track volume you need an active
   * audio session. Setting this to true will skip the deactivation of the session, but then fallback to `Ambient` category
   * @platform: `iOS`
   * @default false
   *
   */
  fallbackToAmbientCategoryAndLeaveActiveForVolumeListener?: boolean;
  /**
   * Restores the previous AVAudioSession when this one ends. For example, if you are listening to music in the backgorund
   * and this audio session starts, it will pause the music. When you call `deactivate` it will play the music again.
   * @platform: `iOS`
   * @default true
   */
  restorePreviousSessionOnDeactivation?: boolean;
};

export type ActivationOptions = {
  /**
   * Which platform(s) to activate on.
   * - `ios`: only call the iOS activate API
   * - `android`: only call the Android activate API
   * - `both` (default): call both
   */
  platform?: PlatformOptions;
};

export type RouteChangeReason =
  | 'Unknown'
  | 'NewDeviceAvailable'
  | 'OldDeviceUnavailable'
  | 'CategoryChange'
  | 'Override'
  | 'WakeFromSleep'
  | 'NoSuitableRouteForCategory'
  | 'RouteConfigurationChange';

export interface RouteChangeEvent {
  prevRoute: PortDescription[];
  currentRoute: PortDescription[];
  reason: RouteChangeReason;
}

export type InterruptionType = 'began' | 'ended';

export type InterruptionReason =
  | 'Default'
  | 'BuiltInMicMuted'
  | 'RouteDisconnected'
  | 'AppWasSuspended'; // Deprecated but still kind of valid

export interface InterruptionEvent {
  type: InterruptionType;
  reason: InterruptionReason;
}

export type ListenerEvent = {
  audioInterruption: InterruptionEvent;
  routeChange: RouteChangeEvent;
  volume: number;
};

export type ListenerType = keyof ListenerEvent;

export type HeadphonesConnectedResult = {
  wireless: boolean;
  wired: boolean;
};

/**
 * Convenient union of both iOS + Android configs.
 */
export type ConfigureAudioAndActivateParams<
  T extends AudioSessionCategory,
  M extends AudioSessionCompatibleModes[T],
  N extends AudioSessionCompatibleCategoryOptions[T],
  O extends EchoCancelledInputCompatibliteCategories[T],
> = {
  ios?: AudioSessionConfiguration<T, M, N, O>;
  android?: AudioManagerConfiguration;
};

// MARK: IOS Types

export const AudioSessionCategory = {
  /**
   * This category is also appropriate for "play-along" apps, such as a virtual piano that a user plays while the Music app is playing. When you use this category, audio from other apps mixes with your audio (The MixWithOthers is set under the hood). Screen locking and the Silent switch (on iPhone, the Ring/Silent switch) silence your audio.
   *
   * **Compatible Modes**:
   *
   * Default, SpokenAudio
   *
   * **Compatible Cateogory Options**:
   *
   * MixWithOthers, AllowBluetoothA2DP
   *
   */
  Ambient: 'Ambient',
  /**
   * Your audio is silenced by screen locking and by the Silent switch (called the Ring/Silent switch on iPhone).
   *
   * By default, using this category implies that your app's audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing, use the ambient category instead.
   *
   * **Compatible Modes**:
   *
   * Default, SpokenAudio
   *
   * **Compatible Cateogory Options**:
   *
   * AllowBluetoothA2DP (set by default)
   */
  SoloAmbient: 'SoloAmbient',
  /**
   * When using this category, your app audio continues with the Silent switch set to silent or when the screen locks. (The switch is called the Ring/Silent switch on iPhone.) To continue playing audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   *
   * By default, using this category implies that your app's audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing for this category, use the mixWithOthers option.
   *
   * **Compatible Modes**:
   *
   * Default, MoviePlayback, SpokenAudio, Measurement
   *
   * **Compatible Cateogory Options**:
   *
   * MixWithOthers, DuckOthers, InterruptSpokenAudioAndMixWithOthers, AllowBluetoothA2DP (set by default)
   */
  Playback: 'Playback',
  /**
   * Your audio continues with the Silent switch set to silent and with the screen locked. (The switch is called the Ring/Silent switch on iPhone.) To continue playing audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   * This category is appropriate for simultaneous recording and playback, and also for apps that record and play back, but not simultaneously.
   * By default, using this category implies that your app's audio is nonmixable—activating your session will interrupt any other audio sessions which are also nonmixable. To allow mixing for this category, use the mixWithOthers option.
   *
   * The user must grant permission for audio recording.
   *
   * This category supports the mirrored version of Airplay. However, AirPlay mirroring will be disabled if the AudioSessionModeVoiceChat mode is used with this category.
   *
   * **Compatible Modes**:
   *
   * Default, SpokenAudio, Measurement, VoiceChat, VideoChat, GameChat, VideoRecording
   *
   * **Compatible Cateogory Options**:
   *
   * MixWithOthers, DuckOthers, InterruptSpokenAudioAndMixWithOthers, AllowBluetoothHFP, AllowBluetoothA2DP (set by default), AllowAirPlay, DefaultToSpeaker, OverrideMutedMicrophoneInterruption
   *
   */
  PlayAndRecord: 'PlayAndRecord',
  /**
   * This category has the effect of silencing virtually all output on the system, for as long as the session is active. Unless you need to prevent any unexpected sounds from being played, use playAndRecord instead.
   * To continue recording audio when your app transitions to the background (for example, when the screen locks), add the audio value to the UIBackgroundModes key in your information property list file.
   *
   * The user must grant permission for audio recording.
   *
   * **Compatible Modes**:
   *
   * Default, SpokenAudio, Measurement, VideoRecording, VideoChat
   *
   * **Compatible Cateogory Options**:
   *
   * MixWithOthers, DuckOthers, InterruptSpokenAudioAndMixWithOthers, AllowBluetoothA2DP
   */
  Record: 'Record',
  /**
   * This category can be used for input, output, or both. For example, use this category to route audio to both a USB device and a set of headphones. Use of this category requires a more detailed knowledge of, and interaction with, the capabilities of the available audio routes.
   * @important
   * Route changes can invalidate part or all of your multi-route configuration. When using the multiRoute category, it is essential that you register to observe routeChangeNotification notifications and update your configuration as necessary.
   *
   * **Compatible Modes**:
   *
   * Default, SpokenAudio
   *
   * **Compatible Cateogory Options**:
   *
   * MixWithOthers, DuckOthers, InterruptSpokenAudioAndMixWithOthers
   *
   */
  MultiRoute: 'MultiRoute',
} as const;

export type AudioSessionCategory =
  (typeof AudioSessionCategory)[keyof typeof AudioSessionCategory];

export const AudioSessionMode = {
  /**
   * Default mode, no specific optimizations applied. You can use this mode with every audio session category.
   */
  Default: 'Default',
  /**
   * Use this mode for Voice over IP (VoIP) apps that use the playAndRecord category. When you set this mode, the session optimizes the device's tonal equalization for voice and reduces the set of allowable audio routes to only those appropriate for voice chat.
   * Using this mode has the side effect of enabling the allowBluetoothHFP category option.
   * For apps that use voice or video chat, also use the Voice-Processing I/O audio unit. The Voice-Processing I/O unit provides several features for VoIP apps, including automatic gain correction, adjustment of voice processing, and muting. See Voice-Processing I/O Unit for more information.
   * If an app uses the Voice-Processing I/O audio unit and hasn't set its mode to one of the chat modes (voice, video, or game), the session sets the voiceChat mode implicitly. On the other hand, if the app had previously set its category to playAndRecord and its mode to videoChat or gameChat, instantiating the Voice-Processing I/O audio unit doesn't cause the mode to change.
   */
  VoiceChat: 'VoiceChat',
  /**
   * Use this mode for video chat apps that use the playAndRecord or record categories. When you set this mode, the audio session optimizes the device's tonal equalization for voice. It also reduces the set of allowable audio routes to only those appropriate for video chat.
   * Using this mode has the side effect of enabling the allowBluetoothHFP category option.
   * For apps that use voice or video chat, also use the Voice-Processing I/O audio unit. The Voice-Processing I/O unit provides several features for VoIP apps, including automatic gain correction, adjustment of voice processing, and muting. See Voice-Processing I/O Unit for more information.
   * If an app uses the Voice-Processing I/O audio unit and hasn't set its mode to one of the chat modes (voice, video, or game), the session sets the voiceChat mode implicitly. On the other hand, if the app had previously set its category to playAndRecord and its mode to videoChat or gameChat, instantiating the Voice-Processing I/O audio unit doesn't cause the mode to change.
   */
  VideoChat: 'VideoChat',
  /**
   * This mode is valid only with the playAndRecord audio session category.
   * Don't set this mode directly. If you need similar behavior and aren't using a GKVoiceChat object, use voiceChat or videoChat instead.
   */
  GameChat: 'GameChat',
  /**
   * This mode is valid only with the record and playAndRecord audio session categories. On devices with more than one built-in microphone, the audio session uses the microphone closest to the video camera.
   * Use this mode to ensure that the system provides appropriate audio-signal processing.
   * Use AVCaptureSession in conjunction with the video recording mode for greater control of input and output routes. For example, setting the automaticallyConfiguresApplicationAudioSession property results in the session automatically choosing the best input route for the device and camera used.
   */
  VideoRecording: 'VideoRecording',
  /**
   * Use this mode for apps that need to minimize the amount of system-supplied signal processing to input and output signals. If recording on devices with more than one built-in microphone, the session uses the primary microphone.
   * For use with the playback, record, or playAndRecord audio session categories.
   * @important
   * This mode disables some dynamics processing on input and output signals, resulting in a lower-output playback level.
   */
  Measurement: 'Measurement',
  /**
   * When you set this mode, the audio session uses signal processing to enhance movie playback for certain audio routes such as built-in speaker or headphones. You may only use this mode with the playback audio session category.
   */
  MoviePlayback: 'MoviePlayback',
  /**
   * This mode is appropriate for apps that play continuous spoken audio, such as podcasts or audio books. Setting this mode indicates that your app should pause, rather than duck, its audio if another app plays a spoken audio prompt. After the interrupting app's audio ends, you can resume your app's audio playback.
   */
  SpokenAudio: 'SpokenAudio',
  /**
   * Setting this mode allows for different routing behaviors when your app connects to certain audio devices, such as CarPlay. An example of an app that uses this mode is a turn-by-turn navigation app that plays short prompts to the user.
   * Typically, apps of the same type also configure their sessions to use the duckOthers and interruptSpokenAudioAndMixWithOthers options.
   */
  VoicePrompt: 'VoicePrompt',
} as const;

export type AudioSessionMode =
  (typeof AudioSessionMode)[keyof typeof AudioSessionMode];

export const AudioSessionRouteSharingPolicy = {
  /**
   * A policy that follows standard rules for routing audio output.
   */
  Default: 'Default',
  /**
   * Apps that play long-form audio, such as music or audio books, can use this policy to play to the same output as the built-in Music and Podcast apps. Long-form audio apps should also use the Media Player framework to add support for remote control events and to provide Now Playing information.
   */
  LongFormAudio: 'LongFormAudio',
  /**
   * Apps that play long-form video content can use this policy to play to the same output as other long-form video apps, such as the built-in TV app.
   */
  LongFormVideo: 'LongFormVideo',
  /**
   * In iOS, the system sets this policy in cases where the user directs video to a wireless route using the route picker UI. Apps shouldn't try to set this value directly.
   */
  Independent: 'Independent',
} as const;

export type AudioSessionRouteSharingPolicy =
  (typeof AudioSessionRouteSharingPolicy)[keyof typeof AudioSessionRouteSharingPolicy];

export const AudioSessionCategoryOptions = {
  /**
   * An option that indicates whether audio from this session mixes with audio from active sessions in other audio apps.
   *
   * You can set this option explicitly only if the audio session category is `playAndRecord`, `playback`, or `multiRoute`. If you set the audio session category to `ambient`, the session automatically sets this option. Likewise, setting the `duckOthers` or `interruptSpokenAudioAndMixWithOthers` options also enables this option.
   *
   * Clearing this option and then activating your session interrupts other audio sessions. If you set this option, your app mixes its audio with audio playing in background apps, such as the Music app.
   */
  MixWithOthers: 'MixWithOthers',
  /**
   * An option that reduces the volume of other audio sessions while audio from this session plays.
   *
   * You can set this option only if the audio session category is `playAndRecord`, `playback`, or `multiRoute`. Setting it implicitly sets the `mixWithOthers` option.
   * Use this option to mix your app's audio with that of others. While your app plays audio, the system reduces the volume of other audio sessions to make yours more prominent. If your app provides occasional spoken audio, such as in a turn-by-turn navigation app or an exercise app, you should also set the `interruptSpokenAudioAndMixWithOthers` option.
   *
   * Ducking begins when you activate your app's audio session and ends when you deactivate the session. If you clear this option, activating your session interrupts other audio sessions.
   */
  DuckOthers: 'DuckOthers',
  /**
   * An option that determines whether to pause spoken audio content from other sessions when your app plays its audio.
   *
   * You can set this option only if the audio session category is `playAndRecord`, `playback`, or `multiRoute`. Setting this option also sets `mixWithOthers`.
   *
   * If you clear this option, audio from your audio session interrupts other sessions. If you set this option, the system mixes your audio with other audio sessions, but interrupts (and stops) audio sessions that use the `spokenAudio` audio session mode. It pauses the audio from other apps as long as your session is active. After your audio session deactivates, the system resumes the interrupted app's audio.
   * Set this option if your app's audio is occasional and spoken, such as in a turn-by-turn navigation app or an exercise app. This avoids intelligibility problems when two spoken audio apps mix. If you set this option, also set the `duckOthers` option unless you have a specific reason not to. Ducking other audio, rather than interrupting it, is appropriate when the other audio isn't spoken audio.
   *
   * When you configure your audio session category using this option, notify other apps on the system when you deactivate your session so that they can resume audio playback. To do so, deactivate your session using the `notifyOthersOnDeactivation` option.
   */
  InterruptSpokenAudioAndMixWithOthers: 'InterruptSpokenAudioAndMixWithOthers',
  /**
   * An option that determines whether Bluetooth hands-free devices appear as available input routes
   *
   * You can set this option only if the audio session category is `playAndRecord` or `record`.
   *
   * You're required to set this option to allow routing audio input and output to a paired Bluetooth Hands-Free Profile (HFP) device. If you clear this option, paired Bluetooth HFP devices don't show up as available audio input routes.
   *
   * If an application uses the `setPreferredInput(_:)` method to select a Bluetooth HFP input, the output automatically changes to the corresponding Bluetooth HFP output. Likewise, selecting a Bluetooth HFP output using an `MPVolumeView` object's route picker automatically changes the input to the corresponding Bluetooth HFP input. Therefore, both audio input and output are routed to the Bluetooth HFP device even though you only selected the input or output.
   */
  AllowBluetoothHFP: 'AllowBluetoothHFP',
  /**
   * An option that determines whether you can stream audio from this session to Bluetooth devices that support the Advanced Audio Distribution Profile (A2DP).
   *
   * A2DP is a stereo, output-only profile intended for higher bandwidth audio use cases, such as music playback. The system automatically routes to A2DP ports if you configure an app's audio session to use the `ambient`, `soloAmbient`, or `playback` categories.
   *
   * Starting with `iOS 10.0`, apps using the `playAndRecord` category may also allow routing output to paired Bluetooth A2DP devices. To enable this behavior, pass this category option when setting your audio session's category.
   *
   * Audio sessions using the `multiRoute` or `record` categories implicitly clear this option. If you clear it, paired Bluetooth A2DP devices don't show up as available audio output routes.
   */
  AllowBluetoothA2DP: 'AllowBluetoothA2DP',
  /**
   * An option that determines whether you can stream audio from this session to AirPlay devices.
   *
   * Setting this option enables the audio session to route audio output to AirPlay devices. You can only explicitly set this option if the audio session's category is set to `playAndRecord`. For most other audio session categories, the system sets this option implicitly.
   *
   * Audio sessions using the `multiRoute` or `record` categories implicitly clear this option.
   */
  AllowAirPlay: 'AllowAirPlay',
  /**
   * You can set this option only when using the `playAndRecord` category. Use it to modify the category's routing behavior so audio is always routed to the speaker rather than the receiver, even when other accessories, such as headphones and wireless Bluetooth headphones, are in use.
   *
   * When using this option, the system doesn't honor user gestures. For example, plugging in a headset doesn't cause the route to change to headset mic and headphones, the route remains to the built-in mic and speaker when you've set this override.
   *
   * In the case of using a USB input-only accessory, audio input comes from the accessory, and the system routes audio to the headphones, if attached, or to the speaker if the headphones aren't plugged in. The use case is to route audio to the speaker instead of the receiver in cases where the audio normally goes to the receiver.
   */
  DefaultToSpeaker: 'DefaultToSpeaker',
  /**
   * An option that indicates whether the system interrupts the audio session when it mutes the built-in microphone.
   *
   * Some devices include a privacy feature that mutes the built-in microphone at the hardware level in certain conditions, such as when you close the Smart Folio cover of an iPad. When this occurs, the system interrupts the audio session that's capturing input from the microphone. Attempting to start audio input after the system mutes the microphone results in an error.
   *
   * If your app uses an audio session category that supports input and output, such as `playAndRecord`, you can set this option to disable the default behavior and continue using the session. Disabling the default behavior may be useful to allow your app to continue playback when recording or monitoring a muted microphone doesn't lead to a poor user experience. When you set this option, playback continues as normal, and the microphone hardware produces sample buffers, but with values of
   */
  OverrideMutedMicrophoneInterruption: 'OverrideMutedMicrophoneInterruption',
} as const;

export type AudioSessionCategoryOptions =
  (typeof AudioSessionCategoryOptions)[keyof typeof AudioSessionCategoryOptions];

/**
 * Mapping of AudioSessionCategory to compatible AudioSessionMode values.
 */
export type AudioSessionCompatibleModes = {
  Ambient: 'Default' | 'SpokenAudio';
  SoloAmbient: 'Default' | 'SpokenAudio';
  Playback: 'Default' | 'MoviePlayback' | 'SpokenAudio' | 'Measurement';
  Record:
    | 'Default'
    | 'VideoRecording'
    | 'VideoChat'
    | 'Measurement'
    | 'SpokenAudio';
  PlayAndRecord:
    | 'Default'
    | 'Measurement'
    | 'SpokenAudio'
    | 'VoiceChat'
    | 'VideoChat'
    | 'GameChat'
    | 'VideoRecording'
    | 'VoicePrompt';
  MultiRoute: 'Default' | 'SpokenAudio';
};

/**
 * Mapping of AudioSessionCategory to valid combinations of AVAudioSessionCategoryOptions.
 * Each array represents a valid set of options that can be used together.
 */
export type AudioSessionCompatibleCategoryOptions = {
  Ambient: 'MixWithOthers';
  SoloAmbient: never; // no compatible options, just leave blank
  Playback:
    | 'MixWithOthers'
    | 'DuckOthers'
    | 'InterruptSpokenAudioAndMixWithOthers';
  Record: 'AllowBluetoothHFP';
  PlayAndRecord:
    | 'MixWithOthers'
    | 'DuckOthers'
    | 'InterruptSpokenAudioAndMixWithOthers'
    | 'AllowBluetoothHFP'
    | 'AllowBluetoothA2DP'
    | 'AllowAirPlay'
    | 'DefaultToSpeaker'
    | 'OverrideMutedMicrophoneInterruption';
  MultiRoute:
    | 'MixWithOthers'
    | 'DuckOthers'
    | 'InterruptSpokenAudioAndMixWithOthers';
};

export type EchoCancelledInputCompatibliteCategories = {
  Ambient: false;
  SoloAmbient: false;
  Playback: false;
  Record: false;
  MultiRoute: false;
  PlayAndRecord: true;
};

export type AudioSessionStatus = {
  category: AudioSessionCategory;
  mode: AudioSessionMode;
  categoryOptions: AudioSessionCategoryOptions[];
  routeSharingPolicy?: AudioSessionRouteSharingPolicy;
  isOutputtingAudioElsewhere: boolean;
  allowHapticsAndSystemSoundsDuringRecording: boolean;
  prefersNoInterruptionsFromSystemAlerts: boolean;
  prefersInterruptionOnRouteDisconnect: boolean;
  isEchoCancelledInputEnabled: boolean;
  isEchoCancelledInputAvailable: boolean;
  prefersEchoCancelledInput: boolean;
};

/**
 * Exactly the parameters your existing configureAudioSession() expects.
 */
export type AudioSessionConfiguration<
  T extends AudioSessionCategory,
  M extends AudioSessionCompatibleModes[T],
  N extends AudioSessionCompatibleCategoryOptions[T],
  O extends EchoCancelledInputCompatibliteCategories[T],
> = {
  category: T;
  mode?: M;
  policy?: AudioSessionRouteSharingPolicy;
  categoryOptions?: N[];
  prefersNoInterruptionFromSystemAlerts?: boolean;
  prefersInterruptionOnRouteDisconnect?: boolean;
  allowHapticsAndSystemSoundsDuringRecording?: boolean;
  prefersEchoCancelledInput?: O;
};

// MARK: Android Types

export const AudioModes = {
  Normal: 'Normal',
  RingTone: 'RingTone',
  InCall: 'InCall',
  InCommunication: 'InCommunication',
  CallScreening: 'CallScreening', // API 23+
} as const;

export const RingerModes = {
  Normal: 'Normal',
  Silent: 'Silent',
  Vibrate: 'Vibrate',
} as const;

export type AudioMode = (typeof AudioModes)[keyof typeof AudioModes];
export type RingerMode = (typeof RingerModes)[keyof typeof RingerModes];

export const AudioFocusGainTypes = {
  Gain: 'Gain' as const,
  GainTransient: 'GainTransient' as const,
  GainTransientMayDuck: 'GainTransientMayDuck' as const,
  GainTransientExclusive: 'GainTransientExclusive' as const,
  GainTransientAllowPause: 'GainTransientAllowPause' as const,
} as const;
export type AudioFocusGainType =
  (typeof AudioFocusGainTypes)[keyof typeof AudioFocusGainTypes];

export const AudioUsages = {
  Alarm: 'Alarm' as const,
  AssistanceAccessibility: 'AssistanceAccessibility' as const,
  AssistanceNavigationGuidance: 'AssistanceNavigationGuidance' as const,
  AssistanceSonification: 'AssistanceSonification' as const,
  Assistant: 'Assistant' as const,
  Game: 'Game' as const,
  Media: 'Media' as const,
  Notification: 'Notification' as const,
  NotificationCommunicationDelayed: 'NotificationCommunicationDelayed' as const,
  NotificationCommunicationInstant: 'NotificationCommunicationInstant' as const,
  NotificationCommunicationRequest: 'NotificationCommunicationRequest' as const,
  NotificationEvent: 'NotificationEvent' as const,
  NotificationRingtone: 'NotificationRingtone' as const,
  Unknown: 'Unknown' as const,
  VoiceCommunication: 'VoiceCommunication' as const,
  VoiceCommunicationSignalling: 'VoiceCommunicationSignalling' as const,
} as const;
export type AudioUsage = (typeof AudioUsages)[keyof typeof AudioUsages];

export const AudioContentTypes = {
  Music: 'Music' as const,
  Speech: 'Speech' as const,
  Movie: 'Movie' as const,
  Sonification: 'Sonification' as const,
  Unknown: 'Unknown' as const,
} as const;
export type AudioContentType =
  (typeof AudioContentTypes)[keyof typeof AudioContentTypes];

export interface AudioManagerStatus {
  mode: AudioMode;
  ringerMode: RingerMode;
  focusGain: AudioFocusGainType;
  usage: AudioUsage;
  contentType: AudioContentType;
  willPauseWhenDucked: boolean;
  acceptsDelayedFocusGain: boolean;
}

/**
 * Exactly the parameters your Android configureAudioManager() expects.
 */
export interface AudioManagerConfiguration {
  focusGain: AudioFocusGainType;
  usage: AudioUsage;
  contentType: AudioContentType;
  willPauseWhenDucked: boolean;
  acceptsDelayedFocusGain: boolean;
}
