import AVFoundation
import Foundation
import MediaPlayer
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
  case error(name: String, message: String)
}

@objcMembers
class AudioManager: HybridAudioManagerSpec {

  // MARK: Initializations

  private var interruptionListeners: [Listener<InterruptionListener>] = []
  private var routeChangeListeners: [Listener<RouteChangeListener>] = []
  private var volumeListeners: [Listener<VolumeListener>] = []
  private var nextListenerId: Double = 0

  private let audioSession = AVAudioSession.sharedInstance()
  private var isSessionActive = false

  private var volumeObservation: NSKeyValueObservation?

  private var hiddenVolumeView: HiddenVolumeView?
  // MARK: Listeners

  override init() {
    super.init()
    registerListeners()
    initVolumeView()
  }

  deinit {
    unregisterListeners()
    removeVolumeView()
  }

  private func initVolumeView() {
    DispatchQueue.main.async { [weak self] in
      self?.hiddenVolumeView = HiddenVolumeView(frame: .zero)

      var keyWindow: UIWindow?
      let scenes = UIApplication.shared.connectedScenes
      if let windowScene = scenes.first(where: { $0.activationState == .foregroundActive })
        as? UIWindowScene
      {
        keyWindow = windowScene.windows.first(where: { $0.isKeyWindow })
      } else if let windowScene = scenes.first as? UIWindowScene {
        keyWindow = windowScene.windows.first(where: { $0.isKeyWindow })
      }

      if let window = keyWindow, let hiddenVolumeView = self?.hiddenVolumeView {
        window.addSubview(hiddenVolumeView)
        hiddenVolumeView.frame = CGRect(x: -2000, y: -2000, width: 1, height: 1)
        hiddenVolumeView.isHidden = true
      } else {
      }
    }
  }

  private func removeVolumeView() {
    DispatchQueue.main.async { [weak self] in
      self?.hiddenVolumeView?.removeFromSuperview()
      self?.hiddenVolumeView = nil
    }
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

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(reactivateSessionIfVolumeListenersAreActive),
      name: UIApplication.willEnterForegroundNotification,
      object: nil
    )

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification,
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

    NotificationCenter.default.removeObserver(
      self,
      name: UIApplication.willEnterForegroundNotification,
      object: nil
    )

    NotificationCenter.default.removeObserver(
      self,
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )

    volumeObservation?.invalidate()
    volumeObservation = nil

