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
  ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as allocateOutClient from "./allocateOutNONewSapClient";

interface BillItem {
  id: string;
  billCode: string;
  model: string;
  color: string;
  billCount: string;
  okQty: string;
  cyQty: string;
  fromck: string;
  tock: string;
  operatorBatch: string;
  sapMainBillCode: string;
  guid: string;
  brand: string;
  isCy: boolean;
  isOk: boolean;
}

export default function AllocateOutNONewSap({ navigation }: any) {
  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    g_webUrl,
    g_isRealUrl,
    gs_factoryindex,
  } = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [txtSN, setTxtSN] = useState("");
  const [lblError, setLblError] = useState("");
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [f_fromck, setF_fromck] = useState(gs_wareCode);
  const [f_sapMainBillCode, setF_sapMainBillCode] = useState("");
  const [f_systemDeliveryCode, setF_systemDeliveryCode] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      setTimeout(() => {
        txtSNRef.current?.focus();
        if (f_sapMainBillCode) {
          DeliveryModelListSap(f_sapMainBillCode);
        }
      }, 150);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation, f_sapMainBillCode]);

  const DeliveryModelListSap = async (sapMainBillCode: string) => {
    setLoading(true);
    setLblError("");
    setSelectedIndex(null);
    txtSNRef.current?.focus();
    try {
      const soapUrl = g_isRealUrl ? g_webUrl : "http://localhost/WINCEWeb.asmx";
      await allocateOutClient.updateBillDA(soapUrl, sapMainBillCode);

      const res = await allocateOutClient.getWarehouseAllocateBillInfoByBillCodeFromSap(
        gs_BaseURL,
        sapMainBillCode,
        gs_wareCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );
   

      if (res && res.success && res.data) {
        const vo = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
        const fromck = vo.warehouseCode;
        const tock = vo.toWarehouseCode;

        setF_fromck(fromck);

        if (vo.billInfoList && vo.billInfoList.length > 0) {
           
          const mappedItems: BillItem[] = vo.billInfoList.map((item: any, index: number) => {
            const okqty = parseInt(item.actualCount || "0", 10);
            const billcount = parseInt(item.billCount || "0", 10);
            const cyqty = billcount - okqty;

            return {
              id: `${item.billCode}-${index}`,
              billCode: item.billCode || "",
              model: item.model || "",
              color: item.color || "",
              billCount: item.billCount || "",
              okQty: okqty.toString(),
              cyQty: cyqty.toString(),
              fromck: fromck || "",
              tock: item.toWarehouseCode || "",
              operatorBatch: item.operatorBatch || "",
              sapMainBillCode: sapMainBillCode,
              guid: item.guid || "",
              brand: item.brand || "",
              isCy: cyqty > 0,
              isOk: okqty > 0,
            };
          });
          setItems(mappedItems);
            console.log("sap bill allocate out " + mappedItems)
        } else {
          setF_systemDeliveryCode("");
          if (fromck) {
            setLblError(`${tock}#${fromck}`);
            setF_fromck(fromck);
          }
          setLoading(false);
          return;
        }

        setF_systemDeliveryCode("");

        if (fromck !== "" && fromck !== gs_wareCode) {
          await allocateOutClient.updateBillDA(soapUrl, sapMainBillCode);
          setLblError(`Source WareHose Must is Login WareHouse, ${gs_wareCode} Or WareHose = DA** Updated,Scan again!`);
          setTxtSN("");
          setItems([]);
          setF_systemDeliveryCode("");
          setTimeout(() => { txtSNRef.current?.focus(); }, 150);
          setLoading(false);
          return;
        }

        setF_sapMainBillCode(sapMainBillCode);
      } else {
        pubfunction.ShowError(`${sapMainBillCode} ${res.msg || "Error"}`);
        setF_systemDeliveryCode("");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network Error");
    } finally {
      setLoading(false);
    }
  };

  const handleSNSubmit = (e?: any) => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    let SN = txtSN;
    if (e && e.nativeEvent && e.nativeEvent.text !== undefined) {
      SN = e.nativeEvent.text;
    }
    SN = SN.toUpperCase().trim();
    if (SN.length > 0) {
      setTxtSN("");
      DeliveryModelListSap(SN);
    }
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
    }
    scanTimerRef.current = setTimeout(() => {
      const SN = text.toUpperCase().trim();
      if (SN.length > 0) {
        setTxtSN("");
        DeliveryModelListSap(SN);
      }
    }, 500);
  };

  const handleItemPress = (item: BillItem) => {
    if (!item.tock) {
      pubfunction.ShowError("The destination warehouse cannot be empty!");
      return;
    }

    navigation.navigate("AllocateOutNewSap", {
      f_deliveryCode: item.operatorBatch,
      f_systemDeliveryCode: item.billCode,
      f_sapMainBillCode: f_sapMainBillCode,
      f_tock: item.tock,
      f_model: item.model,
      f_guid: item.guid,
      f_brand: item.brand
    });
  };

  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index);
    const item = items[index];
    if (item) {
      setLblError(`Source: ${item.tock}#${item.fromck}`);
    }
  };

  const handleChoiceClick = () => {
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= items.length) {
      pubfunction.ShowError("Please select a row first!");
      return;
    }

    const selectedItem = items[selectedIndex];
    if (selectedItem) {
      handleItemPress(selectedItem);
    }
  };

  const renderItem = ({ item, index }: { item: BillItem; index: number }) => {
    let textColor = "#1E293B";
    if (item.isCy) {
      if (item.isOk) {
        textColor = "blue";
      } else {
        textColor = "red";
      }
    }

    const isSelected = selectedIndex === index;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFC" },
          isSelected && styles.selectedRow
        ]}
        onPress={() => handleSelectIndex(index)}
      >
        <Text style={[styles.cell, { width: 140, color: textColor }]}>{item.sapMainBillCode}</Text>
        <Text style={[styles.cell, { width: 120, color: textColor }]}>{item.billCode}</Text>
        <Text style={[styles.cell, { width: 120, color: textColor }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: 120, color: textColor }]}>{item.color}</Text>
        <Text style={[styles.cell, { width: 60, color: textColor }]}>{item.billCount}</Text>
        <Text style={[styles.cell, { width: 60, color: textColor }]}>{item.okQty}</Text>
        <Text style={[styles.cell, { width: 60, color: textColor }]}>{item.cyQty}</Text>
        <Text style={[styles.cell, { width: 100, color: textColor }]}>{item.fromck}</Text>
        <Text style={[styles.cell, { width: 140, color: textColor }]}>{item.tock}</Text>
        <Text style={[styles.cell, { width: 200, color: textColor }]}>{item.operatorBatch}</Text>
        <Text style={[styles.cell, { width: 140, color: textColor }]}>{item.guid}</Text>
        <Text style={[styles.cell, { width: 80, color: textColor }]}>{item.brand}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image source={require("../../assets/logo/left.png")} style={styles.returnLogo} resizeMode="contain" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Allocate Out {gs_wareCode}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={{ marginBottom: 8 }}>
          <View style={styles.inputGroup}>
            <TextInput
              ref={txtSNRef}
              style={styles.input}
              value={txtSN}
              onChangeText={handleTextChange}
              onSubmitEditing={handleSNSubmit}
              placeholder=" SCAN BILL"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              autoFocus={true}
              selectTextOnFocus={true}
              showSoftInputOnFocus={showKeyboard}
              blurOnSubmit={false}
              onBlur={() => {
                setTimeout(() => {
                  txtSNRef.current?.focus();
                }, 100);
              }}
            />
          </View>
          {lblError ? <Text style={styles.errorText}>{lblError}</Text> : null}
        </View>

        <View style={styles.listCard}>
          <ScrollView horizontal>
            <View>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: 140 }]}>SAP BILL</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>SYS BILL</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>MODEL</Text>
                <Text style={[styles.headerCell, { width: 120 }]}>COLOR</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>QTY</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>OK</Text>
                <Text style={[styles.headerCell, { width: 60 }]}>Diff</Text>
                <Text style={[styles.headerCell, { width: 100 }]}>FROM</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>TO</Text>
                <Text style={[styles.headerCell, { width: 200 }]}>DELIVERY</Text>
                <Text style={[styles.headerCell, { width: 140 }]}>GUID</Text>
                <Text style={[styles.headerCell, { width: 80 }]}>BRAND</Text>
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
        </View>

        {/* Footer with Choice Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.choiceButton} onPress={handleChoiceClick} activeOpacity={0.8}>
            <Text style={styles.choiceButtonText}>Choice</Text>
          </TouchableOpacity>
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: factoryColor,
  },
  inputGroup: { marginBottom: 4 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "600",
    borderWidth: 1,
    borderColor: factoryColor,
  },
  errorText: { color: "red", fontSize: 13, marginTop: 4, fontWeight: "600" },
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
  cell: {
    fontSize: 11,
    textAlign: "center",
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  emptyText: { textAlign: "center", padding: 40, color: "#94A3B8", fontStyle: "italic" },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 },
  choiceButton: { height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: factoryColor },
  choiceButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  selectedRow: { backgroundColor: "#BAE6FD" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});