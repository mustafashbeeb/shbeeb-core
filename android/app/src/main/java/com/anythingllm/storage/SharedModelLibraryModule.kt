package com.anythingllm.storage

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.system.Os
import android.system.OsConstants
import com.facebook.react.bridge.*
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/** SAF grants belong to this app only. Other apps must request their own grant to the same folder. */
class SharedModelLibraryModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), ActivityEventListener {
    companion object { private const val FOLDER = 48128; private const val MODEL = 48129 }
    private val prefs = context.getSharedPreferences("core_model_library", 0)
    private val descriptors = ConcurrentHashMap<String, ParcelFileDescriptor>()
    private val transferring = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    private var pending: Promise? = null
    init { context.addActivityEventListener(this) }
    override fun getName() = "SharedModelLibrary"
    override fun onNewIntent(intent: Intent) {}

    private fun picker(intent: Intent, request: Int, promise: Promise) {
        if (pending != null || transferring.get()) { promise.reject("BUSY", "يوجد نقل أو اختيار قيد التنفيذ"); return }
        val activity = context.currentActivity
        if (activity == null) { promise.reject("NO_ACTIVITY", "افتح التطبيق أولاً"); return }
        activity.runOnUiThread {
            try { pending = promise; activity.startActivityForResult(intent, request) }
            catch (e: Exception) { pending = null; promise.reject("PICKER_FAILED", e.message, e) }
        }
    }
    @ReactMethod fun chooseFolder(promise: Promise) = picker(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
    }, FOLDER, promise)
    @ReactMethod fun chooseModel(promise: Promise) = picker(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
        type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
    }, MODEL, promise)

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != FOLDER && requestCode != MODEL) return
        val promise = pending ?: return
        pending = null
        if (resultCode != Activity.RESULT_OK || data?.data == null) { promise.resolve(null); return }
        val uri = data.data!!
        try {
            val flags = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            require(flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0) { "لم يُمنح إذن القراءة" }
            context.contentResolver.takePersistableUriPermission(uri, flags)
            if (requestCode == FOLDER) {
                prefs.edit().putString("tree", uri.toString()).apply()
                promise.resolve(uri.toString())
            } else {
                Thread({ try { promise.resolve(describe(uri)) } catch (e: Exception) { promise.reject("INVALID_MODEL", e.message, e) } }, "GGUF-link").start()
            }
        } catch (e: Exception) { promise.reject("PERMISSION_FAILED", e.message, e) }
    }
    @ReactMethod fun folder(promise: Promise) { promise.resolve(prefs.getString("tree", null)) }
    private fun safeUri(value: String): Uri {
        val uri = Uri.parse(value)
        require(uri.scheme == "content") { "يجب اختيار الملف عبر نافذة النظام" }
        return uri
    }
    private fun describe(uri: Uri): WritableMap {
        var name = "model.gguf"; var size = 0L
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
            require(c.moveToFirst()) { "تعذّر قراءة معلومات الملف" }
            name = c.getString(0) ?: name
            if (!c.isNull(1)) size = c.getLong(1)
        }
        require(ModelTransfer.validName(name)) { "اختر ملف GGUF واحداً، وليس ملف LiteRT أو مجلداً" }
        context.contentResolver.openFileDescriptor(uri, "r")!!.use { fd ->
            // llama.cpp mmap needs a seekable file. Cloud provider pipes are not usable directly.
            require(fd.statSize > 24) { "الملف غير محلي أو حجمه غير صالح؛ نزّله على الهاتف أولاً" }
            Os.lseek(fd.fileDescriptor, 0, OsConstants.SEEK_SET)
            val magic = ByteArray(4)
            ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.dup(fd.fileDescriptor)).channel.use { channel ->
                val b = java.nio.ByteBuffer.wrap(magic)
                while (b.hasRemaining()) require(channel.read(b) > 0) { "ملف غير مكتمل" }
                require(magic.contentEquals(byteArrayOf(71,71,85,70))) { "الملف ليس GGUF" }
            }
            if (size == 0L) size = fd.statSize
        }
        return Arguments.createMap().apply { putString("uri", uri.toString()); putString("name", name); putDouble("size", size.toDouble()) }
    }
    @ReactMethod fun scan(promise: Promise) {
        Thread({
            try {
                val tree = prefs.getString("tree", null)
                val result = Arguments.createArray()
                if (tree != null) {
                    val uri = safeUri(tree)
                    val children = DocumentsContract.buildChildDocumentsUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
                    context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
                        while (c.moveToNext()) {
                            if (!ModelTransfer.validName(c.getString(1) ?: "")) continue
                            val doc = DocumentsContract.buildDocumentUriUsingTree(uri, c.getString(0))
                            try { result.pushMap(describe(doc)) } catch (_: Exception) { /* Invalid/incomplete files never appear as installed. */ }
                        }
                    }
                }
                promise.resolve(result)
            } catch (e: Exception) { promise.reject("SCAN_FAILED", "تعذّر الوصول للمجلد؛ أعد اختياره من إعدادات المكتبة", e) }
        }, "GGUF-scan").start()
    }
    @ReactMethod fun openModel(value: String, promise: Promise) {
        try {
            val uri = safeUri(value)
            describe(uri)
            val fd = descriptors[value] ?: context.contentResolver.openFileDescriptor(uri, "r")!!.also { descriptors[value] = it }
            promise.resolve("/proc/self/fd/${fd.fd}")
        } catch (e: Exception) { promise.reject("OPEN_FAILED", "تعذّر فتح النموذج المشترك؛ أعد ربطه من المكتبة", e) }
    }
    @ReactMethod fun closeModel(value: String) { try { descriptors.remove(value)?.close() } catch (_: Exception) {} }
    @ReactMethod fun cancelTransfer() { cancelled.set(true) }

    @ReactMethod fun download(urlString: String, filename: String, expectedSize: Double, promise: Promise) {
        if (!transferring.compareAndSet(false, true)) { promise.reject("BUSY", "يوجد تنزيل قيد التنفيذ"); return }
        cancelled.set(false)
        Thread({
            var temp: Uri? = null
            var connection: HttpURLConnection? = null
            try {
                require(ModelTransfer.validName(filename)) { "اسم ملف غير صالح" }
                val tree = safeUri(prefs.getString("tree", null) ?: error("اختر مجلد المكتبة أولاً"))
                val parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
                // A matching file is re-used only after GGUF/size validation. Never overwrite a user file.
                val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
                context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { c ->
                    while (c.moveToNext()) if (c.getString(1) == filename) {
                        val found = describe(DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0)))
                        require(expectedSize <= 0 || found.getDouble("size").toLong() == expectedSize.toLong()) { "يوجد ملف بنفس الاسم وحجم مختلف؛ لم يتم تغييره" }
                        promise.resolve(found); return@Thread
                    }
                }
                var target = URL(urlString)
                // Only HTTPS downloads. Redirects (HF CDN) must remain HTTPS.
                var ready: HttpURLConnection? = null
                for (attempt in 0..6) {
                    require(target.protocol == "https") { "التنزيل يتطلب HTTPS" }
                    val current = target.openConnection() as HttpURLConnection
                    connection = current
                    current.instanceFollowRedirects = false; current.connectTimeout = 30000; current.readTimeout = 30000
                    current.setRequestProperty("Accept-Encoding", "identity")
                    val status = current.responseCode
                    if (status in 300..399) { val next = current.getHeaderField("Location") ?: error("تحويل غير صالح"); target = URL(target, next); current.disconnect(); continue }
                    require(status == 200) { "فشل التنزيل: HTTP $status" }
                    ready = current; break
                }
                val response = ready ?: error("تحويلات كثيرة أثناء التنزيل")
                temp = DocumentsContract.createDocument(context.contentResolver, parent, "application/octet-stream", ".$filename.${System.nanoTime()}.part") ?: error("المجلد لا يسمح بإنشاء ملفات")
                val expected = if (expectedSize > 0) expectedSize.toLong() else response.contentLengthLong
                val copied = response.inputStream.use { input ->
                    context.contentResolver.openOutputStream(temp!!, "w")!!.use { output -> ModelTransfer.copy(input, output, expected) { cancelled.get() } }
                }
                context.contentResolver.openInputStream(temp!!)!!.use { ModelTransfer.verify(it, copied) }
                check(!cancelled.get()) { "أُلغي التنزيل" }
                val completed = DocumentsContract.renameDocument(context.contentResolver, temp!!, filename) ?: error("المجلد لا يدعم اعتماد الملف؛ اختر مجلداً محلياً")
                temp = null
                promise.resolve(describe(completed))
            } catch (e: Exception) {
                temp?.let { try { DocumentsContract.deleteDocument(context.contentResolver, it) } catch (_: Exception) {} }
                promise.reject("DOWNLOAD_FAILED", e.message, e)
            } finally { connection?.disconnect(); transferring.set(false) }
        }, "GGUF-library-download").start()
    }
    override fun invalidate() {
        cancelled.set(true); context.removeActivityEventListener(this)
        pending?.reject("CLOSED", "أُغلقت المكتبة"); pending = null
        descriptors.values.forEach { try { it.close() } catch (_: Exception) {} }; descriptors.clear()
        super.invalidate()
    }
}
