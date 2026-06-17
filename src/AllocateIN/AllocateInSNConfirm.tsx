import React, { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SNConfirmDetail {
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

export default function AllocateInSNConfirm({ navigation, route }: any) {
  const { allocateCode, palletCode, boxCode, SN, scanType, showConfirm, onConfirm } = route.params || {};
  const global = useGlobal();
  const { gsURL, gs_factoryCode, gs_userName ,operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,} = global;
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<SNConfirmDetail[]>([]);
  const [modelName, setModelName] = useState("");
  const [colorName, setColorName] = useState("");
  const [pallet, setPallet] = useState("");
  const [box, setBox] = useState("");
  const [qtyTotal, setQtyTotal] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN AllocateIN", t);
      if (t) setToken(t);
    };

    loadToken();
  }, []);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/AllocateInPalletSNConfirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          factoryCode: gs_factoryCode,
          allocateCode: allocateCode,
          palletCode: palletCode,
          boxCode: boxCode,
          SN: SN,
          scanType: scanType,
        }),
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
        setModelName(result.data[0].model || "");
        setColorName(result.data[0].color || "");
        setPallet(result.data[0].palletCode || palletCode);
        setBox(result.data[0].boxCode || boxCode);

        const mapped = result.data.map((item: any, index: number) => ({
          id: index.toString(),
          fxh: item.fxh,
          SN: item.sn,
          model: item.model,
          color: item.color,
          imeiCode1: item.imeiCode1,
          imeiCode2: item.imeiCode2,
          imeiCode3: item.imeiCode3,
          realdate: item.realDate,
          orderCode: item.orderCode,
        }));
        setDetails(mapped);
        setQtyTotal(mapped.length);
      } else {
        Alert.alert("Error", "There is no product in the box!");
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [allocateCode, palletCode, boxCode, SN, scanType, gs_factoryCode, BASE_URL, token, navigation]);


  useEffect(() => {
    if (token) {
      fetchDetails();
    }
  }, [fetchDetails, token]);



  const handleConfirm = () => {
    Alert.alert(
      "Confirmation",
      "Are you sure you want to confirm this operation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: () => {
            console.log("handleConfirm triggered, emitting ALLOCATE_IN_SN_CONFIRM with:", SN, scanType);
            DeviceEventEmitter.emit('ALLOCATE_IN_SN_CONFIRM', {
              allocateCode,
              palletCode,
              boxCode,
              SN,
              scanType
            });
            navigation.goBack();
          }
        }
      ]
    );
  };

  const renderItem = ({ item, index }: { item: SNConfirmDetail; index: number }) => {
    const isSelected = selectedIndex === index;
    return (
      <TouchableOpacity
        style={[
          styles.row,
          index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
          isSelected && styles.selectedRow
        ]}
        onPress={() => setSelectedIndex(index)}
      >
        <Text style={[styles.cell, { width: 60 }]}>{item.fxh}</Text>
        <Text style={[styles.cell, { width: 150 }]}>{item.SN}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode1}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode2}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imeiCode3}</Text>
        <Text style={[styles.cell, { width: 250 }]}>{item.realdate}</Text>
        <Text style={[styles.cell, { width: 150 }]}>{item.orderCode}</Text>
      </TouchableOpacity>
    );
  };

  const handleBarcodeDetails = () => {
    if (selectedIndex !== null && details[selectedIndex]) {
      const item = details[selectedIndex];
      Alert.alert("SN Details", `SN: ${item.SN}\nIMEI1: ${item.imeiCode1}\nIMEI2: ${item.imeiCode2}\nIMEI3: ${item.imeiCode3}\nDate: ${item.realdate}\nOrder: ${item.orderCode}`);
    } else {
      Alert.alert("Notice", "Please select a row first");
    }
  };

  const handleReturn = () => {
    navigation.goBack();
  };

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
          <Text style={styles.headerTitle}>AllocateIn SN Confirm</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Pallet</Text>
            <Text style={styles.statValue}>{pallet || "-"}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Qty</Text>
            <Text style={styles.statValue}>{qtyTotal}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { width: 60 }]}>No</Text>
              <Text style={[styles.headerCell, { width: 150 }]}>SN</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI1</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI2</Text>
              <Text style={[styles.headerCell, { width: 120 }]}>IMEI3</Text>
              <Text style={[styles.headerCell, { width: 250 }]}>Date</Text>
              <Text style={[styles.headerCell, { width: 150 }]}>Order</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={details}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          {showConfirm && (
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirm </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get("window");
const isSmallDevice = width < 360;
const scale = (size: number) => (width / 375) * size;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
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
    fontSize: isSmallDevice ? scale(14) : scale(16),
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
  content: { flex: 1, padding: 16 },
  statsCard: { paddingBottom: 16, gap: 10 },
  statBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0052cc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E2E8F0",
     marginBottom:-4
  },
  statLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  statValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10, borderRadius: 10, marginBottom: 8 },
  headerCell: { fontSize: 12, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#FFF", borderRadius: 8, marginBottom: 4 },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  selectedRow: { backgroundColor: "#ffc3c3ff" },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  confirmButton: { flex: 1, backgroundColor: "#2563eb", padding: 8, borderRadius: 12, alignItems: "center", elevation: 2 },
  confirmButtonText: { color: "#FFF", fontWeight: "900", fontSize: 15 },
});
