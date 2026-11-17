package com.anythingllm.storage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.system.Os
import android.system.OsConstants
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.FileInputStream
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** User-selected GGUF access via SAF. Keeps each PFD alive while llama.rn mmaps the model. */
class SharedGgufAccessModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        private const val TAG = "SharedGgufAccess"
        private const val PICK_REQUEST = 7831
        private const val MIN_SIZE_BYTES = 1_000_000L
        private const val MAX_SIZE_BYTES = 20_000_000_000L
    }

    private data class SelectedFile(val uri: Uri, val name: String, val size: Long)

    private val openDescriptors = ConcurrentHashMap<String, ParcelFileDescriptor>()
    @Volatile private var pendingPicker: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "SharedGgufAccess"

    @ReactMethod
    fun pickGGUF(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("ERR_GGUF_PICKER", "افتح التطبيق قبل اختيار ملف النموذج.")
            return
        }
        if (pendingPicker != null) {
            promise.reject("ERR_GGUF_PICKER_BUSY", "نافذة اختيار ملف مفتوحة بالفعل.")
            return
        }
        try {
            pendingPicker = promise
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            }
            activity.startActivityForResult(intent, PICK_REQUEST)
        } catch (error: Exception) {
            pendingPicker = null
            promise.reject("ERR_GGUF_PICKER", error.message ?: "تعذّر فتح منتقي الملفات.", error)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != PICK_REQUEST) return
        val promise = pendingPicker ?: return
        pendingPicker = null
        if (resultCode != Activity.RESULT_OK) {
            promise.resolve(null)
            return
        }
        val uri = data?.data
        if (uri == null) {
            promise.reject("ERR_GGUF_PICKER", "لم يُرجع منتقي Android ملفاً.")
            return
        }
        try {
            require(data.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0) {
                "لم يمنح منتقي الملفات إذن قراءة مستمراً. أعد اختيار الملف."
            }
            reactContext.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val selected = validate(uri)
            promise.resolve(Arguments.createMap().apply {
                putString("uri", selected.uri.toString())
                putString("name", selected.name)
                putDouble("sizeBytes", selected.size.toDouble())
            })
        } catch (error: Exception) {
            runCatching {
                reactContext.contentResolver.releasePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            Log.w(TAG, "Could not accept selected GGUF", error)
            promise.reject("ERR_GGUF_PICKER", error.message ?: "تعذّر استخدام ملف GGUF المحدد.", error)
        }
    }

    /** Opens an authorized document and returns a process-local path plus a lease token. */
    @ReactMethod
    fun openGGUF(uriValue: String, promise: Promise) {
        var descriptor: ParcelFileDescriptor? = null
        try {
            val uri = Uri.parse(uriValue)
            val selected = validate(uri)
            descriptor = reactContext.contentResolver.openFileDescriptor(uri, "r")
                ?: throw IOException("تعذّر فتح ملف النموذج من المجلد المشترك. أعد اختياره.")
            val size = descriptor.statSize
            require(size == selected.size && size in MIN_SIZE_BYTES..MAX_SIZE_BYTES) {
                "تغيّر حجم ملف GGUF أو لم يعد صالحاً. أعد اختياره."
            }
            // llama.cpp uses random access and mmap. Reject virtual streams/pipes instead of copying silently.
            Os.lseek(descriptor.fileDescriptor, 0L, OsConstants.SEEK_CUR)
            val path = "/proc/self/fd/${descriptor.fd}"
            verifyMagic(path)
            val token = UUID.randomUUID().toString()
            openDescriptors[token] = descriptor
            descriptor = null // ownership moved to the lease map; llama.rn must release before closeGGUF.
            promise.resolve(Arguments.createMap().apply {
                putString("token", token)
                putString("path", path)
                putDouble("sizeBytes", size.toDouble())
            })
        } catch (error: Exception) {
            descriptor?.close()
            Log.w(TAG, "Could not open shared GGUF", error)
            promise.reject("ERR_GGUF_OPEN", error.message ?: "تعذّر فتح ملف GGUF.", error)
        }
    }

    @ReactMethod
    fun closeGGUF(token: String, promise: Promise) {
        val descriptor = openDescriptors.remove(token)
        if (descriptor == null) {
            promise.resolve(false)
            return
        }
        try {
            descriptor.close()
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERR_GGUF_CLOSE", error.message ?: "تعذّر إغلاق ملف النموذج.", error)
        }
    }

    /** Release only AnythingLLM's persisted read permission. The shared document is never deleted. */
    @ReactMethod
    fun releaseGGUF(uriValue: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriValue)
            val hasReadGrant = reactContext.contentResolver.persistedUriPermissions.any {
                it.uri == uri && it.isReadPermission
            }
            if (hasReadGrant) {
                reactContext.contentResolver.releasePersistableUriPermission(
                    uri, Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("ERR_GGUF_RELEASE", error.message ?: "تعذّر إزالة إذن الملف.", error)
        }
    }

    private fun validate(uri: Uri): SelectedFile {
        val name = displayName(uri)
        require(name.endsWith(".gguf", ignoreCase = true)) {
            "اختر ملفاً بامتداد ‎.gguf. ملفات LiteRT أو نماذج الصور غير متوافقة مع llama.rn."
        }
        val descriptor = reactContext.contentResolver.openFileDescriptor(uri, "r")
            ?: throw IOException("تعذّر قراءة الملف المحدد.")
        val size = descriptor.use { it.statSize }
        require(size in MIN_SIZE_BYTES..MAX_SIZE_BYTES) {
            "حجم ملف GGUF غير صالح أو يتجاوز الحد المدعوم (20 GB)."
        }
        verifyMagic(uri)
        return SelectedFile(uri, name, size)
    }

    private fun displayName(uri: Uri): String {
        var name = uri.lastPathSegment?.substringAfterLast('/') ?: ""
        reactContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (column >= 0) name = cursor.getString(column) ?: name
                }
            }
        return name
    }

    private fun verifyMagic(path: String) {
        FileInputStream(path).use { input ->
            val magic = ByteArray(4)
            require(input.read(magic) == 4 && magic.contentEquals(byteArrayOf(0x47, 0x47, 0x55, 0x46))) {
                "محتوى الملف لا يحمل ترويسة GGUF صحيحة."
            }
        }
    }

    private fun verifyMagic(uri: Uri) {
        val descriptor = reactContext.contentResolver.openFileDescriptor(uri, "r")
            ?: throw IOException("تعذّر قراءة ترويسة النموذج.")
        descriptor.use { verifyMagic("/proc/self/fd/${it.fd}") }
    }

    override fun onNewIntent(intent: Intent) = Unit

    override fun invalidate() {
        pendingPicker?.reject("ERR_GGUF_PICKER", "أُغلق التطبيق أثناء اختيار النموذج.")
        pendingPicker = null
        openDescriptors.values.forEach { runCatching { it.close() } }
        openDescriptors.clear()
        super.invalidate()
    }
}
