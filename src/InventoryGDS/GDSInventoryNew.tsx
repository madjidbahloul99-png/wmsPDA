import React, { useState, useRef, useEffect, useCallback } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  DeviceEventEmitter,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import * as gdsInventoryClient from "./gdsInventoryClient";

interface InventoryBillSnVO {
  scanBarCode: string;
  palletCode: string;
  boxCode: string;
  goodsCount: string;
  model: string;
  colorName: string;
  scanBarCodeType: string;
  addDateFormat: string;
}

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const ScanRowItem = React.memo(
  ({
    item,
    index,
    isSelected,
    onSelect,
    styles,
  }: {
    item: InventoryBillSnVO;
    index: number;
    isSelected: boolean;
    onSelect: (index: number) => void;
    styles: any;
  }) => {
    return (
      <TouchableOpacity
        style={[
          styles.row,
          { backgroundColor: isSelected ? "#ffa3a3ff" : index % 2 === 0 ? "#FFFFFF" : "#c8dff6ff" }
        ]}
        activeOpacity={0.8}
        onPress={() => onSelect(index)}
      >
        <Text style={[styles.cell, { width: scale(180) }]}>{item.scanBarCode}</Text>
        <Text style={[styles.cell, { width: scale(180) }]}>{item.palletCode || "-"}</Text>
        <Text style={[styles.cell, { width: scale(180) }]}>{item.boxCode || "-"}</Text>
        <Text style={[styles.cell, { width: scale(140), fontWeight: "800" }]}>{item.goodsCount}</Text>
        <Text style={[styles.cell, { width: scale(180), textAlign: "left" }]}>{item.model}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.colorName || "-"}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>{item.scanBarCodeType}</Text>
        <Text style={[styles.cell, { width: scale(100) }]}>
          {item.addDateFormat ? item.addDateFormat.substring(11, 19) : ""}
        </Text>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.index === nextProps.index &&
      prevProps.item === nextProps.item
    );
  }
);

