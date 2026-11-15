import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
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

interface ItemVO {
  id: string;
  scanBarCode: string;
  model: string;
  color: string;
  goodsCount: string;
  scanBarCodeType: string;
}

export default function AllocateIn({ navigation, route }: any) {
  const {
    f_deliveryCode,
    f_systemDeliveryCode,
    f_model,
    f_fromck,
    f_guid,
    f_brand
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
  } = useGlobalStr();

  const [txtSN, setTxtSN] = useState("");
  const [items, setItems] = useState<ItemVO[]>([]);
  const [qtyTotal, setQtyTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [txtSource, setTxtSource] = useState("");
  const [txtQty, setTxtQty] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  useEffect(() => {
    if (f_systemDeliveryCode) {
      getListFinishBoxList();
    }

    const confirmSub = DeviceEventEmitter.addListener("ON_ALLOCATEIN_CONFIRM_OK", (data: any) => {
       palletDeal(data.barCode, data.scanType);
    });

    const focusSub = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    });

    const interval = setInterval(() => {
      if (navigation.isFocused() && txtSNRef.current && !txtSNRef.current.isFocused()) {
        txtSNRef.current.focus();
      }
    }, 1000);

    return () => {
      confirmSub.remove();
      focusSub();
      clearInterval(interval);
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
      }
    };
  }, []);

  const getListFinishBoxList = async () => {
    setLoading(true);
    try {
      setTxtSource(`${gs_wareCode}#${f_fromck}`);
      const res = await allocateInClient.getReceiptInfoByOperatorBatch(
        gs_BaseURL,
        f_systemDeliveryCode,
        f_model,
        f_deliveryCode,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      console.log("res:",res)

      if (res && res.success && res.list) {
        const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
        let tQty = 0;
        const mappedItems: ItemVO[] = listObj.map((item: any, index: number) => {
          tQty += parseInt(item.goodsCount || "0", 10);
          return {
            id: `${item.scanBarCode}-${index}`,
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: item.goodsCount || "",
            scanBarCodeType: item.scanBarCodeType || ""
          };
        });
        setItems(mappedItems);
        setQtyTotal(tQty);
      } else {
         if (res && !res.success) {
            pubfunction.ShowError(res.msg);
         }
      }
    } catch (err: any) {
      pubfunction.ShowError(err?.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  const handleSNSubmit = () => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    const SN = txtSN.toUpperCase().trim();
    if (SN.length > 0) {
      const scanType = pubfunction.getBarcodeType(SN);
      navigation.navigate("AllocateInSNConfirmBox", {
         f_systemDeliveryCode: f_systemDeliveryCode,
         f_barCode: SN,
         f_scanType: scanType,
         f_model: f_model,
         f_fromck: f_fromck,
         f_guid: f_guid,
         f_brand: f_brand
      });
      setTxtSN("");
    }
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);

    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    scanTimerRef.current = setTimeout(() => {
      const scanType = pubfunction.getBarcodeType(trimmed.toUpperCase());
      navigation.navigate("AllocateInSNConfirmBox", {
         f_systemDeliveryCode: f_systemDeliveryCode,
         f_barCode: trimmed.toUpperCase(),
         f_scanType: scanType,
         f_model: f_model,
         f_fromck: f_fromck,
         f_guid: f_guid,
         f_brand: f_brand
      });
      setTxtSN("");
    }, 300);
  };

  const palletDeal = async (barCode: string, scanType: string) => {
    setLoading(true);
    try {
      const res = await allocateInClient.doAllocateWarehouseInStorage(
        gs_BaseURL,
        f_systemDeliveryCode,
        gs_wareCode,
        barCode,
        scanType,
        f_model,
        f_deliveryCode,
        gs_classCode,
        gs_IPAddress,
        "", // no sapMainBillCode
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.data) {
        const vo = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const jihuaQty = parseInt(vo.receiptCount?.hasDeliveryCount || "0", 10);
        const shijiQty = parseInt(vo.receiptCount?.allReceiptCount || "0", 10);

        setTxtSource(`${gs_wareCode}#${f_fromck}`);
        setTxtQty(`${shijiQty}/${jihuaQty}`);

        if (shijiQty >= jihuaQty) {
           pubfunction.ShowError("The allocate of documents has already shipped completed!");
           navigation.goBack();
           return;
        }

        let tQty = 0;
        const mappedItems: ItemVO[] = (vo.warehouseSumByScanBarCodeList || []).map((item: any, index: number) => {
          tQty += parseInt(item.goodsCount || "0", 10);
          return {
            id: `${item.scanBarCode}-${index}`,
            scanBarCode: item.scanBarCode || "",
            model: item.model || "",
            color: item.color || "",
            goodsCount: item.goodsCount || "",
            scanBarCodeType: item.scanBarCodeType || ""
          };
        });
        setItems(mappedItems);
        setQtyTotal(tQty);

      } else {
        if (res && !res.success) {
           pubfunction.ShowError(res.msg);
        }
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
      setTimeout(() => { txtSNRef.current?.focus(); }, 150);
    }
  };

  const renderItem = ({ item, index }: { item: ItemVO; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
       <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
       <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
       <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
       <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
       <Text style={[styles.cell, { width: 60 }]}>{item.scanBarCodeType}</Text>
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
          <Text style={styles.headerTitle}>Allocate In {gs_wareCode}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Source</Text><Text style={styles.infoValue}>{txtSource}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Qty</Text><Text style={styles.infoValue}>{txtQty}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Total</Text><Text style={styles.infoValue}>{qtyTotal}</Text></View>
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            ref={txtSNRef}
            style={styles.input}
            value={txtSN}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSNSubmit}
            placeholder=" SCAN BARCODE"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoFocus={true}
            selectTextOnFocus={true}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={() => {
              if (navigation.isFocused()) {
                setTimeout(() => {
                  txtSNRef.current?.focus();
                }, 100);
              }
            }}
          />
        </View>

        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                 <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                 <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                 <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                 <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                 <Text style={[styles.headerCell, { width: 60 }]}>TYPE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={<View style={{ width: 460 }}><Text style={styles.emptyText}>No items found.</Text></View>}
              />
            </View>
          </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: "#06b86c",
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
    borderColor: "#06b86c",
  },
  infoRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginBottom: 6,
    backgroundColor: "#06b86c",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF" },
  inputGroup: { marginBottom: 8 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#06b86c",
  },
  statusLabelCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#06b86c",
    marginBottom: 8,
    alignItems: "center",
  },
  statusLabelText: { color: "#06b86c", fontSize: 13, fontWeight: "900" },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#06b86c",
    marginBottom: 8,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: "#06b86c",
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
