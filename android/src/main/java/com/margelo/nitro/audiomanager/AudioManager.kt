package com.margelo.nitro.audiomanager

import android.os.Build
import com.facebook.proguard.annotations.DoNotStrip
import android.media.AudioManager as SysAudioManager
import android.media.AudioDeviceInfo
import android.media.AudioDeviceCallback
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import com.margelo.nitro.NitroModules
import android.content.Context
import com.margelo.nitro.core.*
import android.util.Log
import kotlin.math.roundToInt

data class Listener<T>(
  val id: Double,
  val callback: T
)

@DoNotStrip
class AudioManager : HybridAudioManagerSpec() {

  companion object {
    private const val TAG = "AudioManager"
  }

  private lateinit var am: SysAudioManager

  init {
    NitroModules.applicationContext?.let { ctx ->
      am = ctx.getSystemService(Context.AUDIO_SERVICE) as SysAudioManager
      Log.d(TAG, "AudioManager initialized via init{}")
    } ?: run {
      Log.e(TAG, "AudioManager: applicationContext was null")
    }
  }

  private val interruptionListeners = mutableListOf<Listener<(InterruptionEvent) -> Unit>>()
  private val routeChangeListeners = mutableListOf<Listener<(RouteChangeEvent) -> Unit>>()
  private val volumeListeners = mutableListOf<Listener<(Double) -> Unit>>()
  private var volumeReceiver: VolumeReceiver? = null

  private var nextListenerId = 0.0

  private var lastRoute: Array<PortDescription> = emptyArray()
  private var currentFocusRequest: AudioFocusRequest? = null
  private var hasAudioFocus: Boolean = false
  private var focusGainType: Int = SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
  private var usage: Int         = AudioAttributes.USAGE_MEDIA
  private var contentType: Int   = AudioAttributes.CONTENT_TYPE_MUSIC
  private var willPauseWhenDucked: Boolean    = true
  private var acceptsDelayedFocusGain: Boolean = false



  private val focusCallback = SysAudioManager.OnAudioFocusChangeListener { focus ->
    val type = when (focus) {
        SysAudioManager.AUDIOFOCUS_LOSS,
        SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
            hasAudioFocus = false
            InterruptionType.BEGAN
        }
        SysAudioManager.AUDIOFOCUS_GAIN,
        SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
        SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK,
        SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE -> {
            hasAudioFocus = true
            InterruptionType.ENDED
        }
        else -> {
            hasAudioFocus = false
            InterruptionType.BEGAN
        }
    }

    val reason = when (focus) {
        SysAudioManager.AUDIOFOCUS_LOSS,
        SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
        SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> InterruptionReason.APPWASSUSPENDED
        else -> InterruptionReason.DEFAULT
    }