    interruptionListeners.removeAll()
    routeChangeListeners.removeAll()
    volumeListeners.removeAll()
  }

  // If volume listeners are active, they deactivate
  // When the app goes into background, we need to re-activate the session
  @objc private func reactivateSessionIfVolumeListenersAreActive(_ notification: Notification) {
    // Only activate if not already active
    if !isSessionActive && !volumeListeners.isEmpty {
      do {
        try audioSession.setActive(true)
        isSessionActive = true
      } catch {
        print("Failed to activate audio session on foreground: \(error.localizedDescription)")
      }
    }
  }

  @objc private func handleDidEnterBackground(_ notification: Notification) {
    isSessionActive = false
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

  func removeInterruptionListener(id: Double) throws {
    interruptionListeners.removeAll { $0.id == id }
  }

  func addRouteChangeListener(callback: @escaping RouteChangeListener) throws -> Double {
    let listener = Listener(id: nextListenerId, callback: callback)
    routeChangeListeners.append(listener)
    nextListenerId += 1
    return listener.id
  }

  func removeRouteChangeListener(id: Double) throws {
    routeChangeListeners.removeAll { $0.id == id }
  }

  func addVolumeListener(callback: @escaping VolumeListener) throws -> Double {
    if !isSessionActive {
      try? audioSession.setCategory(.ambient)
      try? audioSession.setActive(true)
      isSessionActive = true
    }

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

  // MARK: Methods

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

  public func getSystemVolume() throws -> Promise<Double> {
    return Promise.async {
      if let volume = await self.hiddenVolumeView?.getVolume() {
        return volume
      } else {
        // Fallback to AVAudioSession if HiddenVolumeView fails
        return Double(self.audioSession.outputVolume)
      }
    }

  }

  public func setSystemVolume(value: Double, showUI: Bool) throws -> Promise<Void> {
    return Promise.async {
      guard let hiddenVolumeView = self.hiddenVolumeView else {
        throw AudioSessionError.error(
          name: "FAILED_TO_SET_VOLUME",
          message: "MPVolumeView is not initialized or available."
        )
      }
      await hiddenVolumeView.setVolume(value)
    }

  }

  public func isActive() throws -> Bool {
    return isSessionActive
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

  public func forceOutputToSpeaker(warningCallback: @escaping WarningCallback) throws {
    if audioSession.category != .playAndRecord {
      warningCallback(
        AudioSessionWarning(
          name: "INCOMPATIBLE_CATEGORY",
          message: "Forcing output to speaker is only possible with category 'PlayAndRecord'"
        ))
      return
    }

    do {
      try audioSession.overrideOutputAudioPort(.speaker)
    } catch {
      throw AudioSessionError.error(
        name: "SPEAKER_OVERRIDE_FAILURE",
        message: "Failed to force output to speaker with: \(error.localizedDescription)"
      )
    }
  }

  public func cancelForcedOutputToSpeaker() throws {
    do {
      try audioSession.overrideOutputAudioPort(.none)
    } catch {
      throw AudioSessionError.error(
        name: "SPEAKER_OVERRIDE_CANCELLATION_FAILURE",
        message: "Failed to cancel speaker output with error: \(error.localizedDescription)"
      )
    }
  }

  public func activate(warningCallback: @escaping WarningCallback) throws -> Promise<Void> {
    return Promise.async {
      do {
        if !self.isSessionActive {
          try self.audioSession.setActive(true)
          self.isSessionActive = true
        } else {
          if self.volumeListeners.isEmpty {
            warningCallback(
              AudioSessionWarning(
                name: "MULTIPLE_ACTIVATION_WARNING",
                message:
                  "Activation function called while the session was already active. Did you mean to do this?"
              ))
          } else {
            warningCallback(
              AudioSessionWarning(
                name: "SESSION_ALREADY_ACTIVE_WITH_VOLUME_LISTENER",
                message:
                  "Warning Only: The audio session was already active with a volume listener."
              ))
          }

        }

      } catch {
        throw AudioSessionError.error(
          name: "ACTIVATION_FAILURE",
          message: "Failed to activate audio session with error: \(error.localizedDescription)"
        )
      }
    }
  }

  public func deactivate(
    restorePreviousSessionOnDeactivation: Bool,
    fallbackToAmbientCategoryAndLeaveActiveForVolumeListener: Bool,
    warningCallback: @escaping WarningCallback
  ) throws -> Promise<Void> {

    if fallbackToAmbientCategoryAndLeaveActiveForVolumeListener {
      return Promise.async {
        do {
          try self.audioSession.setCategory(
            .ambient, mode: .default, policy: .default, options: [.mixWithOthers])
        } catch {
          throw AudioSessionError.error(
            name: "DEACTIVATION_ERROR",
            message: "Failed to set AudioSession category to Ambient: \(error.localizedDescription)"
          )
        }
      }
    } else {
      var options: AVAudioSession.SetActiveOptions = []

      if restorePreviousSessionOnDeactivation {
        options.insert(.notifyOthersOnDeactivation)
      }

      return Promise.async {
        do {
          if self.isSessionActive {
            try self.audioSession.setActive(false, options: options)
            self.isSessionActive = false

          } else {
            warningCallback(
              AudioSessionWarning(
                name: "MULTIPLE_DEACTIVATION_WARNING",
                message:
                  "Deactivation function called while the session was already inactivate. Did you mean to do this?"
              ))
          }

        } catch {
          throw AudioSessionError.error(
            name: "DEACTIVATION_FAILURE",
            message: "Failed to deactivate audio session with error: \(error.localizedDescription)"
          )
        }
      }
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

    let category: AVAudioSession.Category = try {
      switch categoryName {
      case "Ambient": return .ambient
      case "SoloAmbient": return .soloAmbient
      case "Playback": return .playback
      case "Record": return .record
      case "PlayAndRecord": return .playAndRecord
      case "MultiRoute": return .multiRoute
      default:
        throw AudioSessionError.error(
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
        throw AudioSessionError.error(
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
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "MixWithOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.mixWithOthers)
      case "AllowBluetooth":
        guard category == .playAndRecord || category == .record else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowBluetooth is not supported for category \(categoryName)"
          )
        }
        options.insert(.allowBluetoothHFP)
      case "AllowBluetoothA2DP":
        if category == .playAndRecord {
          options.insert(.allowBluetoothA2DP)
        } else if category == .playback || category == .soloAmbient
          || category == .ambient
        {
          warningCallback(
            AudioSessionWarning(
              name: "OPTION_NOT_APPLIED",
              message:
                "AllowBluetoothA2DP is applied by default for category \(categoryName)."
            ))
        } else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowBluetoothA2DP is not supported for category \(categoryName)"
          )
        }

      case "AllowAirPlay":
        guard category == .playAndRecord else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "AllowAirPlay is not supported for category \(categoryName)"
          )
        }
        options.insert(.allowAirPlay)
      case "DuckOthers":
        guard category == .playAndRecord || category == .playback || category == .multiRoute else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "DuckOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.duckOthers)
      case "DefaultToSpeaker":
        guard category == .playAndRecord else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message: "DefaultToSpeaker is not supported for category \(categoryName)"
          )
        }
        options.insert(.defaultToSpeaker)
      case "InterruptSpokenAudioAndMixWithOthers":
        guard category == .playAndRecord || category == .playback || category == .multiRoute else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message:
              "InterruptSpokenAudioAndMixWithOthers is not supported for category \(categoryName)"
          )
        }
        options.insert(.interruptSpokenAudioAndMixWithOthers)
      case "OverrideMutedMicrophoneInterruption":
        guard #available(iOS 16.0, *), category == .playAndRecord || category == .record else {
          throw AudioSessionError.error(
            name: "UNSUPPORTED_CATEGORY_OPTION",
            message:
              "OverrideMutedMicrophoneInterruption requires iOS 16.0+ and category PlayAndRecord or Record."
          )
        }
        options.insert(.overrideMutedMicrophoneInterruption)
      default:
        throw AudioSessionError.error(
          name: "INVALID_CATEGORY_OPTION",
          message: "Unknown category option: \(optionName)"
        )
      }
    }

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
      throw AudioSessionError.error(
        name: "INVALID_CONFIGURATION",
        message: "Failed to set category: \(error.localizedDescription)"
      )
    }

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

  // MARK: - UTILS
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

  private func readableInterruptionReason(_ reason: AVAudioSession.InterruptionReason?)
    -> InterruptionReason
  {
    guard let reason = reason else {
      return .default
    }
    // sceneWasBackgrounded is relevent but it's only available on VisionOS.
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
    if options.contains(.allowBluetoothHFP) {
      result.append(.allowbluetoothHFP)
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
