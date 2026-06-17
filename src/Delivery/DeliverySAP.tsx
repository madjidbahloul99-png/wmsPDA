import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  DeviceEventEmitter
} from "react-native";
import { useGlobal } from "../../GlobalContext.tsx";
import AsyncStorage from "@react-native-async-storage/async-storage";


interface DeliveryItem {
  bonNo: string;
  model: string;
  color: string;
  qty: number;
  finishQty: number;
  difference: number;
  from: string;
  to: string;
  deliveryCode: string;
}

export default function DeliverySAP({ navigation, route }: any) {
  const global = useGlobal();
  const { gsURL, gs_factoryCode, gs_wareCode, gs_userCode, gs_userName,
    operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
  } = global;
  const BASE_URL = gsURL;
  const [token, setToken] = useState("");

  const [BonNo, setBonNo] = useState("");
  const [depotNo, setDepotNo] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  // Use ref for bonNo to prevent re-renders on every keystroke
  const bonNoRef = useRef("");
  const scanTimer = useRef<any>(null);
  const [f_systemDeliveryCode, setFSystemDeliveryCode] = useState("");
  const [f_fromck, setFFromck] = useState("");
  const [f_tokh, setFTokh] = useState("");

  const bonRef = useRef<TextInput>(null);
  const depotRef = useRef<TextInput>(null);
  const modelRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    if (bonRef.current) {
      bonRef.current.focus();
    }
  };

  useEffect(() => {
    bonRef.current?.focus();
  }, []);

  useEffect(() => {
    const loadToken = async () => {
      const t = await AsyncStorage.getItem("userToken");
      console.log("TOKEN IN Allocateout", t);
      if (t) setToken(t);
    };

    loadToken();
  }, []);

  const fetchDeliveryPlan = async (systemDeliveryCode: string) => {
    if (loading) return;

    // Clean the code: remove non-printable characters and trim
    const cleanCode = systemDeliveryCode.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) return;

    setErrorMsg("");
    setLoading(true);
    setItems([]);

    try {

      const sapResponse = await fetch(`${BASE_URL}/api/SAPBill/GetSAPBill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          MAIN_BILL_CODE: cleanCode,
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
      console.log("SAP API RESPONSE:", sapResult);

      if (sapResult && sapResult.message) {
        setErrorMsg("SAP msg: " + sapResult.message);
      }

      // 2. Get Delivery Plan
      const planResponse = await fetch(`${BASE_URL}/api/DeliveryModel`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, },
        body: JSON.stringify({
          operateUserCode, operateUserName, operateWareHouseCode, operateRandomNumber, operateSign, operateVersion,
          factoryCode: gs_factoryCode,
          systemDeliveryCode: cleanCode,
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
      console.log("Plan API RESPONSE:", planData);

      const newItems: DeliveryItem[] = [];
      let fromck = "";
      let tokh = "";

      if (planData && planData.data) {
        planData.data.forEach((row: any) => {
          newItems.push({
            bonNo: cleanCode,
            model: row.model,
            color: row.color,
            qty: parseInt(row.qty),
            finishQty: parseInt(row.okqty),
            difference: parseInt(row.cyqty),
            from: row.fromWareHouse,
            to: row.toKh,
            deliveryCode: row.deliveryCode,
          });
          fromck = row.fromWareHouse;
          tokh = row.toKh;
        });
      }

      setItems(newItems);

      if (fromck !== "" && fromck !== gs_wareCode) {
        setErrorMsg("Source WareHouse Must be Login WareHouse " + gs_wareCode);
        setItems([]);
        setFSystemDeliveryCode("");
        bonRef.current?.focus();
        return;
      }

      setFSystemDeliveryCode(cleanCode);

      if (fromck !== "") {
        setDepotNo(tokh + "#" + fromck);
        setFFromck(fromck);
        setFTokh(tokh);
        modelRef.current?.focus();
      } else {
        setDepotNo("");
        setModelInput("");
        //depotRef.current?.focus();
      }
    } catch (err: any) {
      setErrorMsg("Error: " + err.message);
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };



  const fetchDeliveryPlanRef = useRef(fetchDeliveryPlan);
  useEffect(() => {

    fetchDeliveryPlanRef.current = fetchDeliveryPlan;
  }, [fetchDeliveryPlan]);

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
      if (f_systemDeliveryCode) {
        fetchDeliveryPlan(f_systemDeliveryCode);
        setBonNo("");
        bonNoRef.current = "";
      }
    });

    return unsubscribe;
  }, [navigation, f_systemDeliveryCode]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "ON_DELIVERY_REFRESH",
      () => {
        console.log("Refreshing Delivery Plan on Event:", f_systemDeliveryCode);
        if (token && f_systemDeliveryCode) {
          fetchDeliveryPlanRef.current(f_systemDeliveryCode);
        }
      }
    );
    return () => sub.remove();
  }, [token, f_systemDeliveryCode]);

  const handleBonChange = (text: string) => {
    setBonNo(text);
    bonNoRef.current = text;
    clearTimeout(scanTimer.current);

    if (text.includes('\n') || text.includes('\r')) {
      const sn = text.trim();
      if (sn.length > 0) {
        fetchDeliveryPlan(sn);
      }
    } else {
      scanTimer.current = setTimeout(() => {
        const sn = text.trim();
        if (sn.length > 0) {
          fetchDeliveryPlan(sn);
        }
      }, 300);
    }
  };

  const handleBonSubmit = () => {
    clearTimeout(scanTimer.current);
    const sn = bonNoRef.current.trim();
    setBonNo(sn);
    if (sn.length > 0) {
      setBonNo(sn);
      fetchDeliveryPlan(sn);
    }
  };

  const handleChoice = () => {

    if (selectedIndex === null || !items[selectedIndex]) {
      Alert.alert("Warning", "Please select an item first");
      return;
    }

    const selectedItem = items[selectedIndex];

    navigation.navigate('DeliveryFrm', {
      deliveryCode: selectedItem.deliveryCode,
    });
  };

  const renderItem = React.useCallback(({ item, index }: { item: DeliveryItem; index: number }) => {
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
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#BAE6FD" },
          isSelected && styles.selectedRow
        ]}
        onPress={() => setSelectedIndex(index)}
      >
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.bonNo}</Text>
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { color: textColor, width: 180 }]}>{item.color}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.qty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.finishQty}</Text>
        <Text style={[styles.cell, { color: textColor, width: 60 }]}>{item.difference}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.from}</Text>
        <Text style={[styles.cell, { color: textColor, width: 100 }]}>{item.to}</Text>
        <Text style={[styles.cell, { color: textColor, width: 250 }]}>{item.deliveryCode}</Text>
      </TouchableOpacity>
    );
  }, [selectedIndex]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}> Delivery Scann</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.inputGroup}>
            <TextInput
              ref={bonRef}
              style={styles.input}
              value={BonNo}
              onChangeText={handleBonChange}
              onSubmitEditing={handleBonSubmit}
              placeholder=" BON NO"
              placeholderTextColor="#334155"
              autoCapitalize="characters"
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={ensureFocus}
            />
          </View>

          <View style={styles.inputGroup1}>
            <TextInput
              ref={depotRef}
              style={styles.input1}
              value={depotNo}
              onChangeText={setDepotNo}
              placeholder="DEPOT NO"
              autoCapitalize="characters"
              placeholderTextColor="#FFFFFF"
            />
          </View>

        </View>

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BON NO</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 180 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Finish</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>From</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>To</Text>
                <Text style={[styles.headerCell, { width: 250 }]}>Delivery</Text>
              </View> 
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.deliveryCode}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {loading ? "Loading..." : "Waiting for Scanning..."}
                  </Text>
                }
                style={{ flex: 1 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
              />
            </View>
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.detailButton} onPress={handleChoice}>
            <Text style={styles.detailButtonText}>Choice</Text>
          </TouchableOpacity>
        </View>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#0052cc" />
          </View>
        )}
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
  content: { flex: 1, padding: 8 },
  card: { backgroundColor: "#FFF", borderRadius: 16, paddingTop: 10, paddingBottom: 8, padding: 8, marginBottom: 8, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
  inputGroup: { marginBottom: 4 },
  input: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, color: "#1E293B", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc" },
  inputGroup1: { marginBottom: 4 },
  input1: { backgroundColor: "#0052cc", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, color: "#FFFFFF", fontWeight: "600", borderWidth: 1, borderColor: "#CBD5E1" },
  tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 830 },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
  detailButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052cc' },
  detailButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  errorText: { color: "#EF4444", fontSize: 12, marginBottom: 8, fontWeight: "700" },
  selectedRow: { backgroundColor: "#ffc3c3ff" },
  returnLogoWrapper: { padding: 4 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