    val ev = InterruptionEvent(type, reason)
    interruptionListeners.forEach { it.callback(ev) }
  }

  private val deviceCallback = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) {
      dispatchRouteChange(RouteChangeReason.NEWDEVICEAVAILABLE)
    }
    override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) {
      dispatchRouteChange(RouteChangeReason.OLDDEVICEUNAVAILABLE)
    }
  }

  override fun addInterruptionListener(callback: (InterruptionEvent) -> Unit): Double {
    if (interruptionListeners.isEmpty()) {
      am.requestAudioFocus(
        focusCallback,
        SysAudioManager.STREAM_MUSIC,
        SysAudioManager.AUDIOFOCUS_GAIN
      )
    }
    val id = nextListenerId++
    interruptionListeners += Listener(id, callback)
    return id
  }

  override fun removeInterruptionListener(id: Double) {
    interruptionListeners.removeAll { it.id == id }
  }

  override fun addRouteChangeListener(callback: (RouteChangeEvent) -> Unit): Double {
    if (routeChangeListeners.isEmpty()) {
      lastRoute = am
        .getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
        .map { mapToPort(it) }
        .toTypedArray()

      am.registerAudioDeviceCallback(deviceCallback, null)
    }
    val id = nextListenerId++
    routeChangeListeners += Listener(id, callback)
    return id
  }

  override fun removeRouteChangeListener(id: Double) {
    routeChangeListeners.removeAll { it.id == id }
    if (routeChangeListeners.isEmpty()) {
      am.unregisterAudioDeviceCallback(deviceCallback)
      lastRoute = emptyArray()
    }
  }

  private fun dispatchRouteChange(reason: RouteChangeReason) {
    val currentRoute = am
      .getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
      .map { mapToPort(it) }
      .toTypedArray()

    val ev = RouteChangeEvent(
      prevRoute    = lastRoute,
      currentRoute = currentRoute,
      reason       = reason
    )

    lastRoute = currentRoute

    routeChangeListeners.forEach { it.callback(ev) }
  }

  private inner class VolumeReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: android.content.Intent?) {
        if (intent?.action == "android.media.VOLUME_CHANGED_ACTION") {
            val current = am.getStreamVolume(SysAudioManager.STREAM_MUSIC)
            val max = am.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)
            val normalized = if (max > 0) current.toDouble() / max.toDouble() else 0.0
            volumeListeners.forEach { it.callback(normalized) }
        }
    }
  }


  override fun addVolumeListener(callback: (Double) -> Unit): Double {
    if (volumeListeners.isEmpty()) {
        volumeReceiver = VolumeReceiver()
        NitroModules.applicationContext?.registerReceiver(
            volumeReceiver,
            android.content.IntentFilter("android.media.VOLUME_CHANGED_ACTION")
        )
    }
    val id = nextListenerId++
    volumeListeners += Listener(id, callback)
    return id
  }


  override fun removeVolumeListener(id: Double) {
    volumeListeners.removeAll { it.id == id }
    if (volumeListeners.isEmpty()) {
        volumeReceiver?.let { receiver ->
            NitroModules.applicationContext?.unregisterReceiver(receiver)
            volumeReceiver = null
        }
    }
  }

  override fun getSystemVolume(): Double {
      val current = am.getStreamVolume(SysAudioManager.STREAM_MUSIC)
      val max = am.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)
      return if (max > 0) current.toDouble() / max.toDouble() else 0.0
  }

  override fun setSystemVolume(value: Double, showUI: Boolean): Promise<Unit> = Promise.async {
    val maxVolume = am.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)
    val newVolume = (value.coerceIn(0.0, 1.0) * maxVolume).roundToInt()

    val flags = if (showUI) {
        SysAudioManager.FLAG_SHOW_UI
    } else {
        0
    }

    am.setStreamVolume(
        SysAudioManager.STREAM_MUSIC,
        newVolume,
        flags
    )
}

  override fun isActive(): Boolean {
    return hasAudioFocus
  }

  override fun activate(warningCallback: (AudioSessionWarning) -> Unit): Promise<Unit> = Promise.async {
      if (currentFocusRequest == null) {

        val attrs = AudioAttributes.Builder()
          .setUsage(usage)
          .setContentType(contentType)
          .build()

        currentFocusRequest = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          AudioFocusRequest.Builder(focusGainType)
            .setAudioAttributes(attrs)
            .setWillPauseWhenDucked(willPauseWhenDucked)
            .setAcceptsDelayedFocusGain(acceptsDelayedFocusGain)
            .setOnAudioFocusChangeListener(focusCallback)
            .build()
        } else null
      }

      val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && currentFocusRequest != null) {
        am.requestAudioFocus(currentFocusRequest!!)
      } else {
        // For older APIs, fallback to the deprecated method
        @Suppress("DEPRECATION")
        am.requestAudioFocus(
          focusCallback,
          SysAudioManager.STREAM_MUSIC,
          focusGainType
        )
      }

      if (result != SysAudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
        throw Exception("Audio focus request failed: $result")
      }
  }

  override fun deactivate(
    restorePreviousSessionOnDeactivation: Boolean,
    fallbackToAmbientCategoryAndLeaveActiveForVolumeListener: Boolean,
    warningCallback: (AudioSessionWarning
    ) -> Unit): Promise<Unit> = Promise.async {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && currentFocusRequest != null) {
        am.abandonAudioFocusRequest(currentFocusRequest!!)
      } else {
        @Suppress("DEPRECATION")
        am.abandonAudioFocus(focusCallback)
      }
  }

  /**
   * Returns the buffer‑size / sample‑rate = seconds of latency per buffer.
   * E.g. 256 frames @ 48 000 Hz ≈ 5.3 ms = 0.0053 s
   */
  override fun getOutputLatency(): Double {
    val srStr    = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
    val bufStr   = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)

    if (srStr == null || bufStr == null) {
      Log.w(TAG, "Output latency props unavailable")
      return -1.0
    }

    val sampleRate     = srStr.toIntOrNull() ?: return -1.0
    val framesPerBuf   = bufStr.toIntOrNull() ?: return -1.0

    return framesPerBuf.toDouble() / sampleRate.toDouble()
  }

  /**
   * On Android S+ you can query the input buffer size; on older releases it’s not exposed.
   */
  override fun getInputLatency(): Double {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val inFramesStr = am.getProperty("android.media.property.INPUT_FRAMES_PER_BUFFER")
      val srStr       = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
      val inFrames    = inFramesStr?.toIntOrNull() ?: return -1.0
      val sr          = srStr?.toIntOrNull()      ?: return -1.0
      return inFrames.toDouble() / sr.toDouble()
    }
    // Property not computable in older versions
    return -1.0
  }

  private fun mapToPort(device: AudioDeviceInfo): PortDescription {
    val type = when (device.type) {
      AudioDeviceInfo.TYPE_BUILTIN_MIC             -> PortType.BUILTINMIC
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES        -> PortType.HEADSETMIC
      AudioDeviceInfo.TYPE_LINE_ANALOG,
      AudioDeviceInfo.TYPE_LINE_DIGITAL            -> PortType.LINEIN

      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP          -> PortType.BLUETOOTHA2DP
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO           -> PortType.BLUETOOTHHFP
      AudioDeviceInfo.TYPE_HEARING_AID,
      AudioDeviceInfo.TYPE_BLE_HEADSET,
      AudioDeviceInfo.TYPE_BLE_SPEAKER,
      AudioDeviceInfo.TYPE_BLE_BROADCAST           -> PortType.BLUETOOTHLE

      AudioDeviceInfo.TYPE_HDMI                    -> PortType.HDMI
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_HEADSET             -> PortType.USBAUDIO

      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER         -> PortType.BUILTINSPEAKER
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
      AudioDeviceInfo.TYPE_TELEPHONY               -> PortType.BUILTINRECEIVER

      else                                         -> PortType.UNKNOWN
    }

    return PortDescription(
      portName               = device.productName?.toString() ?: "Unknown",
      portType               = type,
      uid = device.id.toString(),
      channels = device.channelCounts.takeIf { it.isNotEmpty() }?.map { it.toDouble() }?.toDoubleArray(),
      isDataSourceSupported = true,
      selectedDataSourceId = null
    )
  }

  private fun isBluetoothOutput(device: AudioDeviceInfo): Boolean {
    return when (device.type) {
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
      AudioDeviceInfo.TYPE_HEARING_AID,
      AudioDeviceInfo.TYPE_BLE_HEADSET,
      AudioDeviceInfo.TYPE_BLE_SPEAKER,
      AudioDeviceInfo.TYPE_BLE_BROADCAST -> true
      else -> false
    }
  }

  private fun isWiredOutput(device: AudioDeviceInfo): Boolean {
    return when (device.type) {
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_USB_DEVICE -> true
      else -> false
    }
  }

  private fun getRoutedOutputFromAttributes(): AudioDeviceInfo? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
      return null
    }

    val attributes = AudioAttributes.Builder()
      .setUsage(usage)
      .setContentType(contentType)
      .build()

    return am.getAudioDevicesForAttributes(attributes)
      .firstOrNull { it.isSink }
  }

  override fun getCategoryCompatibleInputs(): Array<PortDescription> {
    // no op
    return arrayOf()
  }

  override fun getCurrentInputRoutes(): Array<PortDescription> {

    val inputs = am.getDevices(SysAudioManager.GET_DEVICES_INPUTS)

    val active: AudioDeviceInfo? = when {
      @Suppress("DEPRECATION")
      am.isWiredHeadsetOn -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
      }

      @Suppress("DEPRECATION")
      am.isBluetoothScoOn -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
      }

      else -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_MIC
      }
    }

    val chosen = active ?: inputs.firstOrNull()

    return active
      ?.let { arrayOf(mapToPort(it)) }
      ?: arrayOf()
  }

  override fun getCurrentOutputRoutes(): Array<PortDescription>  {
    val outputs = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)

    val activeFromAttributes = getRoutedOutputFromAttributes()

    val activeFromCommunicationDevice: AudioDeviceInfo? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.communicationDevice?.takeIf { it.isSink }
      } else {
        null
      }

    val activeFromLegacyFlags: AudioDeviceInfo? = when {
      @Suppress("DEPRECATION")
      am.isBluetoothA2dpOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
      }

      @Suppress("DEPRECATION")
      am.isWiredHeadsetOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET
      }

      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
      }

      else -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
        it.type == AudioDeviceInfo.TYPE_TELEPHONY
      }
    }

    val active = activeFromAttributes
      ?: activeFromCommunicationDevice
      ?: activeFromLegacyFlags
      ?: outputs.firstOrNull { isBluetoothOutput(it) }
      ?: outputs.firstOrNull { isWiredOutput(it) }
      ?: outputs.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
      ?: outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
        it.type == AudioDeviceInfo.TYPE_TELEPHONY
      }
      ?: outputs.firstOrNull()

    return active
      ?.let { arrayOf(mapToPort(it)) }
      ?: arrayOf()
  }

  override fun forceOutputToSpeaker(warningCallback: (AudioSessionWarning) -> Unit) {
    // no op
  }

  override fun cancelForcedOutputToSpeaker() {
    // no op
  }

  override fun isWiredHeadphonesConnected(): Boolean {
    val outputs: Array<AudioDeviceInfo> = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
    return outputs.any { device ->
      device.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
      device.type == AudioDeviceInfo.TYPE_WIRED_HEADSET
    }
  }

  override fun isBluetoothHeadphonesConnected(): Boolean {
    val outputs: Array<AudioDeviceInfo> = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
    return outputs.any { device ->
      device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
      device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  override fun getAudioSessionStatusIOS(): AudioSessionStatus? {
    // no-op
    return null
  }

  override fun getAudioManagerStatusAndroid(): AudioManagerStatus? {
    val mode = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
        am.mode == SysAudioManager.MODE_CALL_SCREENING ->
          AudioMode.CALLSCREENING
      am.mode == SysAudioManager.MODE_RINGTONE ->
          AudioMode.RINGTONE
      am.mode == SysAudioManager.MODE_IN_CALL ->
          AudioMode.INCALL
      am.mode == SysAudioManager.MODE_IN_COMMUNICATION ->
          AudioMode.INCOMMUNICATION
      else ->
          AudioMode.NORMAL
    }

    val ringer = when (am.ringerMode) {
      SysAudioManager.RINGER_MODE_SILENT  -> RingerMode.SILENT
      SysAudioManager.RINGER_MODE_VIBRATE -> RingerMode.VIBRATE
      else                                -> RingerMode.NORMAL
    }

    val focusGainEnum = when (focusGainType) {
      SysAudioManager.AUDIOFOCUS_GAIN                        -> AudioFocusGainType.GAIN
      SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT              -> AudioFocusGainType.GAINTRANSIENT
      SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK     -> AudioFocusGainType.GAINTRANSIENTMAYDUCK
      SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE    -> AudioFocusGainType.GAINTRANSIENTEXCLUSIVE
      else                                                   -> AudioFocusGainType.GAIN
    }

    val usageEnum = when (usage) {
      AudioAttributes.USAGE_ALARM                             -> AudioUsage.ALARM
      AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY           -> AudioUsage.ASSISTANCEACCESSIBILITY
      AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE     -> AudioUsage.ASSISTANCENAVIGATIONGUIDANCE
      AudioAttributes.USAGE_ASSISTANCE_SONIFICATION            -> AudioUsage.ASSISTANCESONIFICATION
      AudioAttributes.USAGE_ASSISTANT                          -> AudioUsage.ASSISTANT
      AudioAttributes.USAGE_GAME                               -> AudioUsage.GAME
      AudioAttributes.USAGE_MEDIA                              -> AudioUsage.MEDIA
      AudioAttributes.USAGE_NOTIFICATION                       -> AudioUsage.NOTIFICATION
      AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_DELAYED,
      AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT,
      AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_REQUEST -> AudioUsage.NOTIFICATION
      AudioAttributes.USAGE_NOTIFICATION_EVENT                 -> AudioUsage.NOTIFICATIONEVENT
      AudioAttributes.USAGE_NOTIFICATION_RINGTONE              -> AudioUsage.NOTIFICATIONRINGTONE
      AudioAttributes.USAGE_UNKNOWN                            -> AudioUsage.UNKNOWN
      AudioAttributes.USAGE_VOICE_COMMUNICATION                 -> AudioUsage.VOICECOMMUNICATION
      AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING      -> AudioUsage.VOICECOMMUNICATIONSIGNALLING
      else                                                    -> AudioUsage.UNKNOWN
    }

    val contentEnum = when (contentType) {
      AudioAttributes.CONTENT_TYPE_MOVIE        -> AudioContentType.MOVIE
      AudioAttributes.CONTENT_TYPE_MUSIC        -> AudioContentType.MUSIC
      AudioAttributes.CONTENT_TYPE_SONIFICATION -> AudioContentType.SONIFICATION
      AudioAttributes.CONTENT_TYPE_SPEECH       -> AudioContentType.SPEECH
      AudioAttributes.CONTENT_TYPE_UNKNOWN      -> AudioContentType.UNKNOWN
      else                                      -> AudioContentType.UNKNOWN
    }

    return AudioManagerStatus(
      mode                   = mode,
      ringerMode             = ringer,
      focusGain              = focusGainEnum,
      usage                  = usageEnum,
      contentType            = contentEnum,
      willPauseWhenDucked    = willPauseWhenDucked,
      acceptsDelayedFocusGain= acceptsDelayedFocusGain
    )
  }

  override fun configureAudioSession(
    category: String,
    mode: String,
    policy: String,
    categoryOptions: Array<String>,
    prefersNoInterruptionFromSystemAlerts: Boolean,
    prefersInterruptionOnRouteDisconnect: Boolean,
    allowHapticsAndSystemSoundsDuringRecording: Boolean,
    prefersEchoCancelledInput: Boolean,
    warningCallback: (AudioSessionWarning) -> Unit
  ) {
    // no-op
  }

  override fun configureAudioManager(
    focusGain: String,
    usage: String,
    contentType: String,
    willPauseWhenDucked: Boolean,
    acceptsDelayedFocusGain: Boolean
  ): Unit {
    focusGainType = when (focusGain) {
      "GAIN"                    -> SysAudioManager.AUDIOFOCUS_GAIN
      "GAIN_TRANSIENT"          -> SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT
      "GAIN_TRANSIENT_MAY_DUCK" -> SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
      "GAIN_TRANSIENT_EXCLUSIVE"-> SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE
      "GAIN_TRANSIENT_ALLOW_PAUSE" ->
        SysAudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
      else -> SysAudioManager.AUDIOFOCUS_GAIN
    }

    this.usage = when (usage) {
      "USAGE_GAME"                -> AudioAttributes.USAGE_GAME
      "USAGE_VOICE_COMMUNICATION" -> AudioAttributes.USAGE_VOICE_COMMUNICATION
      "USAGE_ALARM"               -> AudioAttributes.USAGE_ALARM
      "USAGE_NOTIFICATION"        -> AudioAttributes.USAGE_NOTIFICATION
      else                        -> AudioAttributes.USAGE_MEDIA
    }

    this.contentType = when (contentType) {
      "CONTENT_TYPE_SPEECH"      -> AudioAttributes.CONTENT_TYPE_SPEECH
      "CONTENT_TYPE_MOVIE"       -> AudioAttributes.CONTENT_TYPE_MOVIE
      "CONTENT_TYPE_SONIFICATION"-> AudioAttributes.CONTENT_TYPE_SONIFICATION
      else                       -> AudioAttributes.CONTENT_TYPE_MUSIC
    }

    // direct assignment now that both sides are non-nullable
    this.willPauseWhenDucked     = willPauseWhenDucked
    this.acceptsDelayedFocusGain = acceptsDelayedFocusGain
  }
}
