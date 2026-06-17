import React, { useState, useEffect, useMemo } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  ListRenderItem,
  Image,
  Dimensions,
  ScrollView,
  DeviceEventEmitter,

} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SNDetail {
  id: string;
  fxh: string;
  SN: string;
  model: string;
  color: string;
  imeiCode1: string;
  imeiCode2: string;
  imeiCode3: string;
  realdate: string;
  orderCode: string;
}

export default function AllocateSNConfirm({ navigation, route }: any) {
  const { fromWareHouseCode, palletCode: initialPalletCode, boxCode: initialBoxCode, SN, scanType, showConfirm } = route.params || {};
  const global = useGlobal();
  const { gsURL, gs_factoryCode, gs_userName, operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion, } = global;
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SNDetail[]>([]);
  const [title, setTitle] = useState("");
  const [palletCode, setPalletCode] = useState(initialPalletCode || "");
  const [boxCode, setBoxCode] = useState(initialBoxCode || "");


  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN Allocateout", t);
      if (t) setToken(t);
    };

    loadToken();
  }, []);


  useEffect(() => {
    if (token) {
      fetchSNDetails();
    }
  }, [token]);

  const fetchSNDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/AllocatePalletSNConfirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          factoryCode: gs_factoryCode,
          fromWareHouseCode,
          palletCode: initialPalletCode,
          boxCode: initialBoxCode,
          SN,
          scanType
        })
      });

      if (response.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (response.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }


      const result = await response.json();
      if (result.code === 500) {
        Alert.alert("Error", result.message);
        navigation.goBack();
        return;
      }
      if (result.message === 'success' && result.data && result.data.length > 0) {
        const mappedData = result.data.map((row: any, index: number) => ({
          id: index.toString(),
          fxh: row.fxh?.toString(),
          SN: row.sn,
          model: row.model,
          color: row.color,
          imeiCode1: row.imeiCode1,
          imeiCode2: row.imeiCode2,
          imeiCode3: row.imeiCode3,
          realdate: row.realDate,
          orderCode: row.orderCode,
        }));
        setItems(mappedData);

        const first = result.data[0];
        let currentPallet = initialPalletCode;
        let currentBox = initialBoxCode;

        if (scanType === "sn") {
          currentPallet = first.palletCode || "";
          currentBox = first.boxCode || "";
          setPalletCode(currentPallet);
          setBoxCode(currentBox);
        }

     
        setTitle(`Pallet:${currentPallet} Box:${currentBox} ${first.model} ${first.color}`);
      } else {
        setItems([]);
        Alert.alert("Error", "There is no product in the box!");
        navigation.goBack();
      }
    } catch (error) {
      setItems([]);
      Alert.alert("Error", "Failed to load SN details");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      "Confirmation",
      "Are you sure you want to confirm this operation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            DeviceEventEmitter.emit(
              "ON_ALLOCATE_CONFIRM",
              {
                barCode: SN,
                scanType
              }
            );

            navigation.goBack();
          }
        }
      ]
    );
  };

  const handleReturn = () => {
    navigation.goBack();
  };

  const renderItem: ListRenderItem<SNDetail> = ({ item, index }) => (
    <View
      style={[
        styles.row,
        index % 2 === 0
          ? { backgroundColor: "#FFFFFF" }
          : { backgroundColor: "#BAE6FD" }
      ]}
    >
      <Text style={[styles.cell, { width: 40 }]}>{item.fxh}</Text>
      <Text style={[styles.cell, { width: 150 }]}>{item.SN}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode1}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode2}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode3}</Text>
      <Text style={[styles.cell, { width: 200 }]}>{item.realdate}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.orderCode}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleReturn} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SN Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>

        <View style={styles.card}>
          <View style={{ marginBottom: 8 }}>

            {scanType === "sn" ? (

              <>
                <View
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#0052cc",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      marginBottom: 4,
                      height: 35
                    },
                  ]}
                >
                  <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>PALLET</Text>
                  <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                    {palletCode}
                  </Text>
                </View>

                <View
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#0052cc",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      marginBottom: 4,
                      height: 35
                    },
                  ]}
                >
                  <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>BOX</Text>
                  <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                    {boxCode}
                  </Text>
                </View>
             
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: "#0052cc",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    marginBottom: 4,
                  },
                ]}
              >
                <Text style={[styles.label, { marginBottom: 0 }]}>SN</Text>
                <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                  {SN}
                </Text>
              </View>
               </>
            ) : (
              <>
                <View
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#0052cc",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      marginBottom: 4,
                      height: 35
                    },
                  ]}
                >
                  <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>PALLET</Text>
                  <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                    {palletCode}
                  </Text>
                </View>

                <View
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#0052cc",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      marginBottom: 4,
                      height: 35
                    },
                  ]}
                >
                  <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>BOX</Text>
                  <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                    {boxCode}
                  </Text>
                </View>
              </>
            )}

            <View
              style={[
                styles.input,
                {
                  backgroundColor: "#0052cc",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  height: 35
                },
              ]}
            >
              <Text style={[styles.label, { marginBottom: 0, color: "#FFFFFF" }]}>TOTAL QTY</Text>
              <Text style={{ fontSize: 13, color: "#FFFFFF", fontWeight: "700" }}>
                {items.length}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={{ width: 740 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { width: 40 }]}>No</Text>
              <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI 1</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI 2</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI 3</Text>
              <Text style={[styles.headerCell, { width: 200 }]}>Date</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>Order Code</Text>
            </View>

            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  {loading ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.emptyText}>Waiting for scans...</Text>}
                </View>
              }
            />
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {showConfirm && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.btnPrimary]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.btnTextPrimary}>Confirm</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: "#0052cc",
    paddingHorizontal: width * 0.05,
    height: scale(56),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  returnLogo: {
    width: scale(24),
    height: scale(24),
    marginRight: 10,
    tintColor: "#FFFFFF",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: isSmallDevice ? scale(15) : scale(17),
    fontWeight: "900",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  userNameText: {
    color: "#FFFFFF",
    fontSize: scale(12),
    fontWeight: "700",
    marginRight: 1,
  },
  content: { flex: 1, padding: 10 },
  card: {},
  label: { fontSize: 11, fontWeight: "700", color: "#FFFFFF", marginBottom: 4, textTransform: "uppercase" },
  input: { backgroundColor: "#0052cc", padding: 3, borderRadius: 10, fontSize: 12, color: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1" },
  modelInfo: { backgroundColor: "#F1F5F9", padding: 8, borderRadius: 10, marginBottom: 8 },
  modelLabel: { color: "#64748B", fontSize: 9, textTransform: "uppercase", fontWeight: "700" },
  modelValue: { color: "#2563eb", fontSize: 13, fontWeight: "800" },
  summaryRow: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 6 },
  summaryLabel: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '800' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#0052cc', paddingVertical: 8, borderRadius: 8, marginBottom: 4 },
  headerCell: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center' },
  listContent: { paddingBottom: 10 },
  row: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderRadius: 8, marginBottom: 4, alignItems: 'center' },
  cell: { fontSize: 11, color: '#334155', fontWeight: '600', textAlign: 'center' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  footer: { padding: 10 },
  actionBtn: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnTextPrimary: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
