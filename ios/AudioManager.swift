import AVFoundation
import NitroModules

typealias InterruptionListener = (InterruptionEvent) -> Void
typealias RouteChangeListener = (RouteChangeEvent) -> Void

struct Listener<T> {
  let id: Double
  let callback: T
}

class AudioManager: HybridAudioManagerSpec {

  private var interruptionListeners: [Listener<InterruptionListener>] = []
  private var routeChangeListeners: [Listener<RouteChangeListener>] = []
  private var nextListenerId: Double = 0

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

    interruptionListeners.removeAll()
    routeChangeListeners.removeAll()
  }

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

  @objc private func handleInterruption(_ note: Notification) {

    guard
      let userInfo = note.userInfo,
      let rawReason = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
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

    let currentRoute = AVAudioSession.sharedInstance().currentRoute
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

  public func isWiredHeadphonesConnected() -> Bool {
    return AVAudioSession.sharedInstance().currentRoute.outputs.contains { $0.portType == .headphones }
  }

  public func isBluetoothHeadphonesConnected() -> Bool {
    return AVAudioSession.sharedInstance().currentRoute.outputs.contains { port in
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

  private func readablePortType(for port: AVAudioSession.Port) -> String {
    switch port {
    case .builtInMic:
      return "BuiltInMicrophone"
    case .headsetMic:
      return "HeadsetMicrophone"
    case .lineIn:
      return "LineIn"
    case .airPlay:
      return "AirPlay"
    case .bluetoothA2DP:
      return "BluetoothA2DP"
    case .bluetoothLE:
      return "BluetoothLE"
    case .builtInReceiver:
      return "BuiltInReceiver"
    case .builtInSpeaker:
      return "BuiltInSpeaker"
    case .HDMI:
      return "HDMI"
    case .headphones:
      return "Headphones"
    case .lineOut:
      return "LineOut"
    case .AVB:
      return "AVBDevice"
    case .PCI:
      return "PCIDevice"
    case .bluetoothHFP:
      return "BluetoothHFP"
    case .carAudio:
      return "CarAudio"
    case .displayPort:
      return "DisplayPort"
    case .fireWire:
      return "FireWire"
    case .thunderbolt:
      return "Thunderbolt"
    case .usbAudio:
      return "USBAudio"
    case .virtual:
      return "VirtualAudioDevice"

    default:
      if #available(iOS 17.0, *), port == .continuityMicrophone {
        return "ContinuityMicrophone"
      }
      return port.rawValue  // fallback for unknown/future ports
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

  public func getSystemVolume() throws -> Double {
    return Double(AVAudioSession.sharedInstance().outputVolume)
  }

  public func getInputLatency() throws -> Double {
    return Double(AVAudioSession.sharedInstance().inputLatency)
  }

  public func getOutputLatency() throws -> Double {
    return Double(AVAudioSession.sharedInstance().outputLatency)
  }

  public func getAvailableInputs() throws -> [PortDescription] {
    return (AVAudioSession.sharedInstance().availableInputs ?? []).map(serializePort)
  }

  public func getCurrentInputRoutes() throws -> [PortDescription] {
    return AVAudioSession.sharedInstance().currentRoute.inputs.map(serializePort)
  }

  public func getCurrentOutputRoutes() throws -> [PortDescription] {
    return AVAudioSession.sharedInstance().currentRoute.outputs.map(serializePort)
  }

  public func forceOutputToSpeaker() throws {
    let session = AVAudioSession.sharedInstance()

    if session.category != .playAndRecord {
      try session.setCategory(.playAndRecord, mode: .default, options: [])
    }

    do {
      try session.overrideOutputAudioPort(.speaker)
    } catch {
      throw RuntimeError.error(
        withMessage: "Failed to force output to speaker: \(error.localizedDescription)"
      )
    }
  }

  public func cancelForcedOutputToSpeaker() throws {
    let session = AVAudioSession.sharedInstance()

    do {
      try session.overrideOutputAudioPort(.none)
    } catch {
      throw RuntimeError.error(
        withMessage: "Failed to cancel speaker override: \(error.localizedDescription)"
      )
    }
  }

  public func activate() throws -> Promise<Void> {
    return Promise.async {
      do {
        try AVAudioSession.sharedInstance().setActive(true)
      } catch {
        throw RuntimeError.error(withMessage: "Failed to activate audio session")
      }
    }
  }

  public func deactivate(restorePreviousSessionOnDeactivation: Bool) throws -> Promise<Void> {
    var options: AVAudioSession.SetActiveOptions = []

    if restorePreviousSessionOnDeactivation {
      options.insert(.notifyOthersOnDeactivation)
    }

    return Promise.async {
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: options)
      } catch {
        throw RuntimeError.error(withMessage: "Failed to deactivate audio session")
      }
    }
  }

  public func getAudioSessionStatus() -> AudioSessionStatus {
    let session = AVAudioSession.sharedInstance()

    // ---- All of these come as Bitwise numbers that have to be converted to strings on the native side ----
    let category = readableCategory(session.category)
    let mode = readableMode(session.mode)
    let categoryOptions = readableCategoryOptions(session.categoryOptions)
    let routeSharingPolicy = readableRouteSharingPolicy(session.routeSharingPolicy)

    // ----------------------------------------------------------------
    let isOutputtingAudioElsewhere = session.isOtherAudioPlaying

    let allowHapticsAndSystemSoundsDuringRecording = session
      .allowHapticsAndSystemSoundsDuringRecording

    let prefersNoInterruptionsFromSystemAlerts = session.prefersNoInterruptionsFromSystemAlerts

    var prefersInterruptionOnRouteDisconnect = false
    if #available(iOS 17.0, *) {
      prefersInterruptionOnRouteDisconnect = session.prefersInterruptionOnRouteDisconnect
    }

    var isEchoCancelledInputAvailable = false
    var isEchoCancelledInputEnabled = false
    if #available(iOS 18.2, *) {
      isEchoCancelledInputAvailable = session.isEchoCancelledInputAvailable
      isEchoCancelledInputEnabled = session.isEchoCancelledInputEnabled
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
      isEchoCancelledInputAvailable: isEchoCancelledInputAvailable
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
    prefersEchoCancelledInput: Bool
  ) throws {
    let session = AVAudioSession.sharedInstance()
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
        throw RuntimeError.error(withMessage: "Invalid AVAudioSession category: \(categoryName)")
      }
    }()

    // MARK: - Map mode
    let mode: AVAudioSession.Mode? = {
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
        return .default
      }
    }()

    // MARK: - Map policy
    let policy: AVAudioSession.RouteSharingPolicy = {
      switch policyName {
      case "LongFormAudio": return .longFormAudio
      case "LongFormVideo": return .longFormVideo
      case "Independent": return .independent
      default:
        return .default
      }
    }()

    // MARK: - Map categoryOptions

    var options: AVAudioSession.CategoryOptions = []
    for optionName in optionsArray {
      switch optionName {
      case "MixWithOthers":
        options.insert(.mixWithOthers)
      case "AllowBluetooth":
        options.insert(.allowBluetooth)
      case "AllowBluetoothA2DP":
        options.insert(.allowBluetoothA2DP)
      case "AllowAirPlay":
        options.insert(.allowAirPlay)
      case "DuckOthers":
        options.insert(.duckOthers)
      case "DefaultToSpeaker":
        options.insert(.defaultToSpeaker)
      case "InterruptSpokenAudioAndMixWithOthers":
        options.insert(.interruptSpokenAudioAndMixWithOthers)
      case "OverrideMutedMicrophoneInterruption":
        options.insert(.overrideMutedMicrophoneInterruption)
      default:
        NSLog("Unknown AVAudioSession category option: %@", optionName)
        continue
      }
    }

    do {
      if let mode = mode {
        if !options.isEmpty {
          try session.setCategory(category, mode: mode, policy: policy, options: options)
        } else {
          try session.setCategory(category, mode: mode, policy: policy, options: [])
        }
      } else {
        if !options.isEmpty {
          try session.setCategory(category, mode: .default, policy: policy, options: options)
        } else {
          try session.setCategory(category, mode: .default, policy: policy, options: [])
        }
      }
    } catch {
      throw RuntimeError.error(
        withMessage: "Failed to configure AVAudioSession: \(error.localizedDescription)")
    }

    // MARK: - Additional Preferences
    do {
      try session.setPrefersNoInterruptionsFromSystemAlerts(prefersNoInterruptionFromSystemAlerts)
    } catch {
      NSLog("Failed to set prefersNoInterruptionsFromSystemAlerts: %@", error as NSError)
    }

    do {
      try session.setAllowHapticsAndSystemSoundsDuringRecording(
        allowHapticsAndSystemSoundsDuringRecording)
    } catch {
      NSLog("Failed to set allowHapticsAndSystemSoundsDuringRecording: %@", error as NSError)
    }

    if #available(iOS 17.0, *) {
      do {
        try session.setPrefersInterruptionOnRouteDisconnect(prefersInterruptionOnRouteDisconnect)
      } catch {
        NSLog("Failed to set prefersInterruptionOnRouteDisconnect: %@", error as NSError)
      }
    }

    if #available(iOS 18.2, *),
      category == .playAndRecord,
      mode == .default,
      session.isEchoCancelledInputAvailable
    {
      do {
        try session.setPrefersEchoCancelledInput(prefersEchoCancelledInput)
      } catch {
        NSLog("Failed to set prefersEchoCancelledInput: %@", error as NSError)
      }
    }
  }
}
