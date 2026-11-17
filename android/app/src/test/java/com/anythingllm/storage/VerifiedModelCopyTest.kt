package com.anythingllm.storage

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.OutputStream
import java.security.MessageDigest
import kotlin.random.Random

class VerifiedModelCopyTest {
    @get:Rule val temporary = TemporaryFolder()

    @Test fun exportsAcrossBufferBoundariesWithoutChangingOriginal() {
        val source = temporary.newFile("model.gguf")
        val destination = temporary.newFile("saved.gguf")
        val content = Random(9).nextBytes(8 * 1024 * 1024 + 19)
        source.writeBytes(content)
        val result = VerifiedModelCopy.copy(source, { destination.outputStream() }, { destination.inputStream() })
        assertEquals(content.size.toLong(), result.bytes)
        assertArrayEquals(content, destination.readBytes())
        assertArrayEquals(content, source.readBytes())
        assertEquals(MessageDigest.getInstance("SHA-256").digest(content).joinToString("") { "%02x".format(it) }, result.sha256)
    }

    @Test fun detectsSameSizeCorruption() {
        val source = temporary.newFile("model.gguf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val destination = temporary.newFile("saved.gguf")
        assertThrows(IllegalStateException::class.java) {
            VerifiedModelCopy.copy(source, { destination.outputStream() }, { ByteArrayInputStream(byteArrayOf(1, 2, 4)) })
        }
        assertArrayEquals(byteArrayOf(1, 2, 3), source.readBytes())
    }

    @Test fun detectsTruncatedDestination() {
        val source = temporary.newFile("model.gguf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        val destination = temporary.newFile("saved.gguf")
        assertThrows(IllegalStateException::class.java) {
            VerifiedModelCopy.copy(source, { destination.outputStream() }, { ByteArrayInputStream(byteArrayOf(1, 2)) })
        }
    }

    @Test fun failedWriteKeepsOriginal() {
        val source = temporary.newFile("model.gguf").apply { writeBytes(byteArrayOf(1, 2, 3)) }
        assertThrows(IOException::class.java) {
            VerifiedModelCopy.copy(source, { object : OutputStream() {
                override fun write(value: Int) { throw IOException("Disk full") }
            } }, { error("Readback must not run after a failed write") })
        }
        assertArrayEquals(byteArrayOf(1, 2, 3), source.readBytes())
    }
}
