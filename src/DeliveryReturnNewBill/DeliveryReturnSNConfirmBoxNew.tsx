import React, { useState, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

interface ConfirmBoxItem {
  id: string;
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

export default function DeliveryReturnSNConfirmBoxNew({ navigation, route }: any) {
  // Page pass values
  const f_systemDeliveryCode = route.params?.f_systemDeliveryCode ?? "";
  const f_barCode = route.params?.f_barCode ?? "";
  const f_scanType = route.params?.f_scanType ?? "";
  const f_model = route.params?.f_model ?? "";

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
  } = useGlobalStr();

  // Screen States
  const [labelQtyTotal, setLabelQtyTotal] = useState("");
  const [items, setItems] = useState<ConfirmBoxItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Frm_DeliveryReturnSNConfirmBoxNew_Load
  useEffect(() => {
    BoxListShow();
  }, []);

  /**
   * Matches BoxListShow in C#
   */
  const BoxListShow = async () => {
    setLoading(true);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/billInfo/getDeliveryReInScanBarCodeSumInfo`;
      const billType = "5003";

      // Build Class structure WarehouseBillScanQO
      const qo = {
        billCode: f_systemDeliveryCode,
        billType: billType,
        warehouseCode: gs_wareCode,
        scanBarCode: pubfunction.PostSpecialStr(f_barCode),
        scanBarCodeType: f_scanType,
        model: f_model,
      };

      // General signature class assignment
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
      console.log("getDeliveryReInScanBarCodeSumInfo response:", resData);

      let qtyAll = 0;

      if (resData && resData.success && resData.list) {
        const rawList = typeof resData.list === "string" ? JSON.parse(resData.list) : resData.list;

        const mappedItems: ConfirmBoxItem[] = rawList.map((item: any, idx: number) => {
          const count = parseInt(item.goodsCount || "0") || 0;
          qtyAll += count;

          return {
            id: String(idx),
            scanBarCode: item.scanBarCode || "",
            palletCode: item.palletCode || "",
            model: item.model || "",
            color: item.color || "",
            imei1: item.imei1 || "",
            imei2: item.imei2 || "",
            imei3: item.imei3 || "",
            scanBarCodeType: item.scanBarCodeType || "",
            goodsCount: String(count),
            boxCode: item.boxCode || "",
          };
        });

        setItems(mappedItems);
      } else {
        if (resData && !resData.success) {
          pubfunction.ShowError(resData.msg || "Loading error");
        }
      }

      setLabelQtyTotal(`${f_barCode} Total qty:${qtyAll}`);
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Matches button_Confirm_Click in C#
   */
  const handleConfirmClick = () => {
    if (items.length >= 1) {
      DeviceEventEmitter.emit("ON_DELIVERY_RETURN_CONFIRM_OK", {
        SN: f_barCode,
        scanType: f_scanType,
      });
    }
    navigation.goBack();
  };

  /**
   * Matches button_exit_Click in C#
   */
  const handleExitClick = () => {
    navigation.goBack();
  };

  const renderItem = ({ item, index }: { item: ConfirmBoxItem; index: number }) => {
    return (
      <View
        style={[
          styles.tableRow,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }
        ]}
      >
        <Text style={[styles.cell, { width: 150 }]}>{item.scanBarCode}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.palletCode}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 100 }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imei1}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imei2}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.imei3}</Text>
        <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
        <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { width: 120 }]}>{item.boxCode}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Return Confirm Box</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Quantity status header label */}
        <View style={styles.statusLabelCard}>
          <Text style={styles.statusLabelText}>{labelQtyTotal || "Loading details..."}</Text>
        </View>

        {/* Horizontal & Vertical scrolling list table */}
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              <View style={styles.tableHeader}>
                <Text style={[styles.headerCell, { width: 150 }]}>BARCODE</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Pallet Code</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Model</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>Color</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 1</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 2</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI 3</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>Type</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>Box Code</Text>
              </View>

              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No matching barcodes found in delivery</Text>
                }
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>

        {/* Footer actions */}
        <View style={styles.footer}>


          <TouchableOpacity
            style={[styles.btn, styles.confirmBtn]}
            onPress={handleConfirmClick}
          >
            <Text style={styles.btnText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0052cc" />
        </View>
      )}
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
  returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 8 },
  statusLabelCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
    alignItems: "center",
  },
  statusLabelText: {
    color: "red",
    fontSize: 13,
    fontWeight: "900",
  },
  tableCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  tableHeader: { flexDirection: "row", backgroundColor: "#0052cc", paddingVertical: 10 },
  headerCell: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", textAlign: "center" },
  tableRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  cell: { fontSize: 11, color: "#1E293B", textAlign: "center", fontWeight: "600" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic", width: 1110 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
  },
  btn: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  exitBtn: { backgroundColor: "#64748B" },
  confirmBtn: { backgroundColor: "#0052cc" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
