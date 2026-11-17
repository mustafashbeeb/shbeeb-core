package com.anythingllm.storage

import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

/** Bounded memory transfer; rejects non-GGUF, truncation, corruption and cancellation. */
internal object ModelTransfer {
    data class Result(val bytes: Long, val sha256: String)
    fun validName(name: String): Boolean = name.length in 6..180 &&
        name.endsWith(".gguf", true) && !name.contains('/') && !name.contains('\\') &&
        !name.contains("..") && name.none { it.code < 32 }

    fun copy(input: InputStream, output: OutputStream, expected: Long, cancelled: () -> Boolean): Result {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        // InputStream.read may legally return fewer than four bytes.
        val header = ByteArray(4)
        var offset = 0
        while (offset < 4) {
            val n = input.read(header, offset, 4 - offset)
            require(n > 0) { "ملف GGUF غير مكتمل" }
            offset += n
        }
        require(header.contentEquals(byteArrayOf(71, 71, 85, 70))) { "الملف ليس بصيغة GGUF" }
        output.write(header); digest.update(header); total = 4
        while (true) {
            check(!cancelled()) { "أُلغي نقل النموذج" }
            val n = input.read(buffer)
            if (n < 0) break
            if (n == 0) continue
            output.write(buffer, 0, n); digest.update(buffer, 0, n); total += n
        }
        output.flush()
        require(expected <= 0 || total == expected) { "حجم الملف لا يطابق الحجم المتوقع" }
        require(total > 24) { "ملف النموذج غير مكتمل" }
        return Result(total, digest.digest().joinToString("") { "%02x".format(it) })
    }
    fun verify(input: InputStream, expected: Result) {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        var total = 0L
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            if (n > 0) { digest.update(buffer, 0, n); total += n }
        }
        require(total == expected.bytes && digest.digest().joinToString("") { "%02x".format(it) } == expected.sha256) {
            "فشل التحقق من سلامة الملف المحفوظ"
        }
    }
}
