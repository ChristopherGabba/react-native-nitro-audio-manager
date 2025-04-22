package com.margelo.nitro.audiomanager

import android.os.Build
import com.facebook.proguard.annotations.DoNotStrip
import android.media.AudioManager as SysAudioManager
import com.margelo.nitro.NitroModules
import android.content.Context
import com.margelo.nitro.core.*
import android.util.Log

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

  override fun getSystemVolume(): Double {
    val current = am.getStreamVolume(SysAudioManager.STREAM_MUSIC)
    val max     = am.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)
    return if (max > 0) current.toDouble() / max.toDouble() else 0.0
  }


  override fun activate(): Promise<Unit> = Promise.async {
    // no-op
  }

  override fun deactivate(restorePreviousSessionOnDeactivation: Boolean): Promise<Unit> = Promise.async {
    // no-op
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

  override fun getAvailableInputs(): Array<PortDescription> = arrayOf()

  override fun getCurrentInputRoutes(): Array<PortDescription> = arrayOf()

  override fun getCurrentOutputRoutes(): Array<PortDescription> = arrayOf()

  override fun forceOutputToSpeaker() { }

  override fun cancelForcedOutputToSpeaker() { }

  override fun addInterruptionListener(callback: (InterruptionEvent) -> Unit): Double = 0.0

  override fun removeInterruptionListeners(id: Double) { }

  override fun addRouteChangeListener(callback: (RouteChangeEvent) -> Unit): Double = 0.0

  override fun removeRouteChangeListeners(id: Double) { }

  override fun isWiredHeadphonesConnected(): Boolean = false

  override fun isBluetoothHeadphonesConnected(): Boolean = false

  override fun getAudioSessionStatus(): AudioSessionStatus = AudioSessionStatus(
    category = AudioSessionCategory.AMBIENT,
    mode = AudioSessionMode.DEFAULT,
    categoryOptions = arrayOf(),
    routeSharingPolicy = AudioSessionRouteSharingPolicy.DEFAULT,
    isOutputtingAudioElsewhere = false,
    allowHapticsAndSystemSoundsDuringRecording = false,
    prefersNoInterruptionsFromSystemAlerts = false,
    prefersInterruptionOnRouteDisconnect = false,
    isEchoCancelledInputEnabled = false,
    isEchoCancelledInputAvailable = false
  )

  override fun configureAudioSession(
    category: String,
    mode: String,
    policy: String,
    categoryOptions: Array<String>,
    prefersNoInterruptionFromSystemAlerts: Boolean,
    prefersInterruptionOnRouteDisconnect: Boolean,
    allowHapticsAndSystemSoundsDuringRecording: Boolean,
    prefersEchoCancelledInput: Boolean
  ) {
    // Configure session here or leave no-op for now
  }
}
