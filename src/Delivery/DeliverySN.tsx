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
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

interface ScannedBillItem {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

// ---- Anti double-scan settings ----
const SCAN_DEBOUNCE_MS = 500;       // silence needed to consider a scan finished (no terminator)
const DUPLICATE_WINDOW_MS = 1500;   // same code received twice within this window = scanner bounce
const REQUEST_TIMEOUT_MS = 20000;   // RN Android fetch has no timeout by default
const NAV_LOCK_FALLBACK_MS = 1500;  // release the navigation lock if navigate() did not leave this screen

/**
 * Converts the server list to table rows + total quantity
 */
const mapScannedList = (rawList: any[]) => {
  let total = 0;
  const list: ScannedBillItem[] = rawList.map((item: any, idx: number) => {
    const count = parseInt(item.goodsCount || "0") || 0;
    total = total + count;
    return {
      id: idx.toString(),
      scanBarCode: item.scanBarCode || "",
      model: item.model || "",
      color: item.color || "",
      goodsCount: String(count),
      scanBarCodeType: item.scanBarCodeType || "",
    };
  });
  return { list, total };
};

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
    gs_IPAddress,
    gs_factoryindex,
  } = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  // globalstr variables mapped to C# fields
  const [f_modeEAN, setFModeEan] = useState("ean Error");
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [totalScannedCount, setTotalScannedCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [scannedList, setScannedList] = useState<ScannedBillItem[]>([]);

  const snInputRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const [showKeyboard, setShowKeyboard] = useState(false);

  const [scanState, setScanState] = useState<
    "waiting" | "scanning" | "success" | "error"
  >("waiting");

  // ---- Refs used to avoid double scan / double insert ----
  // true while doWarehouseOutStorage is running (synchronous lock, unlike a state)
  const isSubmittingRef = useRef(false);
  // false while another screen (confirm) is on top or navigation is in progress
  const screenActiveRef = useRef(true);
  // last scanned code + time, to ignore scanner bounces
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  // codes already accepted by the server during this screen session
  const submittedCodesRef = useRef<Set<string>>(new Set());
  // always-fresh copy of scannedList (avoids stale closures in timers/listeners)
  const scannedListRef = useRef<ScannedBillItem[]>([]);
  scannedListRef.current = scannedList;
  // always-fresh handlers for timers and DeviceEventEmitter listeners
  const handlersRef = useRef<any>({});

  const ensureFocus = () => {
    // Do not steal the focus while the confirm screen is displayed
    if (!screenActiveRef.current) return;
    snInputRef.current?.focus();
  };

  /**
   * Signed POST (form-urlencoded) with timeout. Throws on HTTP error / timeout.
   */
  const postForm = async (url: string, payload: any) => {
    const signedQo = pubfunction.SetUserSignInfo(
      payload,
      gs_userCode,
      gs_userName,
      "2",
      gs_PasswordSalt,
      gs_version,
      "en_US"
    );

    const formBody = Object.keys(signedQo)
      .map(key => encodeURIComponent(key) + '=' + encodeURIComponent((signedQo as any)[key]))
      .join('&');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err && err.name === "AbortError") {
        throw new Error("Request timeout, please check the network.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * Get model EAN Code corresponding to GetModelEAN() in C#
   */
  const getModelEAN = async () => {
    try {
      const resData = await postForm(`${gs_BaseURL}/basedata/model/getListByCondition`, {
        model: model || "",
      });

      console.log("getModelEAN  " + resData?.list);
      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;
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
      const resData = await postForm(`${gs_BaseURL}/warehouse/billInfo/getDeliveryInfoByOperatorBatch`, {
        billCode: systemDeliveryCode || "",
        billType: "5000",
        model: model || "",
        operatorBatchCode: deliveryCode || "",
        guid: guid || "",
      });

      console.log("getListFinishBoxList  " + resData?.success);
      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;
        const { list, total } = mapScannedList(rawList);

        // to#from
        setTxtSource((customerCode || "") + "#" + gs_wareCode);
        setScannedList(list);
        setTotalScannedCount(total);
      } else if (resData && !resData.success) {
        pubfunction.ShowError(resData.msg || "Failed to load finished items list");
      }
    } catch (err: any) {
      pubfunction.ShowError("Failed to fetch scanned details: " + err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  /**
   * Applies the server result (deliveryCount + list) - identical to C# palletDeal.
   * Returns true when the delivery is completed (screen closed).
   */
  const applyDeliveryResult = (voAndData: any): boolean => {
    const currentBillCount = parseInt(voAndData.deliveryCount?.currentBillCount || "0") || 0;
    const allDeliveryCount = parseInt(voAndData.deliveryCount?.allDeliveryCount || "0") || 0;

    setTxtSource((customerCode || "") + "#" + gs_wareCode);
    setTxtQty(`${allDeliveryCount}/${currentBillCount}`);

    if (allDeliveryCount >= currentBillCount) {
      // 发货完成 关闭
      pubfunction.ShowError("The delivery of documents has already shipped completed!");
      navigation.goBack();
      return true;
    }

    if (voAndData.warehouseSumByScanBarCodeList) {
      const { list, total } = mapScannedList(voAndData.warehouseSumByScanBarCodeList);
      setScannedList(list);
      setTotalScannedCount(total);
    } else {
      getListFinishBoxList(true);
    }
    return false;
  };

  /**
   * Matches palletDeal inside C#
   */
  const palletDeal = async (SN: string, scanType: string) => {
    const code = (SN || "").toUpperCase().trim();
    if (!code) return;

    // 1) Never run two submissions at the same time (set synchronously, before any await)
    if (isSubmittingRef.current) {
      console.log("palletDeal ignored (already submitting):", code);
      return;
    }

    // 2) Never send again a barcode already accepted by the server
    if (submittedCodesRef.current.has(code)) {
      setScanState("error");
      pubfunction.ShowError(code + "  This barcode has already been scanned!");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setScanState("scanning");
    try {
      const resData = await postForm(`${gs_BaseURL}/warehouse/billInfo/doWarehouseOutStorage`, {
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
        deviceIp: gs_IPAddress,
      });

      console.log("REST doWarehouseOutStorage response:", resData);

      if (resData && resData.success) {
        // The server accepted it: remember it so it can never be sent twice
        submittedCodesRef.current.add(code);

        if (resData.data) {
          if (applyDeliveryResult(resData.data)) return;
        } else {
          // success without data: just reload the list
          getListFinishBoxList(true);
        }

        snInputRef.current?.clear();
        setScanState("success");
      } else {
        const errMsg = resData ? resData.msg : "Failed to execute out storage";
        pubfunction.ShowError(errMsg);
        setScanState("error");
      }
    } catch (err: any) {
      // Unknown outcome (timeout / network): the server may have inserted the barcode.
      // Resync the list so the duplicate check relies on the real server state.
      getListFinishBoxList(true);
      pubfunction.ShowError(
        (err.message || "Failed to execute out storage") +
          "\nCheck the scanned list before scanning again."
      );
      setScanState("error");
    } finally {
      isSubmittingRef.current = false;
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

    snInputRef.current?.clear(); // Clear text input immediately

    // Ignore scans while the confirm screen is on top, while navigating, or while a request is running
    if (!screenActiveRef.current || isSubmittingRef.current) {
      console.log("scan ignored (screen busy):", SN);
      return;
    }

    // Ignore scanner double trigger (same code received twice in a short time)
    const now = Date.now();
    if (lastScanRef.current.code === SN && now - lastScanRef.current.time < DUPLICATE_WINDOW_MS) {
      console.log("scan ignored (duplicate within window):", SN);
      return;
    }
    lastScanRef.current = { code: SN, time: now };

    console.log("before SN =", SN);
    const scanType = pubfunction.getBarcodeType(SN);
    console.log("scanType", scanType);

    // EAN prefix checker identical to Substring(0,3) == "613"
    if (SN.substring(0, 3) === "613") {
      setScanState("error");
      pubfunction.ShowError("Please scan SN/BOX/PALLET,  this is EAN(starts with 613)!");
      setTimeout(() => snInputRef.current?.focus(), 100);
      return;
    }

    // Already scanned: either accepted during this session, or present in the server list
    const isAlreadyScanned =
      submittedCodesRef.current.has(SN) ||
      scannedListRef.current.some(
        item => item.scanBarCode && item.scanBarCode.toUpperCase() === SN
      );
    if (isAlreadyScanned) {
      setScanState("error");
      pubfunction.ShowError(SN + "  This barcode has already been scanned!");
      setTimeout(() => snInputRef.current?.focus(), 100);
      return;
    }

    setScanState("scanning");

    // Lock this screen until we come back (focus event) - nothing else can be scanned meanwhile
    screenActiveRef.current = false;

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

    // Safety net: if navigation did not happen, unlock the screen
    setTimeout(() => {
      if (navigation.isFocused()) {
        screenActiveRef.current = true;
        setScanState("waiting");
      }
    }, NAV_LOCK_FALLBACK_MS);
  };

  // Always expose the latest versions to timers and event listeners
  handlersRef.current = {
    palletDeal,
    applyDeliveryResult,
    getListFinishBoxList,
    processScannedInput,
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
        if (handlersRef.current.applyDeliveryResult(voAndData)) return;
      } else {
        handlersRef.current.getListFinishBoxList(true);
      }

      snInputRef.current?.clear();
      setScanState("success");
      setTimeout(() => {
        snInputRef.current?.focus();
      }, 150);
    });

    // Listen to confirm OK event from confirm screen
    const confirmSub = DeviceEventEmitter.addListener("ON_DELIVERY_CONFIRM_OK", (data?: { SN: string; scanType: string }) => {
      if (data && data.SN) {
        handlersRef.current.palletDeal(data.SN, data.scanType || "sn");
      }
    });

    const focusSub = navigation.addListener("focus", () => {
      screenActiveRef.current = true;

      if (!isSubmittingRef.current) {
        // Back from the confirm screen without validating (cancel): allow a new scan of the same code
        lastScanRef.current = { code: "", time: 0 };
        setScanState(prev => (prev === "scanning" ? "waiting" : prev));
      }

      setTimeout(() => {
        snInputRef.current?.focus();
      }, 100);
    });

    const blurSub = navigation.addListener("blur", () => {
      screenActiveRef.current = false;
      clearTimeout(scanTimer.current);
      snInputRef.current?.clear();
    });

    return () => {
      reloadSub.remove();
      confirmSub.remove();
      focusSub();
      blurSub();
      clearTimeout(scanTimer.current);
    };
  }, [deliveryCode, systemDeliveryCode]);

  const handleSnChange = (text: string) => {
    clearTimeout(scanTimer.current);
    if (text.length === 0) return;

    // Scanner sent a terminator: the scan is complete
    if (text.endsWith("\n") || text.endsWith("\r")) {
      handlersRef.current.processScannedInput(text);
      return;
    }

    // Otherwise wait for a short silence (uses the latest handler, no stale closure)
    scanTimer.current = setTimeout(() => {
      handlersRef.current.processScannedInput(text);
    }, SCAN_DEBOUNCE_MS);
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
            <Text style={styles.infoLabel}>SOURCE</Text>
            <Text style={styles.infoValue}>{txtSource || "-"}</Text>
          </View>
          {/* txtQty value */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>QUANTITY </Text>
            <Text style={styles.infoValue}>{txtQty || "-"}</Text>
          </View>
          {/* Model EAN display */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>MODEL EAN</Text>
            <Text style={styles.infoValue}>{f_modeEAN || "-"}</Text>
          </View>
        </View>

        {/* Input block - txtSN */}
        <View style={styles.inputGroup}>
          <View style={{
            borderRadius: 10,
            borderWidth: scanState === "waiting" ? 1 : 2,
            borderColor: scanState === "waiting" ? "#06b86c" : scanState === "scanning" ? "#f59e0b" : scanState === "success" ? "#16a34a" : "#dc2626",
            backgroundColor: "#e2f0eeff",
            elevation: 4,
          }}>
            <TextInput
              ref={snInputRef}
              style={[styles.input, { borderWidth: 0 }]}
              onChangeText={handleSnChange}
              placeholder="Scan Pallet / Box / SN Barcode"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              keyboardType="visible-password"
              blurOnSubmit={false}
              onBlur={ensureFocus}
              showSoftInputOnFocus={showKeyboard}
            />
          </View>
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
        <ActivityIndicator size="large" color={gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc"} style={{ marginTop: 40 }} />
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

const createStyles = (factoryColor: string) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: factoryColor,
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
    borderColor: factoryColor,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: factoryColor,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  infoValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
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
    borderColor: factoryColor,
    marginBottom: 12,
  },
  tableHeader: { flexDirection: "row", backgroundColor: factoryColor, paddingVertical: 10 },
  headerCell: { fontSize: 10, fontWeight: "900", color: "#FFFFFF", textAlign: "center", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", alignItems: "center" },
  cell: { fontSize: 10, color: "#1E293B", textAlign: "center", fontWeight: "700" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 620 },
  footerRow: {
    backgroundColor: factoryColor,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 4,
  },
  totalText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
});