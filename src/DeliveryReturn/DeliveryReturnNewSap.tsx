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
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

interface ScannedBoxItem {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

export default function DeliveryReturnNewSap({ navigation, route }: any) {
  // Page pass value
  const f_deliveryCode = route.params?.f_deliveryCode ?? "";
  const f_systemDeliveryCode = route.params?.f_systemDeliveryCode ?? "";
  const f_model = route.params?.f_model ?? "";
  const f_customerCode = route.params?.f_customerCode ?? "";
  const f_sapMainBillCode = route.params?.f_sapMainBillCode ?? "";

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

  // Screen States
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [txtSN, setTxtSN] = useState("");
  const [lblQtyTotal, setLblQtyTotal] = useState("");
  const [scannedList, setScannedList] = useState<ScannedBoxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // On Load
  useEffect(() => {
    if (f_systemDeliveryCode) {
      GetListFinishBoxList();
    }
    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    // Register DeviceEventEmitter listener for scanning confirmation
    const confirmSub = DeviceEventEmitter.addListener("ON_DELIVERY_RETURN_CONFIRM_OK", (data: { SN: string; scanType: string }) => {
      if (data && data.SN) {
        palletDeal(data.SN, data.scanType);
      }
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    return () => {
      confirmSub.remove();
      focusSub();
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, [f_systemDeliveryCode]);

  /**
   * Matches GetListFinishBoxList in C#
   */
  const GetListFinishBoxList = async () => {
    setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/getReceiptInfoByOperatorBatch`;
      const billType = "5003";

      // Build Class structure WarehouseBillModelQO
      const qo = {
        billCode: f_systemDeliveryCode,
        billType: billType,
        model: f_model,
        operatorBatchCode: f_deliveryCode,
      };

      // Set user signature
      const signedQo = pubfunction.SetUserSignInfo(
        qo,
        gs_userCode,
        gs_userName,
        "2",
        gs_PasswordSalt,
        gs_version,
        "en_US"
      );

      // url获取测试
      const urlTest = urlCur + "?" + pubfunction.classToUrlStr(signedQo);
      console.log("urlTest:", urlTest);

      // to#from label
      setTxtSource(`${f_customerCode}#${gs_wareCode}`);

      const formBody = Object.keys(signedQo).map(key => encodeURIComponent(key) + '=' + encodeURIComponent((signedQo as any)[key])).join('&');
      const response = await fetch(urlCur, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },//application/json
        body: formBody,
      });

      if (!response.ok) {
        pubfunction.ShowError(`HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      console.log("getReceiptInfoByOperatorBatch response:", resData);

      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;

        let qtyTotal = 0;
        const mappedList: ScannedBoxItem[] = rawList.map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyTotal += count;

          return {
            id: String(idx),
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: String(count),
            scanBarCodeType: item.scanBarCodeType || "",
          };
        });

        setScannedList(mappedList);
        setLblQtyTotal(`Total: ${qtyTotal}`);
      } else {
        if (resData && !resData.success) {
          pubfunction.ShowError(resData.msg || "Failed to load scan history");
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches txtSN_KeyDown callback
   */
  const handleSNSubmit = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    const SN = txtSN.toUpperCase().trim();
    if (!SN) return;

    // Scan type resolution
    const scanType = pubfunction.getBarcodeType(SN);

    // Open confirm screen DeliveryReturnSNConfirmBoxNew
    navigation.navigate("DeliveryReturnSNConfirmBoxNew", {
      f_systemDeliveryCode: f_systemDeliveryCode,
      f_barCode: SN,
      f_scanType: scanType,
      f_model: f_model,
    });

    setTxtSN("");
  };

  /**
   * Automatic submit on text change with debounce
   */
  const handleTextChange = (text: string) => {
    setTxtSN(text);

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    scanTimerRef.current = setTimeout(() => {
      const scanType = pubfunction.getBarcodeType(trimmed.toUpperCase());
      navigation.navigate("DeliveryReturnSNConfirmBoxNew", {
        f_systemDeliveryCode: f_systemDeliveryCode,
        f_barCode: trimmed.toUpperCase(),
        f_scanType: scanType,
        f_model: f_model,
      });
      setTxtSN("");
    }, 800);
  };

  /**
   * Matches palletDeal in C#
   */
  const palletDeal = async (barCode: string, scanType: string) => {
    setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/doNotSignWarehouseInStorage`;
      const billType = "5003";

      // Build Class structure WarehouseOutStorageQO
      const qo = {
        billCode: f_systemDeliveryCode,
        billType: billType,
        warehouseCode: gs_wareCode,
        customerCode: f_customerCode,
        storageCode: "",
        scanBarCode: pubfunction.PostSpecialStr(barCode),
        scanBarCodeType: scanType,
        scanCount: "",
        materialCode: f_model,
        operatorBatch: f_deliveryCode,
        classCode: gs_classCode || "01",
        remark: "",
        workStationType: "deliveryReturn",
        sapMainBillCode: f_sapMainBillCode,
        deviceIp: gs_IPAddress,
      };

      // Set user signature info
      const signedQo = pubfunction.SetUserSignInfo(
        qo,
        gs_userCode,
        gs_userName,
        "2",
        gs_PasswordSalt,
        gs_version,
        "en_US"
      );

      const formBody = Object.keys(signedQo)
        .map((key) => {
          const value = (signedQo as any)[key];

          return (
            encodeURIComponent(key) +
            "=" +
            encodeURIComponent(
              value === null || value === undefined
                ? ""
                : String(value)
            )
          );
        })
        .join("&");

      // url获取测试
      const urlTest = urlCur + "?" + pubfunction.classToUrlStr(signedQo);
      console.log("urlTest:", urlTest);

      const response = await fetch(urlCur, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },//application/json
        body:formBody,
      });

      if (!response.ok) {
        pubfunction.ShowError(`HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      console.log("doNotSignWarehouseInStorage response:", resData);

      if (resData && resData.success && resData.data) {
        const vo = typeof resData.data === "string" ? JSON.parse(resData.data) : resData.data;

        const jihuaQty = parseInt(vo.receiptCount?.hasDeliveryCount || "0") || 0;
        const shijiQty = parseInt(vo.receiptCount?.allReceiptCount || "0") || 0;

        // update txtSource and txtQty
        setTxtSource(`${gs_wareCode}#${f_customerCode}`);
        setTxtQty(`${shijiQty}/${jihuaQty}`);

        if (shijiQty >= jihuaQty) {
          pubfunction.ShowError("The allocate of documents has already shipped completed!");
          DeviceEventEmitter.emit("ON_DELIVERY_RETURN_REFRESH");
          navigation.goBack();
          return;
        }

        let qtyTotal = 0;
        const mappedList: ScannedBoxItem[] = (vo.warehouseSumByScanBarCodeList || []).map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyTotal += count;

          return {
            id: String(idx),
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: String(count),
            scanBarCodeType: item.scanBarCodeType || "",
          };
        });

        setScannedList(mappedList);
        setLblQtyTotal(`Total: ${qtyTotal}`);
      } else {
        if (resData && !resData.success) {
          pubfunction.ShowError(resData.msg || "Save barcode error");
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    }
  };

  const renderScannedRow = ({ item, index }: { item: ScannedBoxItem; index: number }) => {
    return (
      <View
        style={[
          styles.row,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
        <Text style={[styles.cell, { width: 140 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 80 }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.scanBarCodeType}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Return New {gs_wareCode || ""}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Info Rows */}
        <View style={styles.infoCardWrapper}>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Source</Text>
            <Text style={styles.infoValueWhite}>{txtSource || "-"}</Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Qty</Text>
            <Text style={styles.infoValueWhite}>{txtQty || "-"}</Text>
          </View>
          <View style={[styles.infoRowItem, { marginBottom: 0 }]}>
            <Text style={styles.infoLabelWhite}>Model</Text>
            <Text style={styles.infoValueWhite}>{f_model || "-"}</Text>
          </View>
        </View>

        {/* Input Barcode */}
        <View style={{ marginBottom: 12 }}>
          <TextInput
            ref={txtSNRef}
            style={styles.textInput}
            value={txtSN}
            onChangeText={handleTextChange}
            // onSubmitEditing={handleSNSubmit}
            placeholder=" SCAN BARCODE (PALLET/BOX/SN)"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
        </View>

        {/* List of scanned items */}
        <View style={styles.listCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>TYPE</Text>
              </View>

              <FlatList
                data={scannedList}
                renderItem={renderScannedRow}
                keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
                ListEmptyComponent={
                  <Text style={[styles.emptyText, { width: 560 }]}>No items scanned yet.</Text>
                }
              />
            </View>
          </ScrollView>

          {lblQtyTotal ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalText}>{lblQtyTotal}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#06b86c" />
        </View>
      )}
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
  returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 8 },
  infoCardWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
  },
  infoRowItem: {
    backgroundColor: factoryColor,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabelWhite: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  infoValueWhite: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: factoryColor,
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: factoryColor,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: {
    fontSize: 11,
    color: "#1E293B",
    textAlign: "center",
    fontWeight: "600",
  },
  emptyText: {
    textAlign: "center",
    padding: 40,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  totalRow: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "flex-end",
  },
  totalText: {
    fontSize: 13,
    fontWeight: "900",
    color: factoryColor,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});