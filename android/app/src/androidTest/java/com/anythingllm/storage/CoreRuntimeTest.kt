package com.anythingllm.storage

import android.content.Intent
import android.os.ParcelFileDescriptor
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.RandomAccessFile
import java.nio.channels.FileChannel

@RunWith(AndroidJUnit4::class)
class CoreRuntimeTest {
    @Test fun sharedDescriptorCanBeOpenedAndMemoryMappedWithoutCopy() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val file = File(context.cacheDir, "descriptor-test.gguf")
        try {
            file.writeBytes(byteArrayOf(71,71,85,70) + ByteArray(65536) { 9 })
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
                RandomAccessFile("/proc/self/fd/${fd.fd}", "r").use { reader ->
                    val mmap = reader.channel.map(FileChannel.MapMode.READ_ONLY, 0, file.length())
                    assertEquals(71.toByte(), mmap.get(0))
                    assertEquals(9.toByte(), mmap.get(65539))
                }
            }
            assertEquals(65540L, file.length())
        } finally { file.delete() }
    }
    @Test fun bundledReleaseOpensArabicWelcomeAndModelSelection() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        instrumentation.uiAutomation.grantRuntimePermission(context.packageName, "android.permission.POST_NOTIFICATIONS")
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)!!
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.startActivity(launch)
        assertTrue("Bundled Arabic welcome did not render", device.wait(Until.hasObject(By.text("ابدأ رحلتك")), 60000))
        val screenshots = File(context.getExternalFilesDir(null), "core-screenshots").apply { mkdirs() }
        device.takeScreenshot(File(screenshots, "01-welcome.png"))
        device.findObject(By.text("ابدأ رحلتك")).click()
        assertTrue("Model selection did not open", device.wait(Until.hasObject(By.text("أي نموذج تريد استخدامه؟")), 30000))
        device.takeScreenshot(File(screenshots, "02-model-selection.png"))
    }
}
