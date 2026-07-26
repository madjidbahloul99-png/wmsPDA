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
import { useGlobalStr } from "../../GlobalStrContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as pubfunction from "../pubfunction";
import * as soapClient from "./soapClient";

interface DeliveryItem {
  id: string;
  bonNo: string;
  sapMainBillCode: string;
  model: string;
  color: string;
  qty: number;
  finishQty: number;
  difference: number;
  from: string;
  to: string;
  deliveryCode: string;
  guid: string;
  brand: string;
}

export default function DeliverySAP({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_MESBaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_factoryCode,
    g_webUrl,
    g_isRealUrl,
  } = useGlobalStr();

  const [BonNo, setBonNo] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const bonNoRef = useRef("");
  const scanTimer = useRef<any>(null);
  const [f_systemDeliveryCode, setFSystemDeliveryCode] = useState("");
  const [f_sapMainBillCode, setFSapMainBillCode] = useState("");
  const [f_fromck, setFFromck] = useState("");
  const [f_tokh, setFTokh] = useState("");

  const bonRef = useRef<TextInput>(null);

  const ensureFocus = () => {
    if (bonRef.current) {
      bonRef.current.focus();
    }
  };

  useEffect(() => {
    bonRef.current?.focus();
  }, []);

  // Synchronize global strings to pubfunction globalstr
  useEffect(() => {
    pubfunction.globalstr.gs_userCode = gs_userCode || "";
    pubfunction.globalstr.gs_userName = gs_userName || "";
    pubfunction.globalstr.gs_PasswordSalt = gs_PasswordSalt || "abc12345";
    pubfunction.globalstr.gs_version = gs_version || "1.0.0";
  }, [gs_userCode, gs_userName, gs_PasswordSalt, gs_version]);

  const fetchDeliveryPlan = async (sapMainBillCode: string) => {
    if (loading) return;

    const cleanCode = sapMainBillCode.replace(/[^\x20-\x7E]/g, '').trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3) return;

    setErrorMsg("");
    setLoading(true);
    setItems([]);

    try {
      // 1. SOAP UpdateBillDA Call check
      let mesUrl = gs_MESBaseURL;
      if (g_isRealUrl) {
        mesUrl = g_webUrl;
      }
      await soapClient.UpdateBillDA(mesUrl, cleanCode);

      // 2. Build URL and call getWarehouseDeliveryBillInfoByBillCodeFromSap
      let urlCur = `${gs_BaseURL}/warehouse/billInfo/getWarehouseDeliveryBillInfoByBillCodeFromSap`;
      urlCur = urlCur + "?sapMainBillCode=" + encodeURIComponent(cleanCode);
      urlCur = urlCur + "&warehouseCode=" + encodeURIComponent(gs_wareCode);
      urlCur = urlCur + "&billType=5000";

      // Append general signature
      urlCur = urlCur + pubfunction.GetUserSign("&");

      const sapResponse = await fetch(urlCur, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const sapResult = await sapResponse.json();
      console.log("getWarehouseDeliveryBillInfoByBillCodeFromSap RESPONSE:", sapResult);

      let fromck = "";
      let tokh = "";

      if (sapResult && sapResult.success) {
        const vo = sapResult.data || {};
        fromck = vo.warehouseCode || "";
        setFFromck(fromck);
        tokh = vo.customerCode || "";

        if (vo.billInfoList && vo.billInfoList.length > 0) {
          const newItems: DeliveryItem[] = vo.billInfoList.map((item: any, idx: number) => {
            const billCountVal = parseInt(item.billCount || "0") || 0;
            const actualCountVal = parseInt(item.actualCount || "0") || 0;
            const diffVal = billCountVal - actualCountVal;

            return {
              id: String(idx),
              bonNo: item.billCode || "",
              sapMainBillCode: item.sapMainBillCode || cleanCode || "",
              model: item.model || "",
              color: item.color || "",
              qty: billCountVal,
              finishQty: actualCountVal,
              difference: diffVal,
              from: fromck,
              to: item.customerCode || "",
              deliveryCode: item.operatorBatch || "",
              guid: item.guid || "",
              brand: item.brand || "",
            };
          });

          setItems(newItems);

          // We check if tokh is empty/null, which is the destination customer check requested by the user
          const hasEmptyToKh = newItems.some(it => !it.to);
          if (hasEmptyToKh) {
            pubfunction.ShowError("The destination customer cannot be empty!");
            setItems([]);
            setFSystemDeliveryCode("");
            setFSapMainBillCode("");
            bonRef.current?.focus();
            return;
          }

          if (fromck !== "" && fromck !== gs_wareCode) {
            await soapClient.UpdateBillDA(mesUrl, cleanCode);

            setErrorMsg(
              "Source WareHose Must is Login WareHouse " +
              gs_wareCode +
              " Or WareHose = DA** Updated,Scan again!"
            );
            setItems([]);
            setFSystemDeliveryCode("");
            setFSapMainBillCode("");
            bonRef.current?.focus();
            return;
          }

          // Complete successful set as in C#
          setFSapMainBillCode(cleanCode);
          setFSystemDeliveryCode("");
          setFTokh(tokh);
        } else {
          // If vo.billInfoList is null/empty
          setFSystemDeliveryCode("");
          setBonNo("");

          if (fromck !== "") {
            setErrorMsg(tokh + "#" + fromck);
            setFFromck(fromck);
          }
        }
      } else {
        if (sapResult && !sapResult.success) {
          pubfunction.ShowError(cleanCode + " " + (sapResult.msg || "Data loading failed"));
          setBonNo("");
        }
      }
    } catch (err: any) {
      setErrorMsg("Error: " + err.message);

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
      if (f_sapMainBillCode) {
        fetchDeliveryPlan(f_sapMainBillCode);
        setBonNo("");
        bonNoRef.current = "";
      }
    });
    return unsubscribe;
  }, [navigation, f_sapMainBillCode]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      "ON_DELIVERY_REFRESH",
      () => {
        console.log("Refreshing Delivery Plan on Event:", f_sapMainBillCode);
        if (f_sapMainBillCode) {
          fetchDeliveryPlanRef.current(f_sapMainBillCode);
        }
      }
    );
    return () => sub.remove();
  }, [f_sapMainBillCode]);

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
      fetchDeliveryPlan(sn);
    }
  };

  const handleChoice = () => {
    if (selectedIndex === null || !items[selectedIndex]) {
      Alert.alert("Warning", "Please select an item first");
      return;
    }

    const selectedItem = items[selectedIndex];


    // to客户不能为空wqy 2025-5-6 14:17:52
    if (!selectedItem.to || selectedItem.to.trim() === "") {
      pubfunction.ShowError("The destination customer cannot be empty!");
      return;
    }

    // 型号是托盘进行保存
    if (selectedItem.model.toUpperCase() === "PALETTE") {
      if (Number(selectedItem.difference) <= 0) {
        pubfunction.ShowError("Pallet is finish!");
        return;
      }
      navigation.navigate('DeliverySNBox', {
        deliveryCode: selectedItem.deliveryCode,
        systemDeliveryCode: selectedItem.bonNo,
        sapMainBillCode: f_sapMainBillCode,
        customerCode: selectedItem.to,
        model: selectedItem.model,
        qty: selectedItem.difference.toString(),
        planQty: selectedItem.qty,
        finishQty: selectedItem.finishQty,
      });
      return;
    }

    navigation.navigate('DeliverySN', {
      deliveryCode: selectedItem.deliveryCode,
      systemDeliveryCode: selectedItem.bonNo,
      sapMainBillCode: f_sapMainBillCode,
      customerCode: selectedItem.to,
      model: selectedItem.model,
      guid: selectedItem.guid,
      brand: selectedItem.brand,
      planQty: selectedItem.qty,
      finishQty: selectedItem.finishQty,
    });
  };

  const handleSelectIndex = React.useCallback((index: number) => {
    setSelectedIndex(index);
    const item = items[index];
    if (item) {
      setErrorMsg("Source: " + item.to + "#" + (item.from || f_fromck));
    }
  }, [items, f_fromck]);

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
        onPress={() => handleSelectIndex(index)}
      >
        <Text style={[styles.cell, { color: textColor, width: 120 }]}>{item.bonNo}</Text>
        <Text style={[styles.cell, { color: textColor, width: 140 }]}>{item.sapMainBillCode}</Text>
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
  }, [selectedIndex, handleSelectIndex]);

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
          <Text style={styles.headerTitle}> Delivery Scan</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
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
        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 120 }]}>BON NO</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>SAP Bill Code</Text>
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
                extraData={selectedIndex}
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

const { width } = Dimensions.get("window");
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
  card: { backgroundColor: "#FFF", borderRadius: 16, paddingTop: 10, paddingBottom: 8, padding: 8, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: "#0052cc" },
  inputGroup: { marginBottom: 12 },
  input: { backgroundColor: "#e2f0eeff", height: 40, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, color: "#1E293B", fontWeight: "600", borderWidth: 1, borderColor: "#0052cc" },
  tableCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", elevation: 2, borderWidth: 1, borderColor: "#0052cc", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#334155", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 1050 },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 2 },
  detailButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0052cc' },
  detailButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  errorText: { color: "#EF4444", fontSize: 12, marginBottom: 8, fontWeight: "700" },
  selectedRow: { backgroundColor: "#ffc3c3ff" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
