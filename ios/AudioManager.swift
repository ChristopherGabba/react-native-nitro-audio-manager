import AVFoundation
import Foundation
import NitroModules

typealias InterruptionListener = (InterruptionEvent) -> Void
typealias RouteChangeListener = (RouteChangeEvent) -> Void
typealias VolumeListener = (Double) -> Void
typealias WarningCallback = (AudioSessionWarning) -> Void

struct Listener<T> {
  let id: Double
  let callback: T
}

enum AudioSessionError: Error {
  case invalidCategory(name: String, message: String)
  case invalidMode(name: String, message: String)
  case invalidCategoryOption(name: String, message: String)
  case invalidConfiguration(name: String, message: String)
  case preferenceFailure(name: String, message: String)
}

@objcMembers
class AudioManager: HybridAudioManagerSpec {

  private var interruptionListeners: [Listener<InterruptionListener>] = []
  private var routeChangeListeners: [Listener<RouteChangeListener>] = []
  private var volumeListeners: [Listener<VolumeListener>] = []
  private var nextListenerId: Double = 0

  private let audioSession = AVAudioSession.sharedInstance()

  private var volumeObservation: NSKeyValueObservation?

  override init() {
    super.init()
    registerListeners()
  }

  deinit {
    unregisterListeners()
  }

