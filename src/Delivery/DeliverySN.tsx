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
  Alert,
  Image,
  Dimensions,
  Animated,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

const AnimatedView = Animated.View as any;

interface ScannedBillItem {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

export default function DeliverySN({ navigation, route }: any) {
  const {
    deliveryCode,
    systemDeliveryCode,
    sapMainBillCode,
    customerCode,
    model,
    guid,
    brand,
    planQty,
    finishQty,
  } = route.params || {};

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress
  } = useGlobalStr();

  // globalstr variables mapped to C# fields
  const [f_modeEAN, setFModeEan] = useState("ean Error");
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [totalScannedCount, setTotalScannedCount] = useState(0);

  const [sn, setSn] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedList, setScannedList] = useState<ScannedBillItem[]>([]);

  const snInputRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const [showKeyboard, setShowKeyboard] = useState(false);

  const [scanState, setScanState] = useState<
    "waiting" | "scanning" | "success" | "error"
  >("waiting");

  // Pulse animation for scan input decoration border
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (scanState === "waiting") {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(borderAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(borderAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      borderAnim.setValue(1);
    }
    return () => {
      animation?.stop();
    };
  }, [scanState]);

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange:
      scanState === "waiting"
        ? ["#0052cc", "#60a5fa"]
        : scanState === "scanning"
          ? ["#f59e0b", "#fbbf24"]
          : scanState === "success"
            ? ["#16a34a", "#4ade80"]
            : ["#dc2626", "#f87171"],
  });

  const animatedBorderWidth = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 4],
  });

  const ensureFocus = () => {
    snInputRef.current?.focus();
  };

  /**
   * Get model EAN Code corresponding to GetModelEAN() in C#
   */
  const getModelEAN = async () => {
    try {
      const urlCur = `${gs_BaseURL}/basedata/model/getListByCondition`;
      const qo = {
        model: model || "",
      };

      const signedQo = pubfunction.SetUserSignInfo(
        qo,
        gs_userCode,
        gs_userName,
        "2",
        gs_PasswordSalt,
        gs_version,
        "en_US"
      );

      const formBody = Object.keys(signedQo).map(key => encodeURIComponent(key) + '=' + encodeURIComponent((signedQo as any)[key])).join('&');
      const response = await fetch(urlCur, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      });

      if (!response.ok) {
        setFModeEan("ean Error");
        return;
      }

      const resData = await response.json();
      console.log("getModelEAN  " + resData.list)
      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;
        console.log("rawList  " + rawList)
        if (rawList && rawList.length > 0) {

          setFModeEan((rawList[0].ean || "").toUpperCase());
          return;
        }
      }
      setFModeEan("ean Error");
    } catch (err) {
      setFModeEan("ean Error");
    }
  };

  /**
   * Loads already scanned output list matching master batch corresponding to GetListFinishBoxList() in C#
   */
  const getListFinishBoxList = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/getDeliveryInfoByOperatorBatch`;
      const billType = "5000";

      const qo = {
        billCode: systemDeliveryCode || "",
        billType: billType,
        model: model || "",
        operatorBatchCode: deliveryCode || "",
        guid: guid || "",
      };

      const signedQo = pubfunction.SetUserSignInfo(
        qo,
        gs_userCode,
        gs_userName,
        "2",
        gs_PasswordSalt,
        gs_version,
        "en_US"
      );

      const formBody = Object.keys(signedQo).map(key => encodeURIComponent(key) + '=' + encodeURIComponent((signedQo as any)[key])).join('&');
      const response = await fetch(urlCur, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      console.log("getListFinishBoxList  " + resData.success)
      if (resData && resData.success && resData.list) {

        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;
        let qtyTotal = 0;
        const listBox = rawList.map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyTotal = qtyTotal + count;

          return {
            id: idx.toString(),
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: String(count),
            scanBarCodeType: item.scanBarCodeType || "",
          };

        });

        // to#from
        setTxtSource((customerCode || "") + "#" + gs_wareCode);
        setScannedList(listBox);
        setTotalScannedCount(qtyTotal);
      } else {
        if (resData && !resData.success) {
          pubfunction.ShowError(resData.msg || "Failed to load finished items list");
        }
      }
    } catch (err: any) {
      pubfunction.ShowError("Failed to fetch scanned details: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Setup mount listeners & initialize parameters
  useEffect(() => {
    getModelEAN();

    if (systemDeliveryCode !== "") {
      getListFinishBoxList();
    }

    setTxtSource((customerCode || "") + "#" + gs_wareCode);
    const plan = parseInt(planQty || "0") || 0;
    const finished = parseInt(finishQty || "0") || 0;
    setTxtQty(`${finished}/${plan}`);

    setTimeout(() => {
      snInputRef.current?.focus();
    }, 400);

    // Event listener for updates from confirmation page
    const reloadSub = DeviceEventEmitter.addListener("ON_DELIVERY_CONFIRM_SUCCESS", (voAndData?: any) => {
      if (voAndData) {
        // Evaluate fields 100% identically to C# palletDeal
        const currentBillCount = parseInt(voAndData.deliveryCount?.currentBillCount || "0") || 0;
        const allDeliveryCount = parseInt(voAndData.deliveryCount?.allDeliveryCount || "0") || 0;

        setTxtSource((customerCode || "") + "#" + gs_wareCode);
        setTxtQty(`${allDeliveryCount}/${currentBillCount}`);

        if (allDeliveryCount >= currentBillCount) {
          // 发货完成 关闭
          pubfunction.ShowError("The delivery of documents has already shipped completed!");
          navigation.goBack();
          return;
        }

        if (voAndData.warehouseSumByScanBarCodeList) {
          let qtyTotal = 0;
          const listBox = voAndData.warehouseSumByScanBarCodeList.map((item: any, idx: number) => {
            const count = parseInt(item.goodsCount || "0") || 0;
            qtyTotal = qtyTotal + count;
            return {
              id: idx.toString(),
              scanBarCode: item.scanBarCode || "",
              model: item.model || "",
              color: item.color || "",
              goodsCount: String(count),
              scanBarCodeType: item.scanBarCodeType || "",
            };
          });

          setScannedList(listBox);
          setTotalScannedCount(qtyTotal);
        } else {
          getListFinishBoxList(true);
        }
      } else {
        getListFinishBoxList(true);
      }

      setSn("");
      setScanState("success");
      setTimeout(() => {
        snInputRef.current?.focus();
      }, 150);
    });

    // Listen to confirm OK event from confirm screen
    const confirmSub = DeviceEventEmitter.addListener("ON_DELIVERY_CONFIRM_OK", (data?: { SN: string; scanType: string }) => {
      if (data && data.SN) {
        palletDeal(data.SN, data.scanType || "sn");
      }
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        snInputRef.current?.focus();
      }, 100);
    });

    return () => {
      reloadSub.remove();
      confirmSub.remove();
      focusSub();
    };
  }, [deliveryCode, systemDeliveryCode]);

  /**
   * Matches palletDeal inside C#
   */
  const palletDeal = async (SN: string, scanType: string) => {
    setLoading(true);
    setScanState("scanning");
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/doWarehouseOutStorage`;

      const qoBody = {
        billCode: systemDeliveryCode || "",
        billType: "5000",
        warehouseCode: gs_wareCode,
        customerCode: customerCode || "",
        storageCode: "",
        scanBarCode: pubfunction.PostSpecialStr(SN || ""),
        scanBarCodeType: scanType || "",
        scanCount: "",
        materialCode: model || "",
        operatorBatch: deliveryCode || "",
        classCode: gs_classCode || "01",
        remark: "",
        workStationType: "delivery",
        sapMainBillCode: sapMainBillCode || "",
        guid: guid || "",
        brand: brand || "",
        deviceIp:gs_IPAddress,
      };

      const signedQo = pubfunction.SetUserSignInfo(
        qoBody,
        gs_userCode,
        gs_userName,
        "2",
        gs_PasswordSalt,
        gs_version,
        "en_US"
      );

      const formBody = Object.keys(signedQo).map(key => encodeURIComponent(key) + '=' + encodeURIComponent((signedQo as any)[key])).join('&');
      const response = await fetch(urlCur, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      });

      if (!response.ok) {
        pubfunction.ShowError(`HTTP Error: ${response.status}`);

      }

      const resData = await response.json();
      console.log("REST doWarehouseOutStorage response:", resData);

      if (resData && resData.success && resData.data) {
        // Evaluate fields 100% identically to C# palletDeal
        const voAndData = resData.data;
        const currentBillCount = parseInt(voAndData.deliveryCount?.currentBillCount || "0") || 0;
        const allDeliveryCount = parseInt(voAndData.deliveryCount?.allDeliveryCount || "0") || 0;

        setTxtSource((customerCode || "") + "#" + gs_wareCode);
        setTxtQty(`${allDeliveryCount}/${currentBillCount}`);

        if (allDeliveryCount >= currentBillCount) {
          // 发货完成 关闭
          pubfunction.ShowError("The delivery of documents has already shipped completed!");
          navigation.goBack();
          return;
        }

        if (voAndData.warehouseSumByScanBarCodeList) {
          let qtyTotal = 0;
          const listBox = voAndData.warehouseSumByScanBarCodeList.map((item: any, idx: number) => {
            const count = parseInt(item.goodsCount || "0") || 0;
            qtyTotal = qtyTotal + count;
            return {
              id: idx.toString(),
              scanBarCode: item.scanBarCode || "",
              model: item.model || "",
              color: item.color || "",
              goodsCount: String(count),
              scanBarCodeType: item.scanBarCodeType || "",
            };
          });

          setScannedList(listBox);
          setTotalScannedCount(qtyTotal);
        } else {
          getListFinishBoxList(true);
        }

        setSn("");
        setScanState("success");
      } else {
        const errMsg = resData ? resData.msg : "Failed to execute out storage";
        pubfunction.ShowError(errMsg);
        setScanState("error");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Failed to execute out storage");
      setScanState("error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        snInputRef.current?.focus();
      }, 150);
    }
  };

  /**
   * Primary processing of scanned parameters 100% equivalent to txtSN_KeyDown callback
   */
  const processScannedInput = (scannedCode: string) => {
    const SN = scannedCode.toUpperCase().trim();
    if (SN.length === 0) return;

    setSn(""); // Clear text input immediately

    // Define scanning resolution logic
    const scanType = pubfunction.getBarcodeType(SN);
    console.log("scanType", scanType)
    // EAN prefix checker identical to Substring(0,3) == "613"
    if (SN.substring(0, 3) === "613") {
      setScanState("error");
      pubfunction.ShowError("Please scan SN/BOX/PALLET,  this is EAN(starts with 613)!");
      setTimeout(() => snInputRef.current?.focus(), 100);
      return;
    }

    setScanState("scanning");

    // Display billing confirmation dialog (represented as navigation to details)
    navigation.navigate("DeliverySNConfirm", {
      fromWarehouseCode: gs_wareCode,
      palletCode: scanType === "PALLET" ? SN : "",
      boxCode: scanType === "BOX" ? SN : "",
      SN: SN,
      scanType: scanType,
      systemDeliveryCode,
      model,
      guid,
      deliveryCode,
      customerCode,
      sapMainBillCode,
      brand,
      f_modeEAN: f_modeEAN,
      planQty: planQty,
      finishQty: finishQty,
      showConfirm: true,
    });
  };

  const handleSnChange = (text: string) => {
    setSn(text);
    clearTimeout(scanTimer.current);

    if (text.endsWith("\n") || text.endsWith("\r")) {
      const clean = text.trim();
      if (clean.length > 0) {
        processScannedInput(clean);
      }
      return;
    }

    if (text.trim().length > 0) {
      scanTimer.current = setTimeout(() => {
        const clean = text.trim();
        if (clean.length > 0) {
          processScannedInput(clean);
        }
      }, 600);
    }
  };

  const handleSnSubmit = (e: any) => {
    const text = e.nativeEvent.text;
    const clean = text.trim();
    if (clean.length > 0) {
      clearTimeout(scanTimer.current);
      processScannedInput(clean);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header with Title corresponding to label_title.Text + " " + gs_wareCode */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery SN {gs_wareCode || ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.formCard}>
          {/* txtSource value */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>SOURCE (TO#FROM)</Text>
            <Text style={styles.infoValue}>{txtSource || "-"}</Text>
          </View>
          {/* txtQty value */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QUANTITY (SHIJI/JIHUA)</Text>
            <Text style={styles.infoValue}>{txtQty || "-"}</Text>
          </View>
          {/* Model EAN display */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>MODEL EAN</Text>
            <Text style={styles.infoValue}>{f_modeEAN || "-"}</Text>
          </View>
          {/* Info Details */}


        </View>

        {/* Input block - txtSN */}
        <View style={styles.inputGroup}>
          <AnimatedView style={{
            borderRadius: 10,
            borderWidth: animatedBorderWidth,
            borderColor: animatedBorderColor,
            backgroundColor: "#e2f0eeff",
            elevation: 4,
          }}>
            <TextInput
              ref={snInputRef}
              style={[styles.input, { borderWidth: 0 }]}
              value={sn}
              onChangeText={handleSnChange}
              //onSubmitEditing={handleSnSubmit}
              placeholder="Scan Pallet / Box / SN Barcode"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              blurOnSubmit={false}
              onBlur={ensureFocus}
              showSoftInputOnFocus={showKeyboard}
            />
          </AnimatedView>
        </View>

        {/* Scanned table details - corresponds to listViewBox */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>Barcode</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Count</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Type</Text>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                {loading ? (
                  <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                ) : scannedList.length === 0 ? (
                  <Text style={styles.emptyText}>No items scanned yet.</Text>
                ) : (
                  scannedList.map((item, index) => (
                    <View
                      key={item.id || index}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                      ]}
                    >
                      <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{item.model || model || ""}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.color || "-"}</Text>
                      <Text style={[styles.cell, { width: 100 }]}>{item.goodsCount}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.scanBarCodeType}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        {/* Total indicator corresponding to lblQtyTotal */}
        <View style={styles.footerRow}>
          <Text style={styles.totalText}>Total: {totalScannedCount}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
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
  headerLeft: { flexDirection: "row", alignItems: "center" },
  returnLogo: { width: scale(23), height: scale(23), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(11), fontWeight: "700" },
  content: { flex: 1, padding: 12 },
  formCard: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 16,
    marginBottom: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#0052cc",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0052cc",
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  infoValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  inputGroup: { marginTop: 2, marginBottom: 6 },
  input: {
    backgroundColor: "transparent",
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "700",
  },
  tableCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 12,
  },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 10, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", alignItems: "center" },
  cell: { fontSize: 10, color: "#1E293B", textAlign: "center", fontWeight: "700" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 620 },
  footerRow: {
    backgroundColor: "#0052cc",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
  },
  totalText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
