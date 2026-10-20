import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
import { useGlobalStr } from "../../GlobalStrContext";
import * as pubfunction from "../pubfunction";
import { ApiContext, checkSNTraceability } from "./api";
import { ReturnContext, TraceabilityRecord } from "./types";
import { EVENT_REFRESH, EVENT_RETURNED } from "./events";

/**
 * Page 2 - Scan the SN of the returned product and check its delivery traceability.
 *
 *   traceability found  -> the confirm page
 *   traceability error  -> the EAN page (the EAN has to be scanned)
 */
export default function DeliveryReturnBillSN({ navigation, route }: any) {
  const params: ReturnContext = useMemo(
    () => route.params || {},
    [route.params]
  );

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

  const apiCtx: ApiContext = useMemo(
    () => ({
      gs_BaseURL,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    }),
    [
      gs_BaseURL,
      gs_wareCode,
      gs_userCode,
      gs_userName,
      gs_PasswordSalt,
      gs_version,
      gs_classCode,
      gs_IPAddress,
    ]
  );

  // Screen states
  const [txtSN, setTxtSN] = useState("");
  const [labelError, setLabelError] = useState("");
  const [labelStatus, setLabelStatus] = useState("");
  const [doneQty, setDoneQty] = useState<number>(0);
  const [planQty, setPlanQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);

  const txtSNRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  // Keep the quantities of the selected model
  useEffect(() => {
    setPlanQty(params.f_planQty || 0);
    setDoneQty(params.f_doneQty || 0);
  }, [params.f_planQty, params.f_doneQty]);

  const ensureFocus = () => {
    txtSNRef.current?.focus();
  };

  // A product has been returned, refresh the quantities
  useEffect(() => {
    const returnedSub = DeviceEventEmitter.addListener(
      EVENT_RETURNED,
      (data?: { actualQty?: number; planQty?: number; productStatus?: string }) => {
        if (data) {
          if (typeof data.actualQty === "number") setDoneQty(data.actualQty);
          if (typeof data.planQty === "number") setPlanQty(data.planQty);
          if (data.productStatus) setLabelStatus(`Status: ${data.productStatus}`);
        }
        setTxtSN("");
        setLabelError("");
        setTimeout(() => {
          txtSNRef.current?.focus();
        }, 150);
      }
    );

    setTimeout(() => {
      txtSNRef.current?.focus();
    }, 300);

    return () => {
      returnedSub.remove();
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, []);

  const buildContext = useCallback(
    (): ReturnContext => ({
      f_billCode: params.f_billCode || "",
      f_systemDeliveryCode: params.f_systemDeliveryCode || "",
      f_sapMainBillCode: params.f_sapMainBillCode || "",
      f_model: params.f_model || "",
      f_color: params.f_color || "",
      f_customerCode: params.f_customerCode || "",
      f_operatorBatch: params.f_operatorBatch || "",
      f_wareCode: params.f_wareCode || gs_wareCode || "",
      f_planQty: planQty,
      f_doneQty: doneQty,
    }),
    [params, planQty, doneQty, gs_wareCode]
  );

  /**
   * Scanned SN handling, checks the delivery traceability.
   */
  const processSNInput = async (scannedText: string) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    const SN = (scannedText || "").replace(/[\r\n]/g, "").trim().toUpperCase();
    if (!SN) return;

    setTxtSN("");
    setLabelError("");

    // The EAN is scanned on its own page, refuse it here
    if (SN.substring(0, 3) === "613") {
      setLabelError("Please scan the product SN, this is an EAN (starts with 613)!");
      ensureFocus();
      return;
    }

    setLoading(true);
    try {
      const result = await checkSNTraceability(apiCtx, {
        sn: SN,
        billCode: params.f_systemDeliveryCode || "",
        model: params.f_model || "",
      });

      if (result.found && result.trace) {
        // Traceability found, straight to the confirmation
        navigation.navigate("DeliveryReturnBillConfirm", {
          ...buildContext(),
          f_sn: SN,
          f_trace: result.trace as TraceabilityRecord,
        });
        return;
      }

      // No traceability, the EAN has to be scanned
      const message = result.error || `No delivery traceability found for SN ${SN}`;
      setLabelError(message);
      pubfunction.ShowError(message);
      navigation.navigate("DeliveryReturnBillEAN", {
        ...buildContext(),
        f_sn: SN,
        f_requiresEan: true,
      });
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        txtSNRef.current?.focus();
      }, 150);
    }
  };

  const handleTextChange = (text: string) => {
    setTxtSN(text);
    setLabelError("");

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processSNInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Auto trigger once the scanner is done
    scanTimer.current = setTimeout(() => {
      if (trimmed.length > 0) {
        processSNInput(trimmed);
      }
    }, 600);
  };

  const handleBack = () => {
    DeviceEventEmitter.emit(EVENT_REFRESH);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Delivery Return SN {gs_wareCode || ""}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Information of the selected model */}
        <View style={styles.infoCardWrapper}>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Source</Text>
            <Text style={styles.infoValueWhite}>
              {params.f_customerCode || "-"}#{params.f_wareCode || gs_wareCode || "-"}
            </Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Qty</Text>
            <Text style={styles.infoValueWhite}>
              {doneQty}/{planQty}
            </Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Model</Text>
            <Text style={styles.infoValueWhite}>{params.f_model || "-"}</Text>
          </View>
          <View style={[styles.infoRowItem, { marginBottom: 0 }]}>
            <Text style={styles.infoLabelWhite}>Color</Text>
            <Text style={styles.infoValueWhite}>{params.f_color || "-"}</Text>
          </View>
        </View>

        {labelStatus ? <Text style={styles.statusText}>{labelStatus}</Text> : null}

        {/* SN input */}
        <View style={styles.inputGroup}>
          <TextInput
            ref={txtSNRef}
            style={styles.input}
            value={txtSN}
            onChangeText={handleTextChange}
            placeholder=" SCAN PRODUCT SN"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoCorrect={false}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
          {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}
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
  infoCardWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#0052cc",
    marginBottom: 8,
  },
  infoRowItem: {
    backgroundColor: "#0052cc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabelWhite: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  infoValueWhite: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  statusText: {
    color: "#0052cc",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 4,
  },
  inputGroup: { marginBottom: 12 },
  input: {
    backgroundColor: "#e2f0eeff",
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#1E293B",
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#0052cc",
  },
  infoText: { color: "#EF4444", fontSize: 13, marginTop: 4, marginLeft: 4, fontWeight: "800" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
