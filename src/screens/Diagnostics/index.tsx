import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Share, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { clearDiagnostics, getDiagnostics, type DiagnosticEntry } from '@/utils/Diagnostics';

const labels: Record<DiagnosticEntry['category'], string> = {
  crash: 'انهيار',
  microphone: 'ميكروفون',
  model: 'نموذج',
  network: 'اتصال',
  other: 'أخرى',
};

/** Local-only diagnostics screen. Sharing requires an explicit user tap. */
export default function DiagnosticsScreen() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getDiagnostics()); }
    catch { Alert.alert('تعذر التحديث', 'حدث خطأ أثناء قراءة سجل التشخيص'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const share = async () => {
    const report = entries.map(({ timestamp, category, code, source, count }) =>
      `${timestamp} | ${labels[category]} | ${code} | ${source} | x${count}`
    ).join('\n');
    try {
      await Share.share({ message: `Shbeeb Core — تقرير تشخيص منقح\n${report || 'لا توجد أخطاء مسجلة'}` });
    } catch {
      Alert.alert('تعذرت المشاركة', 'لم يتمكن النظام من فتح خيارات المشاركة');
    }
  };

  const clear = () => Alert.alert('مسح سجل الأخطاء', 'هل تريد حذف السجلات المحلية؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'مسح', style: 'destructive', onPress: () => {
      void clearDiagnostics().then(refresh).catch(() => Alert.alert('خطأ', 'تعذر مسح السجل'));
    }},
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: '#101827', padding: 18 }}>
      <Text style={{ color: '#fff', fontSize: 23, fontWeight: '700', textAlign: 'right' }}>مركز تشخيص الأعطال</Text>
      <Text style={{ color: '#9CA3AF', textAlign: 'right', marginTop: 6 }}>
        السجل محفوظ على جهازك. لا يتم إرساله تلقائياً إلى GitHub.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 18 }}>
        <TouchableOpacity onPress={() => void refresh()} accessibilityLabel="تحديث السجل" style={{ padding: 12, backgroundColor: '#243247', borderRadius: 10 }}>
          <Text style={{ color: 'white' }}>تحديث</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void share()} accessibilityLabel="مشاركة التقرير" style={{ padding: 12, backgroundColor: '#243247', borderRadius: 10 }}>
          <Text style={{ color: 'white' }}>مشاركة تقرير</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clear} accessibilityLabel="مسح السجلات" style={{ padding: 12, backgroundColor: '#4B2630', borderRadius: 10 }}>
          <Text style={{ color: 'white' }}>مسح</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: '#fff', textAlign: 'right', marginBottom: 12 }}>الأحداث المسجلة: {entries.length}</Text>
      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={() => void refresh()}
        ListEmptyComponent={<Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 36 }}>لا توجد أخطاء مسجلة حتى الآن</Text>}
        renderItem={({ item }) => (
          <View style={{ backgroundColor: '#1E293B', padding: 14, borderRadius: 12, marginBottom: 9 }}>
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'right' }}>{labels[item.category]} — {item.code}</Text>
            <Text style={{ color: '#CBD5E1', textAlign: 'right', marginTop: 4 }}>{item.source} · تكرار {item.count}</Text>
            <Text style={{ color: '#94A3B8', textAlign: 'right', marginTop: 4 }}>{item.timestamp}</Text>
          </View>
        )}
      />
    </View>
  );
}
