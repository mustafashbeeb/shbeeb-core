package com.anythingllm.storage

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.*
import java.util.Locale

/** Explicit tap-to-read only. Uses the user's Android speech engine; never auto-records. */
class CoreSpeechModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val main = Handler(Looper.getMainLooper())
    private var engine: TextToSpeech? = null
    private var ready = false
    private var pending: Promise? = null
    private var sequence = 0L
    override fun getName() = "CoreSpeech"
    @ReactMethod fun stop(promise: Promise) { main.post { engine?.stop(); pending?.resolve(false); pending = null; promise.resolve(true) } }
    @ReactMethod fun speak(text: String, promise: Promise) { main.post {
        engine?.stop(); pending?.resolve(false); pending = promise
        if (engine == null) {
            engine = TextToSpeech(context) { status -> main.post {
                ready = status == TextToSpeech.SUCCESS
                if (!ready) fail("تعذّر تشغيل محرك الصوت في أندرويد") else read(text)
            } }
        } else if (ready) read(text) else fail("محرك الصوت لم يجهز بعد؛ أعد المحاولة")
    } }
    private fun fail(message: String) { pending?.reject("SPEECH_FAILED", message); pending = null }
    private fun read(text: String) {
        val tts = engine ?: return fail("محرك الصوت غير متاح")
        if (text.isBlank()) return fail("لا يوجد نص للقراءة")
        if (tts.setLanguage(Locale("ar")) < TextToSpeech.LANG_AVAILABLE) return fail("ثبّت صوتاً عربياً من إعدادات تحويل النص إلى كلام في هاتفك")
        // Prefer an installed offline Arabic voice when the system offers one.
        tts.voices?.firstOrNull { it.locale.language == "ar" && !it.isNetworkConnectionRequired }?.let { tts.voice = it }
        val id = (++sequence).toString()
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { if (utteranceId == id) main.post { pending?.resolve(true); pending = null } }
            @Deprecated("Android callback") override fun onError(utteranceId: String?) { if (utteranceId == id || utteranceId?.startsWith("$id-") == true) main.post { fail("تعذّرت قراءة الرد؛ تحقق من محرك الصوت العربي") } }
        })
        val chunks = text.chunked(3000)
        for ((index, chunk) in chunks.withIndex()) {
            val result = tts.speak(chunk, if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, if (index == chunks.lastIndex) id else "$id-$index")
            if (result == TextToSpeech.ERROR) { tts.stop(); return fail("محرك الصوت رفض النص") }
        }
    }
    override fun invalidate() { main.post { engine?.stop(); engine?.shutdown(); engine = null; pending?.resolve(false); pending = null }; super.invalidate() }
}
