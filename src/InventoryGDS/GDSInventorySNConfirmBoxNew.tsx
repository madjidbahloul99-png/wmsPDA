import React, { useState, useEffect, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  DeviceEventEmitter,
  Image,
  StatusBar,
  ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as gdsInventoryClient from "./gdsInventoryClient";

interface WarehouseSumByScanBarCodeVO {
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

export default function GDSInventorySNConfirmBoxNew({ navigation, route }: any) {
  const f_barCode = route.params?.f_barCode ?? "";
  const f_scanType = route.params?.f_scanType ?? "";
  const f_model = route.params?.f_model ?? "";
  const f_modeEAN = route.params?.f_modeEAN ?? "";

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_PasswordSalt,
    
    gs_version,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  const [loading, setLoading] = useState(false);
  const [label_error, setLabelError] = useState("");
  const [items, setItems] = useState<WarehouseSumByScanBarCodeVO[]>([]);
  const [btnOkEnabled, setBtnOkEnabled] = useState(true);

  // Return values matching C# form fields
  const [f_EANCheckOK, setFEANCheckOK] = useState(false);
  const [f_palletOldOk, setFPalletOldOk] = useState(false);

  // C# Frm_InventorySNConfirmBoxNew missing variables
  const [txtEAN, setTxtEAN] = useState("");
  const [qtyTotalText, setQtyTotalText] = useState("");
  const [eanVisible, setEanVisible] = useState(false);
  const [btnPalletVisible, setBtnPalletVisible] = useState(false);
  const [btnPalletText, setBtnPalletText] = useState("");
  const [buttonConfirmVisible, setButtonConfirmVisible] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const txtEANRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureEANFocus = () => {
    txtEANRef.current?.focus();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setTimeout(() => ensureEANFocus(), 100);
    });
    return () => {
      unsubscribe();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [navigation]);

  useEffect(() => {
    // Reset state variables as on load
    setLabelError("");
    setItems([]);
    setBtnOkEnabled(true);
    setFEANCheckOK(false);
    setFPalletOldOk(false);
    setTxtEAN("");

    // Trigger stock info fetch
    if (f_barCode) {
      BoxListShow();
    }
  }, [f_barCode]);

  useEffect(() => {
    if (eanVisible) {
      setTimeout(() => {
        ensureEANFocus();
      }, 300);
    }
  }, [eanVisible]);

  /**
   * Matches BoxListShow in C#
   */
  const BoxListShow = async () => {
    setLoading(true);
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getScanBarCodeSumInfo(
        serverUrl,
        gs_wareCode,
        f_barCode,
        f_scanType,
        f_model,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      let loadedItems: WarehouseSumByScanBarCodeVO[] = [];
      let qtyAll = 0;

      if (res && res.success && res.list && res.list.length > 0) {
        loadedItems = res.list;
        setItems(loadedItems);

        // Sum goodsCount
        loadedItems.forEach((item) => {
          qtyAll += parseInt(item.goodsCount || "0", 10);
        });

        // Check model mismatch
        const firstItemModel = (loadedItems[0].model || "").toUpperCase();
        const activeModel = (f_model || "").toUpperCase();

        if (firstItemModel !== activeModel) {
          setLabelError("Scan model is different from choose model, please check model!");
        } else {
          setLabelError("");
        }
      } else {
        setItems([]);
        setLabelError("");
      }

      setQtyTotalText(`Total qty: ${qtyAll}`);

      // Check the list length to determine UI layout, exactly like Frm_InventorySNConfirmBoxNew_Load
      if (loadedItems.length <= 0) {
        setEanVisible(true);
        if (f_scanType === "PALLET") {
          pubfunction.ShowError(`if ${f_barCode} is SN, Scan EAN to confirm; if is Pallet ,click Pallet,next SN into this Pallet!`);
          setBtnPalletVisible(true);
          setBtnPalletText("Pallet");
          setButtonConfirmVisible(false);
        } else if (f_scanType === "BOX") {
          pubfunction.ShowError(`if ${f_barCode} is SN, Scan EAN to confirm; if is Box ,click Box,next SN into this Box!`);
          setBtnPalletVisible(true);
          setBtnPalletText("Box");
          setButtonConfirmVisible(false);
        } else {
          pubfunction.ShowError(`if ${f_barCode} is SN, Scan EAN to confirm;`);
          setBtnPalletVisible(false);
          setButtonConfirmVisible(true);
        }
      } else {
        setEanVisible(false);
        setBtnPalletVisible(false);
        setButtonConfirmVisible(true);
      }

    } catch (err: any) {
      setLabelError("Failed to query stock information from WMS database.");
      setItems([]);
    } finally {
      setLoading(false);
      setTimeout(() => ensureEANFocus(), 150);
    }
  };

  const processEANInput = (scannedText: string) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);

    const trimmedEAN = scannedText.toUpperCase().trim();
    setTxtEAN("");
    if (trimmedEAN.length === 0) return;

    // Validate EAN
    const expectedEAN = (f_modeEAN || "").toUpperCase().trim();
    if (trimmedEAN === expectedEAN) {
      // EAN Check OK
      setFEANCheckOK(true);
      DeviceEventEmitter.emit("ON_GDS_INVENTORY_CONFIRM_BOX_RESULT", {
        isOk: true,
        f_EANCheckOK: true,
        f_palletOldOk: false,
        f_barCode,
        f_scanType,
      });
      navigation.goBack();
    } else {
      // EAN error
      pubfunction.ShowError(`EAN error, Ok is: ${f_modeEAN}`);
      setTimeout(() => ensureEANFocus(), 100);
    }
  };

  const handleEanChange = (text: string) => {
    setTxtEAN(text);
    if (scanTimer.current) clearTimeout(scanTimer.current);

    if (text.endsWith("\n") || text.endsWith("\r")) {
      const clean = text.trim();
      if (clean.length > 0) {
        processEANInput(clean);
      }
      return;
    }

    if (text.trim().length > 0) {
      scanTimer.current = setTimeout(() => {
        const clean = text.trim();
        if (clean.length > 0) {
          processEANInput(clean);
        }
      }, 600);
    }
  };

  const handleEanSubmit = (e?: any) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    const text = e?.nativeEvent?.text || txtEAN;
    const clean = text.trim();
    if (clean.length > 0) {
      processEANInput(clean);
    }
  };

  const handlePalletClick = () => {
    setFEANCheckOK(true);
    setFPalletOldOk(true);
    DeviceEventEmitter.emit("ON_GDS_INVENTORY_CONFIRM_BOX_RESULT", {
      isOk: true,
      f_EANCheckOK: true,
      f_palletOldOk: true,
      f_barCode,
      f_scanType,
    });
    navigation.goBack();
  };

  const handleOk = () => {
    const hasItems = items.length >= 1;
    DeviceEventEmitter.emit("ON_GDS_INVENTORY_CONFIRM_BOX_RESULT", {
      isOk: hasItems,
      f_EANCheckOK: false,
      f_palletOldOk: false,
      f_barCode,
      f_scanType,
    });
    navigation.goBack();
  };

  const handleExit = () => {
    DeviceEventEmitter.emit("ON_GDS_INVENTORY_CONFIRM_BOX_RESULT", {
      isOk: false,
      f_EANCheckOK: false,
      f_palletOldOk: false,
      f_barCode,
      f_scanType,
    });
    navigation.goBack();
  };

  const renderStockRow = ({ item, index }: { item: WarehouseSumByScanBarCodeVO; index: number }) => {
    return (
      <View style={[styles.row, { backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#c8dff6ff" }]}>
        <Text style={[styles.cell, { width: scale(180) }]}>{item.scanBarCode}</Text>
        <Text style={[styles.cell, { width: scale(180) }]}>{item.palletCode || "-"}</Text>
        <Text style={[styles.cell, { width: scale(160), textAlign: "left" }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.color || "-"}</Text>
        <Text style={[styles.cell, { width: scale(200) }]}>{item.imei1 || "-"}</Text>
        <Text style={[styles.cell, { width: scale(200) }]}>{item.imei2 || "-"}</Text>
        <Text style={[styles.cell, { width: scale(200) }]}>{item.imei3 || "-"}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.scanBarCodeType}</Text>
        <Text style={[styles.cell, { width: scale(100), fontWeight: "900" }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { width: scale(180) }]}>{item.boxCode || "-"}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExit} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventory Stock Info</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Meta Row Info Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>EAN</Text>
              <Text style={styles.metaValue}>{f_modeEAN || "-"}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Model</Text>
              <Text style={styles.metaValue}>{f_model || "-"}</Text>
            </View>
          </View>
        </View>


        {/* Error / Warning Alert Box */}
        {label_error !== "" && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>{label_error}</Text>
          </View>
        )}

        {/* EAN scan / Pallet-Box action shown above the table if eanVisible is true */}
        {eanVisible && (
          <View style={styles.eanScanRow}>
          
            <View style={styles.inputWithClear}>
              <TextInput
                ref={txtEANRef}
                style={styles.eanInput}
                value={txtEAN}
                onChangeText={handleEanChange}
                //onSubmitEditing={handleEanSubmit}
                placeholder="SCAN EAN 613"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                showSoftInputOnFocus={showKeyboard}
                autoFocus={true}
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
                blurOnSubmit={false}
                onBlur={() => {
                  setTimeout(() => {
                    ensureEANFocus();
                  }, 100);
                }}
              />
              {txtEAN.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setTxtEAN("");
                    setTimeout(() => {
                      ensureEANFocus();
                    }, 100);
                  }}
                >
                  <Text style={styles.clearBtnText}>X</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* C# btnPallet/btnBox Button */}
            {btnPalletVisible && (
              <TouchableOpacity
                style={styles.palletBtn}
                onPress={handlePalletClick}
                activeOpacity={0.8}
              >
                <Text style={styles.palletBtnText}>{btnPalletText}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stock Info Table with Horizontal & Vertical Scrolling - ALWAYS DISPLAYED */}
        <View style={styles.listCard}>
          <ScrollView horizontal contentContainerStyle={{ flexDirection: "column", flexGrow: 1 }}>
            <View style={{ width: scale(1600), flex: 1 }}>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: scale(180) }]}>BarCode</Text>
                <Text style={[styles.headerCell, { width: scale(180) }]}>Pallet</Text>
                <Text style={[styles.headerCell, { width: scale(160), textAlign: "left" }]}>Model</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Color</Text>
                <Text style={[styles.headerCell, { width: scale(200) }]}>IMEI1</Text>
                <Text style={[styles.headerCell, { width: scale(200) }]}>IMEI2</Text>
                <Text style={[styles.headerCell, { width: scale(200) }]}>IMEI3</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Type</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Qty</Text>
                <Text style={[styles.headerCell, { width: scale(180) }]}>Box</Text>
              </View>

              {loading ? (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="large" color={gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc"} />
                  <Text style={styles.loaderText}>Querying stock info...</Text>
                </View>
              ) : (
                <FlatList
                  data={items}
                  style={{ flex: 1 }}
                  renderItem={renderStockRow}
                  keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
                  ListEmptyComponent={
                    <View style={{ width: scale(1010) }}>
                      <Text style={styles.emptyText}>No stock records matching barcode.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </ScrollView>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowText}>{qtyTotalText}</Text>
          </View>
        </View>

        {/* Footer / OK Action Button */}
        {buttonConfirmVisible && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.footerBtn,
                { backgroundColor: "#10B981" }
              ]}
              onPress={handleOk}
              activeOpacity={0.8}
            >
              <Text style={styles.footerBtnText}>confirm</Text>
            </TouchableOpacity>
          </View>
        )}
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
  returnLogo: { width: scale(24), height: scale(24), marginRight: 10, tintColor: "#FFFFFF" },
  headerTitle: { color: "#FFFFFF", fontSize: scale(14), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(12), fontWeight: "700" },
  content: { flex: 1, padding: 12 },
  metaCard: {
    backgroundColor: factoryColor,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 8,
    elevation: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaCol: {
    flex: 1,
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
    textAlign: "center",
  },
  modelHeaderCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 10,
  },
  modelHeaderText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginBottom: 10,
  },
  warningText: {
    fontSize: 12,
    color: "#B45309",
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 16,
  },
  eanScanRow: {
    marginBottom: 10,
  },
  eanLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: factoryColor,
    marginBottom: 8,
  },
  inputWithClear: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  eanInput: {
    flex: 1,
    height: scale(40),
    backgroundColor: "#e2f0eeff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  clearBtn: {
    width: scale(40),
    height: scale(40),
    backgroundColor: "#EF4444",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  clearBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  instructionBox: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 14,
  },
  instructionText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  palletBtn: {
    width: "100%",
    height: scale(46),
    backgroundColor: factoryColor,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  palletBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 10,
  },
  listHeader: {
    flexDirection: "row",
    backgroundColor: factoryColor,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    alignItems: "center",
  },
  cell: {
    fontSize: 12,
    color: "#1E293B",
    textAlign: "center",
    fontWeight: "600",
  },
  totalRow: {
    padding: 8,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "center",
  },
  totalRowText: {
    fontSize: 12,
    fontWeight: "900",
    color: factoryColor,
  },
  loaderContainer: {
    flex: 1,
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    padding: 40,
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 12,
  },
  footer: {
    paddingVertical: 6,
  },
  footerBtn: {
    width: "100%",
    height: scale(44),
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  footerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});