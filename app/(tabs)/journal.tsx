/**
 * app/(tabs)/journal.tsx  →  Onglet "Journal MQTT"
 */
import { useMqtt } from '@/contexts/MqttContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useRef } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

/* ─── Badge topic ─── */
function TopicBadge({ topic }: { topic: string }) {
  const color = topicColor(topic);
  return (
    <View style={[badge.wrap, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <Text style={[badge.text, { color }]} numberOfLines={1}>{topic}</Text>
    </View>
  );
}

function topicColor(topic: string): string {
  if (topic.includes('led') || topic.includes('light')) return '#f59e0b';
  if (topic.includes('temp'))   return '#ef4444';
  if (topic.includes('humid'))  return '#3b82f6';
  if (topic.includes('ventil')) return '#8b5cf6';
  if (topic.includes('brum'))   return '#06b6d4';
  return '#64748b';
}

/* ─── Écran Journal ─── */
export default function JournalScreen() {
  const { messages, clearMessages } = useMqtt();
  const { theme } = useTheme();
  const listRef = useRef<FlatList>(null);

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={[
      styles.row,
      { borderBottomColor: theme.sidebarDivider },
      index % 2 === 0 && { backgroundColor: theme.background },
    ]}>
      <Text style={[styles.rowIndex, { color: theme.textMuted }]}>
        {String(messages.length - index).padStart(3, '0')}
      </Text>
      <View style={styles.rowBody}>
        <TopicBadge topic={item.topic} />
        <Text style={[styles.payload, { color: theme.textPrimary }]} numberOfLines={2}>
          {item.payload}
        </Text>
      </View>
      <Text style={[styles.ts, { color: theme.textMuted }]}>
        {item.ts.toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>

      {/* En-tête */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.sidebarBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>📋 Journal MQTT</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            {messages.length} message{messages.length !== 1 ? 's' : ''} reçu{messages.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={clearMessages}>
            <Text style={styles.clearBtnText}>Vider</Text>
          </Pressable>
        )}
      </View>

      {/* Liste */}
      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Aucun message reçu</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>
            Les messages MQTT apparaîtront ici en temps réel.
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToOffset({ offset: 0, animated: false })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 18, fontWeight: '700' },
  headerSub:     { fontSize: 12, marginTop: 2 },
  clearBtn:      { backgroundColor: '#fef2f2', borderColor: '#fca5a5', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  clearBtnText:  { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  list:          { paddingBottom: 40 },
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1 },
  rowIndex:      { width: 30, fontSize: 11, fontFamily: 'monospace', textAlign: 'right' },
  rowBody:       { flex: 1, gap: 3 },
  payload:       { fontSize: 13, fontWeight: '600' },
  ts:            { width: 60, fontSize: 11, textAlign: 'right' },
  emptyWrap:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:     { fontSize: 52, marginBottom: 12 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

const badge = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
});