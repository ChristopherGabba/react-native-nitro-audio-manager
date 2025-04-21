package com.margelo.nitro.audiomanager

import com.facebook.proguard.annotations.DoNotStrip
import android.media.AudioManager
import android.content.Context

@DoNotStrip
class AudioManager (
  private val context: Context
  ) : HybridAudioManagerSpec() {

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  override fun getSystemVolume(): Double {
    val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    return if (max > 0) {
      current.toDouble() / max.toDouble()
    } else {
      0.0
    }
  }
}
