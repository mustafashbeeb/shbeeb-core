package com.anythingllm.storage

import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

/** A bounded-memory copy that reads back the destination before declaring a backup successful. */
internal object VerifiedModelCopy {
    data class Result(val bytes: Long, val sha256: String)

    fun copy(source: File, openOutput: () -> OutputStream, openInput: () -> InputStream): Result {
        val size = source.length()
        val hash = MessageDigest.getInstance("SHA-256")
        var copied = 0L
        source.inputStream().use { input ->
            openOutput().use { output ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                    hash.update(buffer, 0, count)
                    copied += count
                }
                output.flush()
            }
        }
        check(copied > 0 && copied == size) { "لم يكتمل نسخ النموذج" }
        val expectedHash = hash.digest()
        val actualHash = MessageDigest.getInstance("SHA-256")
        var verified = 0L
        openInput().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                actualHash.update(buffer, 0, count)
                verified += count
            }
        }
        check(verified == copied && actualHash.digest().contentEquals(expectedHash)) {
            "فشل التحقق من سلامة النسخة؛ أعد التصدير"
        }
        return Result(copied, expectedHash.joinToString("") { "%02x".format(it) })
    }
}
