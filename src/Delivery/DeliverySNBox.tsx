import React, { useState, useRef, useEffect } from "react";
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";

const REQUEST_TIMEOUT_MS = 20000; // RN Android fetch has no timeout by default

export default function DeliverySNBox({ navigation, route }: any) {
  // Page pass value - can control by pallet/box/barcode
  const f_deliveryCode = route.params?.f_deliveryCode ?? route.params?.deliveryCode ?? "";
  const f_systemDeliveryCode = route.params?.f_systemDeliveryCode ?? route.params?.systemDeliveryCode ?? "";
  const f_model = route.params?.f_model ?? route.params?.model ?? "";
  const f_modeEAN = route.params?.f_modeEAN ?? route.params?.modeEAN ?? "";
  const f_customerCode = route.params?.f_customerCode ?? route.params?.customerCode ?? "";
  const f_sapMainBillCode = route.params?.f_sapMainBillCode ?? route.params?.sapMainBillCode ?? "";
  const f_qty_initial = route.params?.f_qty ?? route.params?.qty ?? "";
  const planQty = route.params?.planQty ?? "";
  const finishQty = route.params?.finishQty ?? "";
  const txtQtyTotalStr = `${finishQty}/${planQty}`;

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    
    gs_version,
    gs_factoryindex,
} = useGlobalStr();

    const styles = createStyles(gs_factoryindex === "zentech" ? "#06b86c" : "#0052cc");

  // State variables mapping to C# form controls
  const [f_qty, setFQty] = useState(String(f_qty_initial));
  const [lblQtyTotal, setLblQtyTotal] = useState("");
  const [loading, setLoading] = useState(false);

  const txtQtyRef = useRef<TextInput>(null);

  // ---- Anti double action locks (refs are synchronous, states are not) ----
  // true from the first tap on Confirm until the save failed (or the screen closes)
  const isSavingRef = useRef(false);
  // true once the screen is closing: goBack can only be called once
  const isClosingRef = useRef(false);

  // Frm_DeliveryPalletQtySap_Load
  useEffect(() => {
    setLblQtyTotal("");
    setTimeout(() => {
      txtQtyRef.current?.focus();
    }, 300);
  }, []);

  // Screen lifecycle guard: header back, hardware back, gesture or our own goBack
  useEffect(() => {
    isClosingRef.current = false;
    const removeSub = navigation.addListener("beforeRemove", () => {
      isClosingRef.current = true;
    });
    return () => {
      removeSub();
      isClosingRef.current = true;
    };
  }, []);

  /**
   * Close the screen only once (a double tap must not pop two screens)
   */
  const closeScreen = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    navigation.goBack();
  };

  /**
   * Matches palletQtyDeal in C#
   */
  const palletQtyDeal = async (targetQty: string) => {
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const urlCur = `${gs_BaseURL}/warehouse/bill/updateWarehouseBillUpdatePalletOnly`;

      // Through class transport post write details: WarehousePalletQtyQO
      const qo = {
        billCode: f_systemDeliveryCode,
        modelCode: f_model,
        warehouseCode: gs_wareCode,
        actualCount: targetQty,
        sapMainBillCode: f_sapMainBillCode,
      };

      // Universal signature class assignment
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
        signal: controller.signal,
      });

      if (!response.ok) {
        pubfunction.ShowError(`HTTP Error: ${response.status}`);
        return false;
      }

      const data = await response.json();
      console.log("palletQtyDeal response:", data);

      if (data) {
        if (!data.success) {
          // exception prompt
          pubfunction.ShowError(data.msg || "Failed to update pallet only");
          return false;
        }
      }
      return true;
    } catch (err: any) {
      const message =
        err && err.name === "AbortError"
          ? "Request timeout, please check the network."
          : err?.message || "Failed to update pallet only";
      pubfunction.ShowError(message);
      return false;
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  /**
   * Matches button_Confirm_Click in C#
   */
  const handleConfirmClick = async () => {
    // Double tap / save already done / screen closing: do nothing
    if (isSavingRef.current || isClosingRef.current) return;

    const cleanQtyText = f_qty.trim();

    // Validate integer parsibility
    if (!/^\d+$/.test(cleanQtyText)) {
      pubfunction.ShowError(`Not a number`);
      setLblQtyTotal("QTY is not number!");
      txtQtyRef.current?.focus();
      return;
    }

    const updatedQtyStr = String(parseInt(cleanQtyText, 10));

    // Lock before the first await (synchronous): a second tap returns above
    isSavingRef.current = true;

    // pallet quantity save
    const isSuccess = await palletQtyDeal(updatedQtyStr);

    if (!isSuccess) {
      // Save failed: allow the operator to try again
      isSavingRef.current = false;
      return;
    }

    // Saved, but the operator left the screen while the request was running:
    // just notify the previous screen, no alert and no goBack
    if (isClosingRef.current) {
      DeviceEventEmitter.emit("ON_DELIVERY_CONFIRM_SUCCESS");
      return;
    }

    // The lock stays on (saved): the alert cannot be dismissed without pressing OK
    Alert.alert(
      "Success",
      "Save Success!",
      [
        {
          text: "OK",
          onPress: () => {
            DeviceEventEmitter.emit("ON_DELIVERY_CONFIRM_SUCCESS");
            closeScreen();
          },
        },
      ],
      { cancelable: false }
    );
  };

  /**
   * Matches button_exit_Click in C#
   */
  const handleExitClick = () => {
    closeScreen();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header with Title matching: label_title.Text + " " + gs_wareCode + " Qty: " + f_qty */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExitClick} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Pallet Qty Sap {gs_wareCode || ""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.formCard}>
          <View style={styles.formRow}>
            <Text style={styles.rowLabel}>MODEL</Text>
            <Text style={styles.rowValue}>{f_model || "-"}</Text>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.rowLabel}>SAP MAIN BILL</Text>
            <Text style={styles.rowValue}>{f_sapMainBillCode || "-"}</Text>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.rowLabel}>TOTAL QTY</Text>
            <Text style={styles.rowValue}>{txtQtyTotalStr || "-"}</Text>
          </View>
          <View style={styles.formRow}>
            <Text style={styles.rowLabel}>CUST CODE</Text>
            <Text style={styles.rowValue}>{f_customerCode || "-"}</Text>
          </View>

          {/* PALLET COUNT INPUT - txtQty */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>QTY</Text>
            <TextInput
              ref={txtQtyRef}
              style={styles.textInput}
              value={f_qty}
              onChangeText={(text) => {
                setFQty(text);
                setLblQtyTotal("");
              }}
              placeholder="Input Pallet Count"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              selectTextOnFocus={true}
            />
          </View>

          {/* Message Text - lblQtyTotal */}
          {lblQtyTotal ? (
            <Text style={styles.messageText}>{lblQtyTotal}</Text>
          ) : null}
        </View>

        {loading && <ActivityIndicator size="small" color="#06b86c" style={styles.spinner} />}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSave, loading && styles.disabledBtn]}
            onPress={handleConfirmClick}
            disabled={loading}
          >
            <Text style={styles.btnTextSave}>Confirm</Text>
          </TouchableOpacity>
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
  headerTitle: { color: "#FFFFFF", fontSize: scale(11), fontWeight: "900" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  userNameText: { color: "#FFFFFF", fontSize: scale(11), fontWeight: "700" },
  content: { flex: 1, padding: 16, justifyContent: "center" },
  formCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: factoryColor,
    elevation: 4,
    marginBottom: 20,
  },
  formRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: factoryColor,
    paddingHorizontal: 15,
    height: 38,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rowLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  rowValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  inputContainer: { marginTop: 15 },
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: "#e2f0eeff",
    height: 44,
    borderWidth: 1,
    borderColor: factoryColor,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "900",
    textAlign: "center",
  },
  messageText: {
    marginTop: 10,
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  spinner: { marginVertical: 10 },
  footer: { flexDirection: "row", justifyContent: "space-between" },
  btn: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
    elevation: 2,
  },
  btnPrior: { backgroundColor: "#64748B" },
  btnSave: { backgroundColor: "#10B981" },
  disabledBtn: { backgroundColor: "#CBD5E1" },
  btnTextPrior: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  btnTextSave: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
});