export default function GDSInventoryNew({ navigation, route }: any) {
  const f_billCode = route.params?.f_billCode ?? "";
  const f_model = route.params?.f_model ?? "";

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    g_webUrl,
    g_isRealUrl,
    gs_PasswordSalt,
    gs_version,
    
    gs_classCode,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  // Screen variables matching C# state
  const [f_modeEAN, setFModeEAN] = useState("");
  const [f_barCode, setFBarCode] = useState("");
  const [f_scanType, setFScanType] = useState("");

  const [lblModel, setLblModel] = useState(`MODEL: ${f_model} EAN: Loading...`);
  const [lblQtyTotal, setLblQtyTotal] = useState("Total: 0");

  const [txtPallet, setTxtPallet] = useState("");
  const [txtBox, setTxtBox] = useState("");
  const [txtSN, setTxtSN] = useState("");

  const [showKeyboard] = useState(false);
  // Table items matching listViewBox
  const [items, setItems] = useState<InventoryBillSnVO[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  useEffect(() => {
    initializePage();
    return () => {
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const confirmSub = DeviceEventEmitter.addListener(
      "ON_GDS_INVENTORY_CONFIRM_BOX_RESULT",
      (result: any) => {
        handleConfirmBoxResult(result);
      }
    );

    return () => {
      confirmSub.remove();
    };
  }, [txtPallet, txtBox, f_barCode, f_scanType, f_modeEAN, f_model, f_billCode]);

  const initializePage = async () => {
    setLoading(true);
    try {
      // Get model EAN code
      const eanStr = await getModelEAN();
      setFModeEAN(eanStr);
      setLblModel(`MODEL: ${f_model} EAN: ${eanStr}`);

      // Load scanned details if active bill
      if (f_billCode !== "") {
        await getModelScanSummaryList();
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Init Error");
    } finally {
      setLoading(false);
      setTimeout(() => ensureFocus(), 200);
    }
  };

  /**
   * Matches GetModelEAN in C#
   */
  const getModelEAN = async (): Promise<string> => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getModelListBymodel(
        serverUrl,
        f_model,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success && res.list && res.list.length > 0) {
        return (res.list[0].ean || "").toUpperCase();
      }
      return "EAN ERROR";
    } catch (err) {
      return "EAN ERROR";
    }
  };

  /**
   * Matches getModelScanSummaryList in C#
   */
  const getModelScanSummaryList = async () => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.getModelScanSummaryList(
        serverUrl,
        f_billCode,
        f_model,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        const list: InventoryBillSnVO[] = res.list || [];
        setItems(list);

        // Update Total count display
        let qtyTotal = 0;
        list.forEach((item) => {
          qtyTotal += parseInt(item.goodsCount || "0", 10);
        });
        setLblQtyTotal(`Total: ${qtyTotal}`);
      } else {
        if (res && res.msg) {
          pubfunction.ShowError(res.msg);
        }
        setItems([]);
        setLblQtyTotal("Total: 0");
      }
    } catch (err: any) {
    }
  };

  /**
   * Process scanned SN / PALLET / BOX input
   */
  const processScannedInput = (scannedText: string) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);

    const SN = scannedText.toUpperCase().trim();
    setTxtSN("");
    if (SN.length === 0) return;

    setFBarCode(SN);
    const scanType = pubfunction.getBarcodeType(SN);
    setFScanType(scanType);

    if (SN.substring(0, 3) === "613") {
      pubfunction.ShowError("Please scan SN/BOX/PALLET, this is EAN(starts with 613)!");
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    if (SN.substring(0, 3) === "PVI") {
      setTxtPallet(SN);
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    if (SN.substring(0, 3) === "CVI") {
      setTxtBox(SN);
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    // Otherwise, trigger GDSInventorySNConfirmBoxNew screen navigation
    navigation.navigate("GDSInventorySNConfirmBoxNew", {
      isVisible: true,
      f_barCode: SN,
      f_scanType: scanType,
      f_model: f_model,
      f_modeEAN: f_modeEAN,
    });
  };

  const handleSnChange = (text: string) => {
    setTxtSN(text);
    if (scanTimer.current) clearTimeout(scanTimer.current);

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
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
      }, 200);
    }
  };

  const handleSnSubmit = (e?: any) => {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    const text = e?.nativeEvent?.text || txtSN;
    const clean = text.trim();
    if (clean.length > 0) {
      processScannedInput(clean);
    }
  };

  /**
   * Callback from GDSInventorySNConfirmBoxNew Dialog Screen Event
   */
  const handleConfirmBoxResult = async (result: {
    isOk: boolean;
    f_EANCheckOK: boolean;
    f_palletOldOk: boolean;
    f_barCode?: string;
    f_scanType?: string;
  }) => {
    setTxtSN("");

    if (!result.isOk) {
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    // Pallet must start with P checking
    const palletStr = txtPallet.toUpperCase().trim();
    if (palletStr.length > 0 && !palletStr.startsWith("P")) {
      pubfunction.ShowError("Pallet must starts with P!");
      setTxtPallet("");
      setTimeout(() => ensureFocus(), 150);
      return;
    }

    // Box must start with B or P checking
    const boxStr = txtBox.toUpperCase().trim();
    if (boxStr.length > 0 && !boxStr.startsWith("B") ) {
      pubfunction.ShowError("Box must starts with B!");
      setTxtBox("");
      setTimeout(() => ensureFocus(), 150);
      return;
    }

    setLoading(true);
    try {
      const activeBarCode = result.f_barCode || f_barCode;
      const activeScanType = result.f_scanType || f_scanType;

      if (result.f_EANCheckOK) {
        if (!result.f_palletOldOk) {
          // Scanned an SN with verified EAN -> doAddInventorySNEanAdd
          await doAddInventorySNEanAdd(activeBarCode);
        } else {
          // Old pallet or old box code
          if (activeBarCode.substring(0, 1) === "P") {
            setTxtPallet(activeBarCode);
          } else {
            setTxtBox(activeBarCode);
          }
        }
      } else {
        // Exists in warehouse database -> doAddInventorySNAdd
        await doAddInventorySNAdd(activeBarCode, activeScanType);
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Operation Error");
    } finally {
      setLoading(false);
      setTimeout(() => ensureFocus(), 150);
    }
  };

  /**
   * Matches doAddInventorySNEanAdd in C#
   */
  const doAddInventorySNEanAdd = async (barCodeVal?: string) => {
    const activeBarCode = barCodeVal || f_barCode;
    const serverUrl = gs_BaseURL;
    const res = await gdsInventoryClient.doAddInventorySNEanAdd(
      serverUrl,
      f_billCode,
      activeBarCode,
      f_modeEAN,
      txtPallet,
      txtBox,
      f_model,
      gs_wareCode,
      gs_classCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version
    );

    if (res && res.success) {
      const list = res.list || [];
      setItems(list);

      // Update total qty
      let qtyTotal = 0;
      list.forEach((item: any) => {
        qtyTotal += parseInt(item.goodsCount || "0", 10);
      });
      setLblQtyTotal(`Total: ${qtyTotal}`);

      // Emit event to notify main list of changes
      DeviceEventEmitter.emit("ON_GDS_INVENTORY_QTY_SAVED");
    } else {
      pubfunction.ShowError(res?.msg || "Add EAN SN failed");
    }
  };

  /**
   * Matches doAddInventorySNAdd in C#
   */
  const doAddInventorySNAdd = async (barCodeVal?: string, scanTypeVal?: string) => {
    const activeBarCode = barCodeVal || f_barCode;
    const activeScanType = scanTypeVal || f_scanType;
    const serverUrl = gs_BaseURL;
    const res = await gdsInventoryClient.doAddInventorySNAdd(
      serverUrl,
      f_billCode,
      activeBarCode,
      activeScanType,
      txtPallet,
      txtBox,
      f_model,
      gs_wareCode,
      gs_classCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version
    );

    if (res && res.success) {
      const list = res.list || [];
      setItems(list);

      // Update total qty
      let qtyTotal = 0;
      list.forEach((item: any) => {
        qtyTotal += parseInt(item.goodsCount || "0", 10);
      });
      setLblQtyTotal(`Total: ${qtyTotal}`);

      // Show warnings if success with message from backend
      if (res.msg && res.msg.length >= 10) {
        pubfunction.ShowError(res.msg);
      }

      // Emit event to notify main list of changes
      DeviceEventEmitter.emit("ON_GDS_INVENTORY_QTY_SAVED");
    } else {
      pubfunction.ShowError(res?.msg || "Add SN failed");
    }
  };

  /**
   * Matches btnDelSN_Click in C#
   */
  const btnDelSN_Click = async () => {
    if (selectedRowIndex === -1 || selectedRowIndex >= items.length) {
      pubfunction.ShowError("Please select an item from the list first!");
      return;
    }

    const item = items[selectedRowIndex];
    const barcode = item.scanBarCode;

    const isokConfirm = await pubfunction.ShowConfirm(
      `Are you sure delete scan data [${barcode}]?`
    );

    if (!isokConfirm) {
      setTimeout(() => ensureFocus(), 100);
      return;
    }

    setLoading(true);
    try {
      const success = await doUpdateDeleteFlagByInventoryBillSnQO(barcode);
      if (success) {
        // Reload list
        await getModelScanSummaryList();
        setSelectedRowIndex(-1);
        DeviceEventEmitter.emit("ON_GDS_INVENTORY_QTY_SAVED");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Delete Error");
    } finally {
      setLoading(false);
      setTimeout(() => ensureFocus(), 150);
    }
  };

  /**
   * Matches doUpdateDeleteFlagByInventoryBillSnQO in C#
   */
  const doUpdateDeleteFlagByInventoryBillSnQO = async (scanBarCode: string): Promise<boolean> => {
    try {
      const serverUrl = gs_BaseURL;
      const res = await gdsInventoryClient.doUpdateDeleteFlagByInventoryBillSnQO(
        serverUrl,
        f_billCode,
        scanBarCode,
        gs_userCode,
        gs_userName,
        gs_PasswordSalt,
        gs_version
      );

      if (res && res.success) {
        return true;
      } else {
        pubfunction.ShowError(`Delete [${scanBarCode}] Error, Please Check!`);
        return false;
      }
    } catch (err) {
      pubfunction.ShowError(`Delete [${scanBarCode}] Error, Please Check!`);
      return false;
    }
  };

  /**
   * Matches btnClear_Click in C#
   */
  const btnClear_Click = () => {
    setTxtPallet("");
    setTimeout(() => ensureFocus(), 100);
  };

  /**
   * Matches btnClearBox_Click in C#
   */
  const btnClearBox_Click = () => {
    setTxtBox("");
    setTimeout(() => ensureFocus(), 100);
  };

  /**
   * Close Screen / Exit Click
   */
  const handleExitClick = () => {
    navigation.goBack();
  };

  const handleSelectRow = useCallback((index: number) => {
    setSelectedRowIndex(index);
  }, []);

  const renderScanRow = useCallback(
    ({ item, index }: { item: InventoryBillSnVO; index: number }) => (
      <ScanRowItem
        item={item}
        index={index}
        isSelected={index === selectedRowIndex}
        onSelect={handleSelectRow}
        styles={styles}
      />
    ),
    [selectedRowIndex, handleSelectRow, styles]
  );

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
          <Text style={styles.headerTitle}>Inventory Scan </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>


        {/* Pallet / Box configuration panel */}
        <View style={styles.palletBoxPanel}>
          <View style={styles.configRow}>
            <View style={styles.inputWithClear}>
              <TextInput
                style={styles.configInput}
                value={txtPallet}
                onChangeText={setTxtPallet}
                placeholder="PALLET CODE"
                placeholderTextColor="#FFF"
                autoCapitalize="characters"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
              />
              <TouchableOpacity style={styles.clearBtn} onPress={btnClear_Click}>
                <Text style={styles.clearBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.configRow}>
            <View style={styles.inputWithClear}>
              <TextInput
                style={styles.configInput}
                value={txtBox}
                onChangeText={setTxtBox}
                placeholder="BOX CODE"
                placeholderTextColor="#FFF"
                autoCapitalize="characters"
                multiline={false}
                numberOfLines={1}
                scrollEnabled={false}
              />
              <TouchableOpacity style={styles.clearBtn} onPress={btnClearBox_Click}>
                <Text style={styles.clearBtnText}>X</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Scan Input (txtSN) */}
        <View style={{ marginBottom: 6 }}>
          <TextInput
            ref={txtSNRef}
            style={styles.scanTextInput}
            value={txtSN}
            onChangeText={handleSnChange}
            onSubmitEditing={handleSnSubmit}
            placeholder="SCAN SN / PALLET / BOX TO INVENTORY"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
            multiline={false}
            numberOfLines={1}
            scrollEnabled={false}
            showSoftInputOnFocus={showKeyboard}
          />
        </View>

        {/* Table summary view list (listViewBox) */}
        <View style={styles.listCard}>
          <ScrollView horizontal contentContainerStyle={{ flexDirection: "column", flexGrow: 1 }}>
            <View style={{ width: scale(1150), flex: 1 }}>
              <View style={styles.listHeader}>
                <Text style={[styles.headerCell, { width: scale(180) }]}>BarCode</Text>
                <Text style={[styles.headerCell, { width: scale(180) }]}>Pallet</Text>
                <Text style={[styles.headerCell, { width: scale(180) }]}>Box</Text>
                <Text style={[styles.headerCell, { width: scale(140) }]}>Qty</Text>
                <Text style={[styles.headerCell, { width: scale(180), textAlign: "left" }]}>Model</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Color</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Type</Text>
                <Text style={[styles.headerCell, { width: scale(100) }]}>Time</Text>
              </View>

              <FlatList
                data={items}
                style={{ flex: 1 }}
                renderItem={renderScanRow}
                keyExtractor={(item, index) => `${item.scanBarCode}-${index}`}
                extraData={selectedRowIndex}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={10}
                removeClippedSubviews={true}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No barcode scan details recorded.</Text>
                }
              />
            </View>
          </ScrollView>

          <View style={styles.staticTotalRow}>
            <Text style={styles.staticTotalRowLabel}>Total Quantity Scanned:</Text>
            <Text style={styles.staticTotalRowValue}>{lblQtyTotal.replace("Total: ", "")}</Text>
          </View>
        </View>

        {/* Bottom controls panel */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.controlBtn, { backgroundColor: "#EF4444" }]}
            onPress={btnDelSN_Click}
          >
            <Text style={styles.controlBtnText}>Delete </Text>
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
  modelHeaderCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modelHeaderText: { fontSize: 11, fontWeight: "900", color: "#1E293B", flex: 1 },
  billCodeText: { fontSize: 10, fontWeight: "800", color: factoryColor },
  palletBoxPanel: {
    marginBottom: 6,
  },
  configRow: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 6,
  },
  configLabel: { fontSize: 9, fontWeight: "800", color: "#64748B", marginBottom: 2 },
  inputWithClear: {
    flexDirection: "row",
    alignItems: "center",
  },
  configInput: {
    flex: 1,
    height: scale(38),
    backgroundColor: factoryColor,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 13,
    color: "#FFF",
    fontWeight: "700",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  clearBtn: {
    width: scale(38),
    height: scale(38),
    backgroundColor: "#EF4444",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  clearBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  scanInputCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
  },
  scanTextInput: {
    backgroundColor: "#e2f0eeff",
    height: scale(40),
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: factoryColor,
    textAlignVertical: "center",
    overflow: "hidden",
  },
  listCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: factoryColor,
    marginBottom: 6,
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
  emptyText: {
    textAlign: "center",
    padding: 30,
    color: "#94A3B8",
    fontStyle: "italic",
    fontSize: 11,
  },
  totalRow: {
    padding: 6,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    alignItems: "flex-end"
  },
  totalRowText: {
    fontSize: 11,
    fontWeight: "900",
    color: factoryColor
  },
  staticTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  staticTotalRowLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
  },
  staticTotalRowValue: {
    fontSize: 16,
    fontWeight: "900",
    color: factoryColor,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  totalQtyBadgeText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#10B981",
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  controlBtn: {
    flex: 1,
    height: scale(38),
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
    elevation: 2,
  },
  controlBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});