  private func registerListeners() {

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleRouteChange(_:)),
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )

  }

  private func unregisterListeners() {
    // only remove the interruption observer
    NotificationCenter.default.removeObserver(
      self,
      name: AVAudioSession.interruptionNotification,
      object: nil
    )
    // only remove the route‑change observer
    NotificationCenter.default.removeObserver(
      self,
      name: AVAudioSession.routeChangeNotification,
      object: nil
    )

    volumeObservation?.invalidate()
    volumeObservation = nil

    interruptionListeners.removeAll()
    routeChangeListeners.removeAll()
    volumeListeners.removeAll()
  }

  @objc private func handleInterruption(_ note: Notification) {

    guard
      let userInfo = note.userInfo,
      let rawReason = userInfo[AVAudioSessionInterruptionReasonKey] as? UInt,
      let rawType = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt
    else {
      return
    }

    let reason = readableInterruptionReason(
      AVAudioSession.InterruptionReason(rawValue: rawReason) ?? .default)

    let typeEnum = AVAudioSession.InterruptionType(rawValue: rawType)
    let type = typeEnum == .began ? InterruptionType.began : InterruptionType.ended

    let interruptionChangeInfo = InterruptionEvent(
      type: type,
      reason: reason,
    )

    interruptionListeners.forEach { $0.callback(interruptionChangeInfo) }
  }

  @objc private func handleRouteChange(_ note: Notification) {
    guard
      let userInfo = note.userInfo,
      let rawReason = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt
    else {
      return
    }
    let reason = readableRouteChangeReason(
      AVAudioSession.RouteChangeReason(rawValue: rawReason) ?? .unknown)

    let previousRoute =
      userInfo[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription
    let previousRouteDescription =
      previousRoute?.outputs.map { serializePort($0) } ?? []

    let currentRoute = audioSession.currentRoute
    let currentRouteDescription = currentRoute.outputs.map { serializePort($0) }

    let routeChangeInfo = RouteChangeEvent(
      prevRoute: previousRouteDescription,
      currentRoute: currentRouteDescription,
      reason: reason,
    )

    routeChangeListeners.forEach { $0.callback(routeChangeInfo) }
  }

  func addInterruptionListener(callback: @escaping InterruptionListener) throws -> Double {
    let listener = Listener(id: nextListenerId, callback: callback)
    interruptionListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }

  func removeInterruptionListeners(id: Double) throws {
    interruptionListeners.removeAll { $0.id == id }
  }

  func addRouteChangeListener(callback: @escaping RouteChangeListener) throws -> Double {
    let listener = Listener(id: nextListenerId, callback: callback)
    routeChangeListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }

  func removeRouteChangeListeners(id: Double) throws {
    routeChangeListeners.removeAll { $0.id == id }
  }

  func addVolumeListener(callback: @escaping VolumeListener) throws -> Double {
    try? audioSession.setCategory(.ambient)
    try? audioSession.setActive(true)

    let listener = Listener(id: nextListenerId, callback: callback)
    volumeListeners.append(listener)
    nextListenerId += 1

    if volumeObservation == nil {
      volumeObservation = audioSession.observe(\.outputVolume, options: [.new]) {
        [weak self] session, change in
        guard let self = self else { return }
        let raw = change.newValue ?? session.outputVolume
        let volume = Double(raw)
        self.volumeListeners.forEach { $0.callback(volume) }
      }
    }

    return listener.id
  }

  func removeVolumeListener(id: Double) throws {
    volumeListeners.removeAll { $0.id == id }
    
    if volumeListeners.isEmpty {
      volumeObservation?.invalidate()
      volumeObservation = nil
    }
  }

  public func isWiredHeadphonesConnected() -> Bool {
    return audioSession.currentRoute.outputs.contains {
      $0.portType == .headphones
    }
  }

  public func isBluetoothHeadphonesConnected() -> Bool {
    return audioSession.currentRoute.outputs.contains { port in
      port.portType == .bluetoothA2DP
        || port.portType == .bluetoothHFP
    }
  }

  private func serializePort(_ port: AVAudioSessionPortDescription) -> PortDescription {
    let portName = port.portName
    let portType = readablePortType(for: port.portType)
    let uid = port.uid

    let channels: [Double]? = port.channels?.map { Double($0.channelNumber) }

    let selectedDataSourceId: String? = {
      if let dataSourceID = port.selectedDataSource?.dataSourceID {
        return dataSourceID.stringValue
      }
      return nil
    }()

    let isDataSourceSupported = port.dataSources != nil

    return PortDescription(
      portName: portName,
      portType: portType,
      uid: uid,
      channels: channels,
      isDataSourceSupported: isDataSourceSupported,
      selectedDataSourceId: selectedDataSourceId
    )
  }

  public func getSystemVolume() throws -> Double {
    return Double(audioSession.outputVolume)
  }

  public func getInputLatency() throws -> Double {
    return Double(audioSession.inputLatency)
  }

  public func getOutputLatency() throws -> Double {
    return Double(audioSession.outputLatency)
  }

  // on ios this is based on system category
  public func getCategoryCompatibleInputs() throws -> [PortDescription] {
    return (audioSession.availableInputs ?? []).map(serializePort)
  }

  public func getCurrentInputRoutes() throws -> [PortDescription] {
    return audioSession.currentRoute.inputs.map(serializePort)
  }

  public func getCurrentOutputRoutes() throws -> [PortDescription] {
    return audioSession.currentRoute.outputs.map(serializePort)
  }

  public func forceOutputToSpeaker() throws {
    if audioSession.category != .playAndRecord {
      try audioSession.setCategory(.playAndRecord, mode: .default, options: [])
    }

    do {
      try audioSession.overrideOutputAudioPort(.speaker)
    } catch {
      throw RuntimeError.error(
        withMessage: "Failed to force output to speaker: \(error.localizedDescription)"
      )
    }
  }

  public func cancelForcedOutputToSpeaker() throws {
    do {
      try audioSession.overrideOutputAudioPort(.none)
    } catch {
      throw RuntimeError.error(
        withMessage: "Failed to cancel speaker override: \(error.localizedDescription)"
      )
    }
  }

  public func activateIOS() throws -> Promise<Void> {
    return Promise.async {
      do {
        try self.audioSession.setActive(true)
      } catch {
        throw RuntimeError.error(withMessage: "Failed to activate audio session")
      }
    }
  }

  public func activateAndroid() throws -> Promise<Void> {
    return Promise.async {
      // no-op
    }
  }

  public func deactivateIOS(restorePreviousSessionOnDeactivation: Bool) throws -> Promise<Void> {
    var options: AVAudioSession.SetActiveOptions = []

    if restorePreviousSessionOnDeactivation {
      options.insert(.notifyOthersOnDeactivation)
    }

    return Promise.async {
      do {
        try self.audioSession.setActive(false, options: options)
      } catch {
        throw RuntimeError.error(withMessage: "Failed to deactivate audio session")
      }
    }
  }

  public func deactivateAndroid() throws -> Promise<Void> {
    return Promise.async {
      // no-op
    }
  }

  public func getAudioManagerStatusAndroid() -> AudioManagerStatus? {
    // no op
    return nil
  }

  public func getAudioSessionStatusIOS() -> AudioSessionStatus? {
    // ---- All of these come as Bitwise numbers that have to be converted to strings on the native side ----
    let category = readableCategory(audioSession.category)
    let mode = readableMode(audioSession.mode)
    let categoryOptions = readableCategoryOptions(audioSession.categoryOptions)
    let routeSharingPolicy = readableRouteSharingPolicy(audioSession.routeSharingPolicy)

    // ----------------------------------------------------------------
    let isOutputtingAudioElsewhere = audioSession.isOtherAudioPlaying

    let allowHapticsAndSystemSoundsDuringRecording = audioSession
      .allowHapticsAndSystemSoundsDuringRecording

    let prefersNoInterruptionsFromSystemAlerts = audioSession.prefersNoInterruptionsFromSystemAlerts

    var prefersInterruptionOnRouteDisconnect = false
    if #available(iOS 17.0, *) {
      prefersInterruptionOnRouteDisconnect = audioSession.prefersInterruptionOnRouteDisconnect
    }

    var isEchoCancelledInputAvailable = false
    var isEchoCancelledInputEnabled = false
    var prefersEchoCancelledInput = false
    if #available(iOS 18.2, *) {
      isEchoCancelledInputAvailable = audioSession.isEchoCancelledInputAvailable
      isEchoCancelledInputEnabled = audioSession.isEchoCancelledInputEnabled
      prefersEchoCancelledInput = audioSession.prefersEchoCancelledInput
    }

    return AudioSessionStatus(
      category: category,
      mode: mode,
      categoryOptions: categoryOptions,
      routeSharingPolicy: routeSharingPolicy,
      isOutputtingAudioElsewhere: isOutputtingAudioElsewhere,
      allowHapticsAndSystemSoundsDuringRecording: allowHapticsAndSystemSoundsDuringRecording,
      prefersNoInterruptionsFromSystemAlerts: prefersNoInterruptionsFromSystemAlerts,
      prefersInterruptionOnRouteDisconnect: prefersInterruptionOnRouteDisconnect,
      isEchoCancelledInputEnabled: isEchoCancelledInputEnabled,
      isEchoCancelledInputAvailable: isEchoCancelledInputAvailable,
      prefersEchoCancelledInput: prefersEchoCancelledInput
    )
  }

  func configureAudioSession(
    category categoryName: String,
    mode modeName: String,
    policy policyName: String,
    categoryOptions optionsArray: [String],
    prefersNoInterruptionFromSystemAlerts: Bool,
    prefersInterruptionOnRouteDisconnect: Bool,
    allowHapticsAndSystemSoundsDuringRecording: Bool,
    prefersEchoCancelledInput: Bool,
    warningCallback: @escaping WarningCallback
  ) throws {

    audioSession

    // MARK: - Map category
    let category: AVAudioSession.Category = try {
      switch categoryName {
      case "Ambient": return .ambient
      case "SoloAmbient": return .soloAmbient
      case "Playback": return .playback
      case "Record": return .record
      case "PlayAndRecord": return .playAndRecord
      case "MultiRoute": return .multiRoute
      default:
        throw AudioSessionError.invalidCategory(
          name: "INVALID_CATEGORY",
          message: "Unknown category: \(categoryName)"
        )
      }
    }()

    let mode: AVAudioSession.Mode? = try {
      switch modeName {
      case "Default": return .default
      case "VoiceChat": return .voiceChat
      case "VideoChat": return .videoChat
      case "GameChat": return .gameChat
      case "VideoRecording": return .videoRecording
      case "Measurement": return .measurement
      case "MoviePlayback": return .moviePlayback
      case "SpokenAudio": return .spokenAudio
      default:
        throw AudioSessionError.invalidMode(
          name: "INVALID_MODE",
          message: "Unknown mode: \(modeName)"
        )
      }
    }()

    let policy: AVAudioSession.RouteSharingPolicy = {
      switch policyName {
      case "LongFormAudio": return .longFormAudio
      case "LongFormVideo": return .longFormVideo
      case "Independent": return .independent
      default: return .default
      }
    }()

    var options: AVAudioSession.CategoryOptions = []
    for optionName in optionsArray {
      switch optionName {
      case "MixWithOthers":
        guard
          category == .playAndRecord || category == .playback || category == .multiRoute
            || category == .ambient
        else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "MixWithOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.mixWithOthers)
      case "AllowBluetooth":
        guard category == .playAndRecord || category == .record else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowBluetooth is not supported for category \(categoryName)"
          )
        }
        options.insert(.allowBluetooth)
      case "AllowBluetoothA2DP":
        guard
          category == .playAndRecord || category == .playback || category == .soloAmbient
            || category == .ambient
        else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowBluetoothA2DP is not supported for category \(categoryName)"
          )
        }
        options.insert(.allowBluetoothA2DP)
      case "AllowAirPlay":
        guard category == .playAndRecord else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowAirPlay is not supported for category \(categoryName)"
          )
        }
        options.insert(.allowAirPlay)
      case "DuckOthers":
        guard category == .playAndRecord || category == .playback || category == .multiRoute else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "DuckOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.duckOthers)
      case "DefaultToSpeaker":
        guard category == .playAndRecord else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "DefaultToSpeaker is not supported for category \(categoryName)"
          )
        }
        options.insert(.defaultToSpeaker)
      case "InterruptSpokenAudioAndMixWithOthers":
        guard category == .playAndRecord || category == .playback || category == .multiRoute else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message:
              "InterruptSpokenAudioAndMixWithOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.interruptSpokenAudioAndMixWithOthers)
      case "OverrideMutedMicrophoneInterruption":
        guard #available(iOS 16.0, *), category == .playAndRecord || category == .record else {
          throw AudioSessionError.invalidCategoryOption(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message:
              "OverrideMutedMicrophoneInterruption requires iOS 16.0+ and category PlayAndRecord or Record."
          )
        }
        options.insert(.overrideMutedMicrophoneInterruption)
      default:
        throw AudioSessionError.invalidCategoryOption(
          name: "INVALID_CATEGORY_OPTION",
          message: "Unknown category option: \(optionName)"
        )
      }
    }

    // MARK: - Set Category
    do {
      if let mode = mode {
        if !options.isEmpty {
          try audioSession.setCategory(category, mode: mode, policy: policy, options: options)
        } else {
          try audioSession.setCategory(category, mode: mode, policy: policy, options: [])
        }
      } else {
        if !options.isEmpty {
          try audioSession.setCategory(category, mode: .default, policy: policy, options: options)
        } else {
          try audioSession.setCategory(category, mode: .default, policy: policy, options: [])
        }
      }
    } catch {
      throw AudioSessionError.invalidConfiguration(
        name: "INVALID_CONFIGURATION",
        message: "Failed to set category: \(error.localizedDescription)"
      )
    }

    // MARK: - Additional Preferences
    do {
      try audioSession.setPrefersNoInterruptionsFromSystemAlerts(
        prefersNoInterruptionFromSystemAlerts)
    } catch {
      warningCallback(
        AudioSessionWarning(
          name: "PREFERENCE_FAILURE_NO_INTERRUPTIONS",
          message:
            "Failed to set prefersNoInterruptionsFromSystemAlerts: \(error.localizedDescription)"
        ))
    }

    do {
      try audioSession.setAllowHapticsAndSystemSoundsDuringRecording(
        allowHapticsAndSystemSoundsDuringRecording
      )
    } catch {
      warningCallback(
        AudioSessionWarning(
          name: "PREFERENCE_FAILURE_HAPTICS",
          message:
            "Failed to set allowHapticsAndSystemSoundsDuringRecording: \(error.localizedDescription)"
        ))
    }

    if #available(iOS 17.0, *) {
      do {
        try audioSession.setPrefersInterruptionOnRouteDisconnect(
          prefersInterruptionOnRouteDisconnect)
      } catch {
        warningCallback(
          AudioSessionWarning(
            name: "PREFERENCE_FAILURE_ROUTE_DISCONNECT",
            message:
              "Failed to set prefersInterruptionOnRouteDisconnect: \(error.localizedDescription)"
          ))
      }
    } else {
      warningCallback(
        AudioSessionWarning(
          name: "PREFERENCE_FAILURE_ROUTE_DISCONNECT",
          message: "Setting prefersInterruptionOnRouteDisconnect requires iOS 17 or later"
        )
      )
    }

    if prefersEchoCancelledInput {
      if #available(iOS 18.2, *) {
        if category != .playAndRecord {
          warningCallback(
            AudioSessionWarning(
              name: "PREFERENCE_WARNING_ECHO_CANCELLATION",
              message:
                "Setting prefersEchoCancelledInput requires category PlayAndRecord, but found \(categoryName)"
            )
          )
        } else if mode != .default {
          warningCallback(
            AudioSessionWarning(
              name: "PREFERENCE_WARNING_ECHO_CANCELLATION",
              message:
                "Setting prefersEchoCancelledInput requires mode Default, but found \(modeName)"
            )
          )
        } else if !audioSession.isEchoCancelledInputAvailable {
          warningCallback(
            AudioSessionWarning(
              name: "PREFERENCE_WARNING_ECHO_CANCELLATION",
              message:
                "Setting prefersEchoCancelledInput requires hardware support for echo cancellation, which is not available on this device"
            )
          )
        } else {
          do {
            try audioSession.setPrefersEchoCancelledInput(prefersEchoCancelledInput)
          } catch {
            warningCallback(
              AudioSessionWarning(
                name: "PREFERENCE_WARNING_ECHO_CANCELLATION",
                message: "Failed to set prefersEchoCancelledInput: \(error.localizedDescription)"
              )
            )
          }
        }
      } else {
        warningCallback(
          AudioSessionWarning(
            name: "PREFERENCE_WARNING_ECHO_CANCELLATION",
            message: "Setting prefersEchoCancelledInput requires iOS 18.2 or later"
          )
        )
      }
    }
  }

  func configureAudioManager(
    focusGain: String,
    usage: String,
    contentType: String,
    willPauseWhenDucked: Bool,
    acceptsDelayedFocusGain: Bool
  ) {
    // no-op
  }

  // MARK - UTILS
  private func readableInterruptionReason(_ reason: AVAudioSession.InterruptionReason?)
    -> InterruptionReason
  {
    guard let reason = reason else {
      return .default
    }

    switch reason {
    case .builtInMicMuted:
      return .builtinmicmuted
    default:
      if #available(iOS 17.0, *), reason == .routeDisconnected {
        return .routedisconnected
      }
      return .default
    }
  }

  private func readableRouteChangeReason(_ reason: AVAudioSession.RouteChangeReason?)
    -> RouteChangeReason
  {
    if reason == .routeConfigurationChange {
      return .routeconfigurationchange
    } else if reason == .newDeviceAvailable {
      return .newdeviceavailable
    } else if reason == .oldDeviceUnavailable {
      return .olddeviceunavailable
    } else if reason == .categoryChange {
      return .categorychange
    } else if reason == .override {
      return .override
    } else if reason == .wakeFromSleep {
      return .wakefromsleep
    } else if reason == .noSuitableRouteForCategory {
      return .nosuitablerouteforcategory
    } else {
      return .unknown
    }
  }

  private func readablePortType(for port: AVAudioSession.Port) -> PortType {
    switch port {
    case .builtInMic:
      return .builtinmic
    case .headsetMic:
      return .headsetmic
    case .lineIn:
      return .linein
    case .airPlay:
      return .airplay
    case .bluetoothA2DP:
      return .bluetootha2dp
    case .bluetoothLE:
      return .bluetoothle
    case .builtInReceiver:
      return .builtinreceiver
    case .builtInSpeaker:
      return .builtinspeaker
    case .HDMI:
      return .hdmi
    case .headphones:
      return .headphones
    case .lineOut:
      return .lineout
    case .AVB:
      return .avb
    case .PCI:
      return .pci
    case .bluetoothHFP:
      return .bluetoothhfp
    case .carAudio:
      return .caraudio
    case .displayPort:
      return .displayport
    case .fireWire:
      return .firewire
    case .thunderbolt:
      return .thunderbolt
    case .usbAudio:
      return .usbaudio
    case .virtual:
      return .virtual

    default:
      if #available(iOS 17.0, *), port == .continuityMicrophone {
        return .continuitymicrophone
      }
      return .unknown
    }
  }

  private func readableCategory(_ category: AVAudioSession.Category) -> AudioSessionCategory {
    if category == .ambient {
      return .ambient
    } else if category == .soloAmbient {
      return .soloambient
    } else if category == .playback {
      return .playback
    } else if category == .record {
      return .record
    } else if category == .playAndRecord {
      return .playandrecord
    } else {
      return .multiroute
    }
  }

  private func readableMode(_ mode: AVAudioSession.Mode) -> AudioSessionMode {
    if mode == .default {
      return .default
    } else if mode == .voiceChat {
      return .voicechat
    } else if mode == .videoChat {
      return .videochat
    } else if mode == .gameChat {
      return .gamechat
    } else if mode == .videoRecording {
      return .videorecording
    } else if mode == .measurement {
      return .measurement
    } else if mode == .moviePlayback {
      return .movieplayback
    } else if mode == .spokenAudio {
      return .spokenaudio
    } else {
      return .voiceprompt
    }
  }

  private func readableRouteSharingPolicy(_ routeSharingPolicy: AVAudioSession.RouteSharingPolicy)
    -> AudioSessionRouteSharingPolicy
  {
    if routeSharingPolicy == .default {
      return .default
    } else if routeSharingPolicy == .longFormVideo {
      return .longformvideo
    } else if routeSharingPolicy == .longFormAudio {
      return .longformaudio
    } else {
      return .independent
    }
  }

  private func readableCategoryOptions(_ options: AVAudioSession.CategoryOptions)
    -> [AudioSessionCategoryOptions]
  {
    var result: [AudioSessionCategoryOptions] = []

    if options.contains(.mixWithOthers) {
      result.append(.mixwithothers)
    }
    if options.contains(.duckOthers) {
      result.append(.duckothers)
    }
    if options.contains(.allowBluetooth) {
      result.append(.allowbluetooth)
    }
    if options.contains(.allowBluetoothA2DP) {
      result.append(.allowbluetootha2dp)
    }
    if options.contains(.allowAirPlay) {
      result.append(.allowairplay)
    }
    if options.contains(.defaultToSpeaker) {
      result.append(.defaulttospeaker)
    }
    if options.contains(.interruptSpokenAudioAndMixWithOthers) {
      result.append(.interruptspokenaudioandmixwithothers)
    }
    if options.contains(.overrideMutedMicrophoneInterruption) {
      result.append(.overridemutedmicrophoneinterruption)
    }
    return result
  }
}
