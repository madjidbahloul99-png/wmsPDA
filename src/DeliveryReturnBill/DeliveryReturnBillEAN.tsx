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
import { ApiContext, getModelEAN, submitReturnWithEAN } from "./api";
import { ReturnContext } from "./types";
import { EVENT_RETURNED } from "./events";

/**
 * Page 3 - Scan the EAN of a product without delivery traceability.
 *
 * This page is only reachable when the traceability check of the SN failed.
 * There is no confirmation screen here, the return is submitted automatically
 * with the SN and the EAN, then the operator goes back to the SN scan page.
 */
export default function DeliveryReturnBillEAN({ navigation, route }: any) {
  const params: ReturnContext & { f_sn?: string; f_requiresEan?: boolean } =
    useMemo(() => route.params || {}, [route.params]);

  const {
    gs_BaseURL,
    gs_wareCode,
    gs_userCode,
    gs_userName,
    gs_PasswordSalt,
    gs_version,
    gs_classCode,
    gs_IPAddress,
    gs_remark,
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
  const [txtEAN, setTxtEAN] = useState("");
  const [labelError, setLabelError] = useState("");
  const [modelEAN, setModelEAN] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeyboard] = useState(false);

  const txtEANRef = useRef<TextInput>(null);
  const scanTimer = useRef<any>(null);

  const ensureFocus = () => {
    txtEANRef.current?.focus();
  };

  /**
   * Loads the EAN of the selected model, the scanned EAN has to match it.
   */
  const loadModelEAN = useCallback(async () => {
    try {
      const ean = await getModelEAN(apiCtx, params.f_model || "");
      setModelEAN(ean);
      if (!ean) {
        setLabelError("No EAN found for this model!");
      }
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
    }
  }, [apiCtx, params.f_model]);

  useEffect(() => {
    // The EAN page only makes sense after a failed traceability check
    if (!params.f_requiresEan) {
      navigation.goBack();
      return;
    }

    loadModelEAN();

    setTimeout(() => {
      txtEANRef.current?.focus();
    }, 300);

    return () => {
      if (scanTimer.current) {
        clearTimeout(scanTimer.current);
      }
    };
  }, [params.f_requiresEan, loadModelEAN, navigation]);

  /**
   * Submits the return, the submission is automatic (no confirmation screen).
   */
  const submitReturn = async (EAN: string) => {
    setLoading(true);
    try {
      const result = await submitReturnWithEAN(apiCtx, {
        context: params,
        sn: params.f_sn || "",
        ean: EAN,
      });

      if (!result.success) {
        setLabelError(result.msg || "Save barcode error");
        setTxtEAN("");
        return;
      }

      DeviceEventEmitter.emit(EVENT_RETURNED, {
        actualQty: result.actualQty,
        planQty: result.planQty,
        productStatus: result.productStatus,
      });

      // Back to the SN scan page for the next product
      navigation.goBack();
    } catch (err: any) {
      pubfunction.ShowError(err.message || "Network error");
      setLabelError(err.message || "Network error");
      setTxtEAN("");
    } finally {
      setLoading(false);
      setTimeout(() => {
        txtEANRef.current?.focus();
      }, 150);
    }
  };

  /**
   * Validates the scanned EAN and submits the return when it matches the model.
   */
  const processEANInput = (scannedText: string) => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    const EAN = (scannedText || "").replace(/[\r\n]/g, "").trim().toUpperCase();
    if (!EAN) return;

    setTxtEAN("");
    setLabelError("");

    if ((gs_remark || "").toUpperCase() !== "EAN") {
      pubfunction.ShowError("You don't have permission to scan EAN!");
      setLabelError("You don't have permission to scan EAN!");
      return;
    }

    if (!modelEAN) {
      setLabelError("No EAN found for this model!");
      return;
    }

    if (EAN !== modelEAN) {
      const message = `EAN error, Ok is: ${modelEAN}`;
      pubfunction.ShowError(message);
      setLabelError(message);
      return;
    }

    submitReturn(EAN);
  };

  const handleTextChange = (text: string) => {
    setTxtEAN(text);
    setLabelError("");

    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
    }

    if (text.includes("\n") || text.includes("\r")) {
      const clean = text.replace(/[\r\n]/g, "").trim();
      if (clean.length > 0) {
        processEANInput(clean);
      }
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    // Auto trigger once the scanner is done
    scanTimer.current = setTimeout(() => {
      if (trimmed.length > 0) {
        processEANInput(trimmed);
      }
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Image
              source={require("../../assets/logo/left.png")}
              style={styles.returnLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delivery Return EAN</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.userNameText}>{gs_userName || gs_userCode}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Product being processed */}
        <View style={styles.infoCardWrapper}>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>SN</Text>
            <Text style={styles.infoValueWhite}>{params.f_sn || "-"}</Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Model</Text>
            <Text style={styles.infoValueWhite}>{params.f_model || "-"}</Text>
          </View>
          <View style={styles.infoRowItem}>
            <Text style={styles.infoLabelWhite}>Color</Text>
            <Text style={styles.infoValueWhite}>{params.f_color || "-"}</Text>
          </View>
          <View style={[styles.infoRowItem, { marginBottom: 0 }]}>
            <Text style={styles.infoLabelWhite}>Model EAN</Text>
            <Text style={styles.infoValueWhite}>{modelEAN || "-"}</Text>
          </View>
        </View>

        {/* EAN input */}
        <View style={styles.inputGroup}>
          <TextInput
            ref={txtEANRef}
            style={styles.input}
            value={txtEAN}
            onChangeText={handleTextChange}
            placeholder=" SCAN EAN"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoCorrect={false}
            showSoftInputOnFocus={showKeyboard}
            blurOnSubmit={false}
            onBlur={ensureFocus}
            selectTextOnFocus={true}
          />
          {labelError ? <Text style={styles.infoText}>{labelError}</Text> : null}
          <Text style={styles.hintText}>
            The return is submitted automatically, then continue with the next SN.
          </Text>
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
  hintText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    marginLeft: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});
