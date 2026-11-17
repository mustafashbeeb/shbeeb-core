package com.anythingllm.storage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/** Streams large GGUF files through Android's document picker; never crosses the JS bridge with model bytes. */
class ModelExportModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    companion object { private const val REQUEST_EXPORT = 48127 }
    private data class Request(val source: File, val promise: Promise)
    private var pending: Request? = null
    private val busy = AtomicBoolean(false)

    init { reactContext.addActivityEventListener(this) }
    override fun getName() = "ModelExportModule"
    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun exportModel(sourcePath: String, promise: Promise) {
        if (!busy.compareAndSet(false, true)) {
            promise.reject("EXPORT_BUSY", "يوجد تصدير آخر قيد التنفيذ")
            return
        }
        try {
            val source = File(sourcePath).canonicalFile
            val root = File(reactContext.filesDir, "models/gguf").canonicalFile
            require(source.path.startsWith(root.path + File.separator)) { "مسار النموذج غير مسموح" }
            require(source.isFile && source.name.endsWith(".gguf", ignoreCase = true)) { "ملف النموذج غير موجود" }
            source.inputStream().use { input ->
                val magic = ByteArray(4)
                require(input.read(magic) == 4 && magic.contentEquals(byteArrayOf(71, 71, 85, 70))) { "الملف ليس نموذج GGUF صالحاً" }
            }
            val activity = reactContext.currentActivity ?: throw IllegalStateException("افتح التطبيق قبل تصدير النموذج")
            activity.runOnUiThread {
                try {
                    pending = Request(source, promise)
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/octet-stream"
                        putExtra(Intent.EXTRA_TITLE, source.name)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    }
                    activity.startActivityForResult(intent, REQUEST_EXPORT)
                } catch (error: Exception) {
                    pending = null
                    busy.set(false)
                    promise.reject("EXPORT_PICKER_FAILED", "تعذّر فتح نافذة حفظ الملف", error)
                }
            }
        } catch (error: Exception) {
            busy.set(false)
            promise.reject("EXPORT_INVALID_SOURCE", error.message ?: "تعذّر قراءة النموذج", error)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_EXPORT) return
        val request = pending ?: return
        pending = null
        if (resultCode != Activity.RESULT_OK) {
            busy.set(false)
            request.promise.resolve(Arguments.createMap().apply { putBoolean("cancelled", true) })
            return
        }
        val uri = data?.data
        if (uri == null) {
            busy.set(false)
            request.promise.reject("EXPORT_NO_DESTINATION", "لم يُحدّد ملف للحفظ")
            return
        }
        Thread({ copyAndVerify(request, uri) }, "GGUF-export").start()
    }

    private fun copyAndVerify(request: Request, uri: Uri) {
        val resolver = reactContext.contentResolver
        try {
            val verified = VerifiedModelCopy.copy(
                request.source,
                openOutput = { resolver.openOutputStream(uri, "w") ?: throw IllegalStateException("تعذّر فتح الملف للكتابة") },
                openInput = { resolver.openInputStream(uri) ?: throw IllegalStateException("تعذّر التحقق من الملف المحفوظ") },
            )
            var filename = request.source.name
            try {
                resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) filename = cursor.getString(0) ?: filename
                }
            } catch (_: Exception) { /* File name only; verified bytes are authoritative. */ }
            request.promise.resolve(Arguments.createMap().apply {
                putBoolean("cancelled", false)
                putString("uri", uri.toString())
                putString("filename", filename)
                putDouble("bytes", verified.bytes.toDouble())
                putString("sha256", verified.sha256)
            })
        } catch (error: Exception) {
            // ACTION_CREATE_DOCUMENT creates a new document. Remove only our failed export, never the source.
            try { DocumentsContract.deleteDocument(resolver, uri) } catch (_: Exception) {}
            request.promise.reject("EXPORT_COPY_FAILED", error.message ?: "تعذّر تصدير النموذج؛ الأصل محفوظ داخل التطبيق", error)
        } finally {
            busy.set(false)
        }
    }

    override fun invalidate() {
        reactContext.removeActivityEventListener(this)
        pending?.promise?.reject("EXPORT_CLOSED", "أُغلق التطبيق قبل بدء التصدير")
        pending = null
        super.invalidate()
    }
}
