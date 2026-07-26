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
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

interface SNDetail {
  scanBarCode: string;
  palletCode: string;
  model: string;
  color: string;
  imei1: string;
  imei2: string;
  imei3: string;
  scanBarCodeType: string;
  goodsCount: string;
  boxCode: string;
}

export default function DeliverySNConfirm({ navigation, route }: any) {
  const {
    fromWarehouseCode,
    palletCode,
    boxCode,
    SN,
    scanType,
    systemDeliveryCode,
    model,
    guid,
    deliveryCode,
    customerCode,
    sapMainBillCode,
    brand,
    f_modeEAN,
  } = route.params || {};

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_remark,
    gs_classCode,
  } = useGlobalStr();

  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<SNDetail[]>([]);
  const [eanCode, setEanCode] = useState("");
  const [labelQtyTotal, setLabelQtyTotal] = useState("");
  const [showEanPanel, setShowEanPanel] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const eanInputRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  /**
   * Matches BoxListShow() in C#
   */
  const boxListShow = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/getScanBarCodeSumInfo`;

      // Build body model equivalent to WarehouseBillScanQO in C#
      const requestQo = {
        billCode: "",
        billType: "",
        warehouseCode: gs_wareCode,
        scanBarCode: pubfunction.PostSpecialStr(SN || ""),
        scanBarCodeType: scanType || "",
        model: model || "",
        guid: guid || "",
      };

      const signedQo = pubfunction.SetUserSignInfo(
        requestQo,
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
        return;
      }

      const resData = await response.json();
      console.log("REST getScanBarCodeSumInfo response:", response);

      let rawList: any[] = [];
      if (resData) {
        if (Array.isArray(resData.list)) {
          rawList = resData.list;
        } else if (resData.data) {
          rawList = typeof resData.data === "string" ? JSON.parse(resData.data) : resData.data;
        }
      }

      if (Array.isArray(rawList) && rawList.length > 0) {
        let qtyAll = 0;
        const formatted: SNDetail[] = rawList.map((item: any) => {
          const countVal = parseInt(item.goodsCount || "1") || 0;
          qtyAll += countVal;
          return {
            scanBarCode: item.scanBarCode || "",
            palletCode: item.palletCode || "",
            model: item.model || "",
            color: item.color || "",
            imei1: item.imei1 || item.imeiCode1 || "",
            imei2: item.imei2 || item.imeiCode2 || "",
            imei3: item.imei3 || item.imeiCode3 || "",
            scanBarCodeType: item.scanBarCodeType || "",
            goodsCount: String(countVal),
            boxCode: item.boxCode || "",
          };
        });

        setDetails(formatted);
        setLabelQtyTotal(SN + " Total qty:" + qtyAll);
        setShowEanPanel(false);
      } else {
        handleEmptyStockDetails();
        //pubfunction.ShowError(resData.msg);
      }
    } catch (err: any) {
      handleEmptyStockDetails();
      pubfunction.ShowError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmptyStockDetails = () => {
    setDetails([]);
    setShowEanPanel(true);
    setLabelQtyTotal(`This SN ${SN} not exist: Already delivery or Already AllocateOut not in warehouse!`);
    setTimeout(() => {
      eanInputRef.current?.focus();
    }, 500);
  };

  useEffect(() => {
    if (SN) {
      boxListShow();
    }
    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, [SN]);

  /**
   * Matches CheckModelEAN() in C#
   */
  const checkModelEAN = (EAN: string): boolean => {
    if (EAN == (f_modeEAN || "").toUpperCase().trim()) {
      return true;
    } else {
      setLabelQtyTotal("EAN error, Ok is: " + f_modeEAN);
      return false;
    }
  };

  /**
   * Matches OldSNAddIn() in C#
   */
  const oldSNAddIn = async (EAN: string) => {
    setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/inventory/billSn/doAddInventoryOldSNAdd`;

      const qo = {
        SN: pubfunction.PostSpecialStr(SN || ""),
        ean: EAN,
        model: model || "",
        warehouseCode: gs_wareCode,
        classCode: gs_classCode || "01",
        brand: brand || "",
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
        pubfunction.ShowError(`HTTP Error: ${response.status}`);
      }

      const resData = await response.json();
      console.log("REST doAddInventoryOldSNAdd response:", resData);

      if (resData && resData.success) {
        // Automatically close and confirm outbound as DialogResult = OK in C#
        DeviceEventEmitter.emit("ON_DELIVERY_CONFIRM_OK", { SN, scanType });
        navigation.goBack();
      } else {
        const errMsg = resData ? resData.msg : "doAddInventoryOldSNAdd error!";
        setLabelQtyTotal(errMsg);
      }
    } catch (err: any) {
      setLabelQtyTotal(err.message || "Failed to add old SN");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches txtEAN_KeyDown in C# (keyValue == 13 / submit)
   */
  const handleEanSubmit = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    const EAN = eanCode.toUpperCase().trim();
    if (EAN.length > 0) {
      if ((gs_remark || "").toUpperCase() !== "EAN") {
        pubfunction.ShowError("You don't have permission to scan EAN!");
        return;
      }

      const eanIsOk = checkModelEAN(EAN);
      if (eanIsOk) {
        oldSNAddIn(EAN);
      }
    }
  };

  /**
   * Automatic submit on text change with debounce for EAN
   */
  const handleTextChange = (text: string) => {
    setEanCode(text);

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    scanTimerRef.current = setTimeout(() => {
      if ((gs_remark || "").toUpperCase() !== "EAN") {
        pubfunction.ShowError("You don't have permission to scan EAN!");
        return;
      }

      const EAN = trimmed.toUpperCase();
      const eanIsOk = checkModelEAN(EAN);
      if (eanIsOk) {
        oldSNAddIn(EAN);
      }
      setEanCode("");
    }, 600);
  };

  /**
   * Matches button_Confirm_Click in C#
   */
  const handleConfirmStorage = () => {
    if (details.length >= 1) {
      DeviceEventEmitter.emit("ON_DELIVERY_CONFIRM_OK", { SN, scanType });
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header with standard UI */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm SN Delivery</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Model EAN label corresponding to lblModel.Text */}
        <View style={styles.modelTagBanner}>
          <View style={styles.modelTagCol}>
            <Text style={styles.modelTagLabel}>MODEL</Text>
            <Text style={styles.modelTagValue}>{model || "-"}</Text>
          </View>
          <View style={styles.modelTagCol}>
            <Text style={styles.modelTagLabel}>EAN</Text>
            <Text style={styles.modelTagValue}>{f_modeEAN || "-"}</Text>
          </View>
        </View>

        {/* Status indicator corresponding to label_qtyTotal */}
        {labelQtyTotal ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusText}>{labelQtyTotal}</Text>
          </View>
        ) : null}

        {/* EAN fields equivalent to lblEAN and txtEAN inside C# */}
        {showEanPanel ? (
          <View style={styles.eanCard}>
            <View style={styles.eanInputRow}>
              <TextInput
                ref={eanInputRef}
                style={styles.eanInput}
                value={eanCode}
                onChangeText={handleTextChange}
                placeholder="Scan / Input product EAN"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                //onSubmitEditing={handleEanSubmit}
                blurOnSubmit={false}
                onBlur={() => eanInputRef.current?.focus()}
                showSoftInputOnFocus={showKeyboard}
              />
            </View>
          </View>
        ) : null}

        {/* Scan Bar Code Sum Info list equivalent to listViewBox */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 50 }]}>No</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>Barcode</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>Pallet Code</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 1</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 2</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 3</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Type</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Count</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>Box Code</Text>
              </View>

              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={true}>
                {loading ? (
                  <ActivityIndicator size="large" color="#0052cc" style={{ marginTop: 40 }} />
                ) : details.length === 0 ? (
                  <Text style={styles.emptyText}>Waiting for details load or Exception bypass...</Text>
                ) : (
                  details.map((item, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 ? { backgroundColor: "#FFFFFF" } : { backgroundColor: "#BAE6FD" },
                      ]}
                    >
                      <Text style={[styles.cell, { width: 50 }]}>{index + 1}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{item.palletCode || "-"}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{item.model || "-"}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.color || "-"}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei1 || "-"}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei2 || "-"}</Text>
                      <Text style={[styles.cell, { width: 120 }]}>{item.imei3 || "-"}</Text>
                      <Text style={[styles.cell, { width: 100 }]}>{item.scanBarCodeType || "-"}</Text>
                      <Text style={[styles.cell, { width: 100 }]}>{item.goodsCount}</Text>
                      <Text style={[styles.cell, { width: 140 }]}>{item.boxCode || "-"}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </View>

        {/* Standard Confirms and Exit Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnConfirm]}
            onPress={handleConfirmStorage}
            disabled={loading}
          >
            <Text style={styles.btnTextConfirm}>Confirm OK</Text>
          </TouchableOpacity>
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
  modelTagBanner: {
    backgroundColor: "#0052cc",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modelTagCol: {
    flex: 1,
    alignItems: "center",
  },
  modelTagLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modelTagValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  statusBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  statusText: { color: "red", fontSize: 10, fontWeight: "800", textAlign: "center" },
  eanCard: {
    marginBottom: 8,
  },
  eanHeading: { fontSize: 9, fontWeight: "900", color: "#0052cc", marginBottom: 5 },
  eanInputRow: { flexDirection: "row" },
  eanInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    height: 40,
    borderWidth: 1,
    borderColor: "#0052cc",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    color: "#1E293B",
    fontWeight: "700",
  },
  eanBtn: {
    width: 60,
    backgroundColor: "#0052cc",
    height: 38,
    borderRadius: 8,
    marginLeft: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  eanBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
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
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 1300 },
  footer: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },
  btnPrior: { backgroundColor: "#64748B" },
  btnConfirm: { backgroundColor: "#10B981" },
  btnTextPrior: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  btnTextConfirm: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});
