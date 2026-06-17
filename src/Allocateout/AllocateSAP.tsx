import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AllocateItem {
  bonNo: string;
  model: string;
  color: string;
  qty: number;
  finishQty: number;
  difference: number;
  from: string;
  to: string;
  allocateCode: string;
}

export default function AllocateSAP({ navigation }: any) {
  const global = useGlobal();
  const { gsURL, gs_factoryCode, gs_wareCode, gs_userCode, gs_userName,
    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
  } = global;
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const [currentBonNo, setCurrentBonNo] = useState("");
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");

  const [bonNo, setBonNo] = useState("");
  const [depotNo, setDepotNo] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [items, setItems] = useState<AllocateItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const bonRef = useRef<TextInput>(null);
  const depotRef = useRef<TextInput>(null);
  const modelRef = useRef<TextInput>(null);


  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      if (t) setToken(t);
    };

    loadToken();
  }, []);

  const ensureFocus = () => {
    if (bonRef.current?.isFocused() || depotRef.current?.isFocused() || modelRef.current?.isFocused()) return;
  };

  useEffect(() => {
    bonRef.current?.focus();
  }, []);

  const fetchAllocatePlan = async (systemAllocateCode: string) => {
    setErrorMsg("");
    setLoading(true);

    try {
      // 1. Get SAP Bill
      const sapResponse = await fetch(`${BASE_URL}/api/SAPBill/GetSAPBill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          MAIN_BILL_CODE: systemAllocateCode,
          UserCode: gs_userCode,
          UserName: gs_userName,
        }),
      });

      if (sapResponse.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (sapResponse.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }
      const sapResult = await sapResponse.json();
      console.log("sapResult / ", sapResult);
      if (sapResult && sapResult.message) {
        setErrorMsg("SAP msg:" + sapResult.message);
      }
    } catch (err: any) {
      setErrorMsg("SAP Error: " + err.message);
    }

    try {
      const planResponse = await fetch(`${BASE_URL}/api/AllocateModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          FactoryCode: gs_factoryCode,
          SystemAllocateCode: systemAllocateCode,
        }),
      });

      if (planResponse.status === 401) {
        Alert.alert("Unauthorized", "Token expired or invalid.");
        return;
      }

      if (planResponse.status === 403) {
        Alert.alert("Access Denied", "You do not have permission.");
        return;
      }


      const planData = await planResponse.json();

      if (planData.code === 500) {
        Alert.alert("Error", planData.message);
        navigation.goBack();
        return;
      }
      console.log("ROW =", planData);
      const newItems: AllocateItem[] = [];
      let fromck = "";
      let tock = "";

      if (planData && Array.isArray(planData.data)) {
        planData.data.forEach((row: any) => {
          newItems.push({
            bonNo: systemAllocateCode,
            model: row.model,
            color: row.color,
            qty: parseInt(row.qty),
            finishQty: parseInt(row.okQty),
            difference: parseInt(row.cyQty),
            from: row.fromWareHouse,
            to: row.toWareHouse,
            allocateCode: row.allocateCode,
          });
          fromck = row.fromWareHouse;
          tock = row.toWareHouse;
        });
      }

      setCurrentBonNo(systemAllocateCode);
      setFromWarehouse(fromck);
      setToWarehouse(tock);

      setItems(newItems);
      console.log("FROM CK:", fromck);
      console.log("LOGIN CK:", gs_wareCode);
      if (fromck !== "" && fromck !== gs_wareCode) {
        setErrorMsg("Source WareHouse Must be Login WareHouse " + gs_wareCode);
        setBonNo("");
        setItems([]);
        bonRef.current?.focus();
        return;
      }

      if (fromck !== "") {
        setDepotNo(fromck + "#" + tock);
        modelRef.current?.focus();
      } else {
        setDepotNo("");
        setModelInput("");
        //depotRef.current?.focus();
      }
    } catch (err: any) {
      setErrorMsg("Plan Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {

      setTimeout(() => {
        bonRef.current?.focus();
      }, 100);

    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {

      if (currentBonNo) {
        fetchAllocatePlan(currentBonNo);
        setBonNo("");
      }
    });

    return unsubscribe;
  }, [navigation, currentBonNo]);

  const handleBonSubmit = () => {
    const sn = bonNo.toUpperCase().trim();
    if (sn.length > 0) {
      fetchAllocatePlan(sn);
    }
  };

  const scanTimer = useRef<any>(null);

  const handleBonChange = (text: string) => {
    setBonNo(text);

    clearTimeout(scanTimer.current);

    scanTimer.current = setTimeout(() => {
      const sn = text.toUpperCase().trim();

      if (sn.length > 0) {
        fetchAllocatePlan(sn);
      }
    }, 300);

  };

  const handleChoice = () => {
    if (selectedIndex === null) {
      Alert.alert("Warning", "Please select an item first");
      return;
    }

    const selectedItem = items[selectedIndex];

    const allocateCode = selectedItem.allocateCode;

    navigation.navigate("AllocateFrm", { allocateCode });
  };

  const handleReturn = () => {
    navigation.goBack();
  };

  const renderItem = ({ item, index }: { item: AllocateItem; index: number }) => {
    let textColor = "#334155";
    if (item.difference > 0) {
      textColor = item.finishQty > 0 ? "#2563EB" : "#EF4444";
    }
    const isSelected = selectedIndex === index;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.tableRow,
          index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
          isSelected && styles.selectedRow
        ]}
        onPress={() => setSelectedIndex(index)}
      >
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.bonNo}</Text>
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { color: textColor, width: 150 }]}>{item.color}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.qty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.finishQty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.difference}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.from}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.to}</Text>
        <Text style={[styles.cell, { color: textColor, width: 220 }]}>{item.allocateCode}</Text>
      </TouchableOpacity>
    );
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
          <Text style={styles.headerTitle}>Allocate out SAP</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.inputGroup1}>
            <TextInput
              ref={bonRef}
              style={styles.input1}
              value={bonNo}
              onChangeText={handleBonChange}
              //onSubmitEditing={handleBonSubmit}
              placeholder=" BON NO"
              autoCapitalize="characters"
              placeholderTextColor="#334155"
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={ensureFocus}
              scrollEnabled={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <TextInput
              ref={depotRef}
              style={styles.input}
              value={depotNo}
              onChangeText={setDepotNo}
              placeholder="DEPOT NO"
              autoCapitalize="characters"
              placeholderTextColor="#FFFFFF"
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={ensureFocus}
              scrollEnabled={false}
              editable={false}

            />
          </View>
        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BON NO</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 150 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Finish</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>From</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>To</Text>
                <Text style={[styles.headerCell, { width: 150 }]}>Code</Text>
              </View>
              <ScrollView style={{ flex: 1 }}>
                {items.length === 0 ? (
                  <Text style={styles.emptyText}>Waiting for Scanning...</Text>
                ) : (
                  items.map((item, index) => renderItem({ item, index }))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleChoice}>
            <Text style={styles.primaryButtonText}>Choice</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      )}
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
  card: { backgroundColor: "#FFF", marginHorizontal: -8, borderRadius: 16, paddingBottom: 8, padding: 12, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
  inputGroup: { marginBottom: 4 },
  input: { backgroundColor: "#0052cc", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 13, color: "#e2f0eeff", fontWeight: "600", borderWidth: 1, borderColor: "#CBD5E1" },
  inputGroup1: { marginBottom: 8 },
  input1: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, 
  fontSize: 13, color: "#334155", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc" },
  tableCard: { flex: 1, backgroundColor: "#FFF", marginHorizontal: -8, borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 830 },
  actions: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
  primaryButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052cc' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  errorText: { color: "#EF4444", fontSize: 12, marginBottom: 8, fontWeight: "700" },
  selectedRow: { backgroundColor: "#ffc3c3ff" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
