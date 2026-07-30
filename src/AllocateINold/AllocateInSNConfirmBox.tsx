import React, { useState, useEffect } from "react";
import {
SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
  ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as allocateInClient from "./allocateInNOClient";

interface SumItem {
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

export default function AllocateInSNConfirmBox({ navigation, route }: any) {
  const {
    f_systemDeliveryCode,
    f_barCode,
    f_scanType,
    f_model,
    f_fromck,
    f_guid,
    f_brand
  } = route.params || {};

  const {
    gs_BaseURL,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
  } = useGlobalStr();

  const [items, setItems] = useState<SumItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [qtyTotalText, setQtyTotalText] = useState("");

  useEffect(() => {
    boxListShow();
  }, []);

  const boxListShow = async () => {
    setLoading(true);
    try {
      const res = await allocateInClient.getAllocateInScanBarCodeSumInfo(
        gs_BaseURL,
        f_systemDeliveryCode,
        f_barCode,
        f_scanType,
        f_model,
        f_fromck,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list) {
         const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
         let qtyAll = 0;
         const mappedItems: SumItem[] = listObj.map((item: any, index: number) => {
            qtyAll += parseInt(item.goodsCount || "0", 10);
            return {
               id: `${item.scanBarCode}-${index}`,
               scanBarCode: item.scanBarCode || "",
               palletCode: item.palletCode || "",
               model: item.model || "",
               color: item.color || "",
               imei1: item.imei1 || "",
               imei2: item.imei2 || "",
               imei3: item.imei3 || "",
               scanBarCodeType: item.scanBarCodeType || "",
               goodsCount: item.goodsCount || "",
               boxCode: item.boxCode || "",
            };
         });
         setItems(mappedItems);
         setQtyTotalText(qtyAll.toString());
      } else {
         if (res && !res.success) {
            pubfunction.ShowError(res.msg);
         }
         setQtyTotalText("0");
      }
    } catch (err: any) {
      pubfunction.ShowError(err?.message || "Network Error");
      setQtyTotalText("0");
    } finally {
      setLoading(false);
    }
  };


  const handleConfirmClick = () => {
    if (items.length >= 1) {
       DeviceEventEmitter.emit("ON_ALLOCATEIN_CONFIRM_OK", { barCode: f_barCode, scanType: f_scanType });
    }
    navigation.goBack();
  };

  const renderItem = ({ item, index }: { item: SumItem; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
       <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
       <Text style={[styles.cell, { width: 140 }]}>{item.palletCode}</Text>
       <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
       <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
       <Text style={[styles.cell, { width: 140 }]}>{item.imei1}</Text>
       <Text style={[styles.cell, { width: 140 }]}>{item.imei2}</Text>
       <Text style={[styles.cell, { width: 140 }]}>{item.imei3}</Text>
       <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
       <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
       <Text style={[styles.cell, { width: 140 }]}>{item.boxCode}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allocate In Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.infoRow, { marginBottom: 8 }]}>
          <Text style={styles.infoLabel}>Model</Text>
          <Text style={styles.infoValue}>{f_model || "-"}</Text>
        </View>

        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                 <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                 <Text style={[styles.headerCell, { width: 140 }]}>PALLET</Text>
                 <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                 <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                 <Text style={[styles.headerCell, { width: 140 }]}>IMEI1</Text>
                 <Text style={[styles.headerCell, { width: 140 }]}>IMEI2</Text>
                 <Text style={[styles.headerCell, { width: 140 }]}>IMEI3</Text>
                 <Text style={[styles.headerCell, { width: 80 }]}>TYPE</Text>
                 <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                 <Text style={[styles.headerCell, { width: 140 }]}>BOX CODE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<View style={{ width: 1180 }}><Text style={styles.emptyText}>No items found.</Text></View>}
              />
            </View>
          </ScrollView>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>Total Qty: {qtyTotalText}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={handleConfirmClick}>
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#0052cc",
  },
  infoRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    backgroundColor: "#0052cc",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: "#0052cc",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: { fontSize: 11, textAlign: "center", fontWeight: "600", paddingHorizontal: 2, color: "#1E293B" },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 4,
  },
  btn: {
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    flex: 1,
  },
  confirmBtn: { backgroundColor: "#0052cc" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  totalRow: {
    padding: 10,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "center",
  },
  totalRowText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0052cc",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
