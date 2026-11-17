package com.anythingllm.storage

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import kotlin.random.Random

class ModelTransferTest {
    private fun model(): ByteArray = Random(7).nextBytes(200123).also { byteArrayOf(71,71,85,70).copyInto(it) }
    @Test fun streamsAndVerifiesAcrossChunks() {
        val source = model(); val target = ByteArrayOutputStream()
        val result = ModelTransfer.copy(ByteArrayInputStream(source), target, source.size.toLong()) { false }
        assertArrayEquals(source, target.toByteArray())
        ModelTransfer.verify(ByteArrayInputStream(target.toByteArray()), result)
    }
    @Test fun rejectsWrongSize() {
        assertThrows(IllegalArgumentException::class.java) { ModelTransfer.copy(ByteArrayInputStream(model()), ByteArrayOutputStream(), 999) { false } }
    }
    @Test fun rejectsHtmlErrorInsteadOfModel() {
        assertThrows(IllegalArgumentException::class.java) { ModelTransfer.copy(ByteArrayInputStream("<html>Error</html>".toByteArray()), ByteArrayOutputStream(), 0) { false } }
    }
    @Test fun detectsSameSizeCorruption() {
        val source = model(); val output = ByteArrayOutputStream()
        val result = ModelTransfer.copy(ByteArrayInputStream(source), output, 0) { false }
        source[100] = (source[100].toInt() xor 1).toByte()
        assertThrows(IllegalArgumentException::class.java) { ModelTransfer.verify(ByteArrayInputStream(source), result) }
    }
    @Test fun cancellationStopsTransfer() {
        assertThrows(IllegalStateException::class.java) { ModelTransfer.copy(ByteArrayInputStream(model()), ByteArrayOutputStream(), 0) { true } }
    }
    @Test fun handlesShortHeaderReads() {
        val source = model()
        val input = object : ByteArrayInputStream(source) { override fun read(b: ByteArray, off: Int, len: Int) = super.read(b, off, minOf(len, 1)) }
        assertEquals(source.size.toLong(), ModelTransfer.copy(input, ByteArrayOutputStream(), 0) { false }.bytes)
    }
    @Test fun filenamesCannotEscapeOrMasquerade() {
        assertTrue(ModelTransfer.validName("Qwen3.5-0.8B-Q8_0.gguf"))
        listOf("../model.gguf", "/tmp/model.gguf", "x\\model.gguf", "model.litertlm", "x\n.gguf", ".part").forEach { assertFalse(it, ModelTransfer.validName(it)) }
    }
}
