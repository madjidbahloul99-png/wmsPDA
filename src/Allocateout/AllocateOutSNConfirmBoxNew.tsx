import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
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
import * as allocateOutClient from "./allocateOutNONewSapClient";

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

export default function AllocateOutSNConfirmBoxNew({ navigation, route }: any) {
  const {
    f_barCode,
    f_scanType,
    f_model,
    f_modeEAN,
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
    gs_remark,
    gs_classCode,
  } = useGlobalStr();

  const [items, setItems] = useState<SumItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [qtyTotalText, setQtyTotalText] = useState("");
  const [qtyTotal, setQtyTotal] = useState(0);
  const [showEAN, setShowEAN] = useState(false);
  const [txtEAN, setTxtEAN] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtEANRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  useEffect(() => {
    boxListShow();
  }, []);

  const boxListShow = async () => {
    setLoading(true);
    try {
      const res = await allocateOutClient.getScanBarCodeSumInfo(
        gs_BaseURL,
        f_barCode,
        f_scanType,
        f_model,
        gs_wareCode,
        f_guid,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      let isListEmpty = true;
      if (res && res.success && res.list) {
        const listObj = typeof res.list === "string" ? JSON.parse(res.list) : res.list;
        if (listObj.length > 0) {
          isListEmpty = false;
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
          setQtyTotal(qtyAll);
          setQtyTotalText("");
        }
      }

      if (isListEmpty) {
        setShowEAN(true);
        setQtyTotalText(`This SN ${f_barCode} not exist: Already delivery or Already AllocateOut not in warehouse!`);
        //pubfunction.ShowError('This SN '+f_barCode+'not exist: Already delivery or Already AllocateOut not in warehouse!')
        setTimeout(() => {
          txtEANRef.current?.focus();
        }, 150);
      } else {
        setShowEAN(false);
      }

    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  const handleEANSubmit = async (e?: any) => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    let EAN = txtEAN;
    if (e && e.nativeEvent && e.nativeEvent.text !== undefined) {
      EAN = e.nativeEvent.text;
    }
    EAN = EAN.toUpperCase().trim();
    if (EAN.length > 0) {
      if ((gs_remark || "").toUpperCase() !== "EAN") {
        pubfunction.ShowError("You don't have permission to scan EAN!");
        setTxtEAN("");
        return;
      }
      if (EAN === f_modeEAN) {
        setLoading(true);
        try {
          const oldSNIsOk = await allocateOutClient.doAddInventoryOldSNAdd(
            gs_BaseURL,
            f_barCode,
            EAN,
            f_model,
            gs_wareCode,
            gs_classCode,
            f_brand,
            f_guid,
            gs_userCode,
            gs_userName,
            gs_PasswordSalt,
            gs_version
          );
          if (oldSNIsOk && oldSNIsOk.success) {
            DeviceEventEmitter.emit("ON_ALLOCATEOUT_CONFIRM_OK", { barCode: f_barCode, scanType: f_scanType });
            navigation.goBack();
          } else {
            setQtyTotalText(oldSNIsOk.msg || "doAddInventoryOldSNAdd error!");
          }
        } catch (err: any) {
          setQtyTotalText(err.message || "doAddInventoryOldSNAdd error!");
        } finally {
          setLoading(false);
          setTxtEAN("");
        }
      } else {
        setQtyTotalText(`EAN error, Ok is: ${f_modeEAN}`);
        setTxtEAN("");
      }
    }
  };

  const handleEANTextChange = (text: string) => {
    setTxtEAN(text);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(async () => {
      const EAN = text.toUpperCase().trim();
      if (EAN.length > 0) {
        if ((gs_remark || "").toUpperCase() !== "EAN") {
          pubfunction.ShowError("You don't have permission to scan EAN!");
          setTxtEAN("");
          return;
        }
        if (EAN === f_modeEAN) {
          setLoading(true);
          try {
            const oldSNIsOk = await allocateOutClient.doAddInventoryOldSNAdd(
              gs_BaseURL,
              f_barCode,
              EAN,
              f_model,
              gs_wareCode,
              gs_classCode,
              f_brand,
              f_guid,
              gs_userCode,
              gs_userName,
              gs_PasswordSalt,
              gs_version
            );
            if (oldSNIsOk && oldSNIsOk.success) {
              DeviceEventEmitter.emit("ON_ALLOCATEOUT_CONFIRM_OK", { barCode: f_barCode, scanType: f_scanType });
              navigation.goBack();
            } else {
              setQtyTotalText(oldSNIsOk.msg || "doAddInventoryOldSNAdd error!");
            }
          } catch (err: any) {
            setQtyTotalText(err.message || "doAddInventoryOldSNAdd error!");
          } finally {
            setLoading(false);
            setTxtEAN("");
          }
        } else {
          setQtyTotalText(`EAN error, Ok is: ${f_modeEAN}`);
          setTxtEAN("");
        }
      }
    }, 500);
  };

  const handleConfirmClick = () => {
    if (items.length >= 1) {
      DeviceEventEmitter.emit("ON_ALLOCATEOUT_CONFIRM_OK", { barCode: f_barCode, scanType: f_scanType });
    }
    navigation.goBack();
  };

  const renderItem = ({ item, index }: { item: SumItem; index: number }) => (
    <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }]}>
      <Text style={[styles.cell, { width: 140 }]}>{item.scanBarCode}</Text>
      <Text style={[styles.cell, { width: 140 }]}>{item.palletCode}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.model}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.color}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei1}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei2}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.imei3}</Text>
      <Text style={[styles.cell, { width: 80 }]}>{item.scanBarCodeType}</Text>
      <Text style={[styles.cell, { width: 60 }]}>{item.goodsCount}</Text>
      <Text style={[styles.cell, { width: 120 }]}>{item.boxCode}</Text>
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
          <Text style={styles.headerTitle}>Allocate Out Confirm</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.infoRowContainer}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{f_model || "-"}</Text>
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>EAN</Text>
            <Text style={styles.infoValue}>{f_modeEAN || "-"}</Text>
          </View>
        </View>

        {!!qtyTotalText && (
          <View style={styles.statusLabelCard}>
            <Text style={[styles.statusLabelText, showEAN && { color: 'red' }]}>{qtyTotalText}</Text>
          </View>
        )}

        {showEAN && (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.inputGroup}>
              <TextInput
                ref={txtEANRef}
                style={styles.input}
                value={txtEAN}
                onChangeText={handleEANTextChange}
                //onSubmitEditing={handleEANSubmit}
                placeholder=" SCAN EAN"
                placeholderTextColor="#64748B"
                autoCapitalize="characters"
                selectTextOnFocus={true}
                showSoftInputOnFocus={showKeyboard}
              />
            </View>
          </View>
        )}



        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>BARCODE</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>PALLET</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI1</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI2</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>IMEI3</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>TYPE</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>BOX CODE</Text>
              </View>
              <FlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                ListEmptyComponent={
                  <View style={{ width: 1100 }}>
                    <Text style={styles.emptyText}>No items found.</Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>Total Qty: {qtyTotal}</Text>
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
  infoRowContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  infoBlock: {
    flex: 1,
    backgroundColor: "#0052cc",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 12, fontWeight: "700", color: "rgba(255, 255, 255, 0.85)", textAlign: "center" },
  infoValue: { fontSize: 13, fontWeight: "900", color: "#FFFFFF", marginTop: 2, textAlign: "center" },
  inputGroup: { marginTop: 4 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    borderColor: "#0052cc",
    borderWidth: 1
  },
  statusLabelCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
    marginBottom: 8,
    alignItems: "center",
  },
  statusLabelText: { color: "#0052cc", fontSize: 10, fontWeight: "900", textAlign: 'center' },
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
