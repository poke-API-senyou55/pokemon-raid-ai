import { GoogleGenerativeAI } from "@google/generative-ai";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import pokemonData from '../../assets/pokemon_master.json';


// 指定されたAPIキー
const MY_GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY || ""; 

const TYPES = ["ノーマル", "ほのお", "みず", "でんき", "くさ", "こおり", "かくとう", "どく", "じめん", "ひこう", "エスパー", "むし", "いわ", "ゴースト", "ドラゴン", "あく", "はがね", "フェアリー"];
// ご指定の星ランク選択肢
const RANKS = ["★1〜2", "★3", "★4", "★5", "★6", "★7(最強レイド)"];

export default function HomeScreen() {
  const [enemyName, setEnemyName] = useState('');
  const [enemyTeraType, setEnemyTeraType] = useState('');
  const [starRank, setStarRank] = useState('★6');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isTypeModalVisible, setTypeModalVisible] = useState(false);
  const [isStarModalVisible, setIsStarModalVisible] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const systemInstruction = `
    あなたはポケモンSVの「テラスタルレイド・ソロ攻略」の専門家です。
    ユーザーが入力した【相手ポケモン】【テラスタイプ】【星のランク】に対し、1人で安定して勝てる対策を3体提案してください。
    
    【回答ルール】
    1. 指定された星の数に基づき、最適な「持ち物」「技」「立ち回り手順（チャート）」を出すこと。
    2. 回復手段（かいがらのすず、ドレインパンチ、パラボラチャージ等）を重視すること。
    3. JSON形式でのみ回答してください。
    
    【JSON構造】
    [
      {
        "名前": "ポケモン名",
        "もちもの": "おすすめの持ち物名",
        "理由": "なぜこのレイドに強いのか",
        "技": ["技1", "技2", "技3", "技4"],
        "チャート": ["1T目: 〇〇を使う", "2T目: △△で削る", "中盤: テラスタルして攻撃", "ピンチ時: 応援で回復"]
      }
    ]
  `;

  const toKatakana = (str: string) => str ? str.replace(/[ぁ-ん]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60)) : "";

  useEffect(() => {
    if (enemyName.length > 0) {
      const searchKatakana = toKatakana(enemyName);
      const filtered = pokemonData.filter((p: any) => 
        (p?.名前 && p.名前.includes(searchKatakana)) || (p?.名前 && p.名前.includes(enemyName))
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [enemyName]);

  const handleAIAnalyze = async () => {
    if (!enemyName || !enemyTeraType) {
      Alert.alert("確認", "相手の情報を入力してください");
      return;
    }
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(MY_GEMINI_KEY);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemInstruction 
      });

      const prompt = `相手ポケモン: ${enemyName}, テラスタイプ: ${enemyTeraType}, 難易度: ${starRank}. このレイドをソロ攻略する対策を教えて。`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\[.*\]/s);
      if (!jsonMatch) throw new Error("回答形式エラー");
      
      setRecommendations(JSON.parse(jsonMatch[0]));
      setShowResult(true);
      setExpandedIndex(null);

    } catch (error: any) {
      console.error(error);
      Alert.alert("エラー", "AIからの回答を取得できませんでした。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {showResult ? (
              <View style={styles.container}>
                <TouchableOpacity onPress={() => setShowResult(false)} style={styles.backBtn}>
                  <Text style={styles.backText}>← 再検索</Text>
                </TouchableOpacity>
                
                <Text style={styles.resTitle}>【{starRank} ソロ攻略】対 {enemyName} ({enemyTeraType})</Text>
                
                {recommendations.map((p, index) => (
                  <View key={index} style={styles.card}>
                    <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}>
                      <View>
                        <Text style={styles.pokeName}>{p.名前}</Text>
                        <Text style={styles.itemTag}>持ち物: {p.もちもの}</Text>
                      </View>
                      <Text style={styles.expand}>{expandedIndex === index ? '▲ 閉じる' : '▼ 攻略チャートを見る'}</Text>
                    </TouchableOpacity>

                    {expandedIndex === index && (
                      <View style={styles.detail}>
                        <Text style={styles.sectionTitle}>■ 採用理由</Text>
                        <Text style={styles.reason}>{p.理由}</Text>
                        <Text style={styles.sectionTitle}>■ おすすめ技構成</Text>
                        <View style={styles.tagContainer}>
                          {p.技.map((m: string, i: number) => <View key={i} style={styles.moveTag}><Text style={styles.moveText}>{m}</Text></View>)}
                        </View>
                        <Text style={styles.sectionTitle}>■ 立ち回りチャート</Text>
                        <View style={styles.chartBox}>
                          {p.チャート.map((step: string, i: number) => (
                            <Text key={i} style={styles.chartStep}>{step}</Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                <View style={{ height: 40 }} />
              </View>
            ) : (
              <View style={styles.container}>
                <Text style={styles.header}>レイドソロ攻略検索</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>出現ポケモン</Text>
                  <TextInput style={styles.input} value={enemyName} onChangeText={setEnemyName} placeholder="ポケモンを入力してください。" />
                  {suggestions.length > 0 && (
                    <View style={styles.sugList}>
                      {suggestions.map((s, i) => (
                        <TouchableOpacity key={i} style={styles.sugItem} onPress={() => { setEnemyName(s.名前); setSuggestions([]); }}><Text>{s.名前}</Text></TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>相手のテラスタイプ</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setTypeModalVisible(true)}>
                    <Text style={{ color: enemyTeraType ? '#2d3436' : '#b2bec3' }}>
                      {enemyTeraType || "選択してください "}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>レイド難易度</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setIsStarModalVisible(true)}>
                    <Text>{starRank} </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.btn} onPress={handleAIAnalyze} disabled={isLoading}>
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>検索</Text>}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 星ランク選択モーダル */}
      <Modal visible={isStarModalVisible} transparent animationType="fade">
        <View style={styles.modal}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>難易度を選択</Text>
          <ScrollView>
            {RANKS.map(s => (
              <TouchableOpacity key={s} style={styles.tBtnWide} onPress={() => { setStarRank(s); setIsStarModalVisible(false); }}>
                <Text style={{ fontWeight: 'bold' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={()=>setIsStarModalVisible(false)}><Text>キャンセル</Text></TouchableOpacity>
        </View></View>
      </Modal>

      {/* タイプ選択モーダル（修正ポイント：幅とフォントサイズを調整） */}
      <Modal visible={isTypeModalVisible} transparent animationType="fade">
        <View style={styles.modal}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>テラスタイプを選択</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {TYPES.map(t => (
              <TouchableOpacity key={t} style={styles.tBtn} onPress={() => { setEnemyTeraType(t); setTypeModalVisible(false); }}>
                <Text style={styles.tBtnText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={()=>setTypeModalVisible(false)}><Text>キャンセル</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { padding: 20 },
  header: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginVertical: 40, color: '#2d3436' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#636e72' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#dfe6e9', fontSize: 16 },
  sugList: { backgroundColor: '#fff', borderRadius: 10, elevation: 5, marginTop: 5, borderWidth: 1, borderColor: '#eee' },
  sugItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f1f1' },
  btn: { backgroundColor: '#0984e3', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 25, padding: 20, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tBtn: { 
    width: '31%', // 3列表示のために微調整
    paddingVertical: 12, 
    backgroundColor: '#f1f2f6', 
    marginBottom: 10, 
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  tBtnText: {
    fontSize: 13, // フェアリーが収まるようにサイズを調整
    color: '#2d3436',
    fontWeight: '500'
  },
  tBtnWide: { width: '90%', padding: 15, backgroundColor: '#f1f2f6', margin: 5, borderRadius: 12, alignItems: 'center', alignSelf: 'center' },
  closeBtn: { marginTop: 15, alignItems: 'center', padding: 10 },
  card: { backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pokeName: { fontSize: 20, fontWeight: 'bold', color: '#2d3436' },
  itemTag: { fontSize: 13, color: '#0984e3', fontWeight: 'bold', marginTop: 4 },
  expand: { color: '#0984e3', fontSize: 12 },
  detail: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#f1f1f1', paddingTop: 15 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#2d3436', marginTop: 10, marginBottom: 5 },
  reason: { fontSize: 14, color: '#636e72', lineHeight: 20 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 5 },
  moveTag: { backgroundColor: '#e1f5fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, marginRight: 6, marginBottom: 6 },
  moveText: { fontSize: 12, color: '#0288d1', fontWeight: 'bold' },
  chartBox: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 10, marginTop: 5 },
  chartStep: { fontSize: 13, color: '#2d3436', marginBottom: 6, lineHeight: 18 },
  resTitle: { textAlign: 'center', fontSize: 16, fontWeight: 'bold', marginBottom: 20, color: '#636e72' },
  backBtn: { marginBottom: 15 },
  backText: { color: '#0984e3', fontWeight: 'bold' }
});